import {
  FLAP_CD, FLAP_CL, F35_CD0, F35_CL, F35_CL0, F35_CONV_BRIDGE, F35_CONV_WING_SPEED, F35_DRAG_H,
  F35_WOW_DRAG_SCALE, F35_WOW_GEAR_DRAG, F35_CTOL_ROTATE_SPEED, F35_CTOL_ROTATE_PITCH, F35_CTOL_ROTATE_THR,
  F35_CTOL_AIR_HYST, F35_GEAR_H, F35_HOVER_THR, F35_LIFT_FAN, F35_MASS, F35_MAX_THRUST, F35_PITCH_RATE,
  F35_ROLL_RATE, F35_STOVL_MIN, F35_VECTOR_SLEW, F35_WING, F35_YAW_RATE, AIR_DENSITY, GRAVITY,
} from './config'
import type { Controls, Craft, Experience } from './types'
import { clamp, lerp, modeFromVector, plantGear, wrapAngle } from './physics_shared'
/**
 * F-35 phone-simple: CTOL / STOVL / VL via thrust vector + lift-fan cue.
 * vector 0 = CTOL (aft thrust), mid = STOVL blend, 1 = VL (lift fan + nozzle down).
 */
export function stepF35(c: Craft, ctrl: Controls, dt: number, experience: Experience): string {
  let envelopeWarn = ''
  const want = clamp(ctrl.vector, 0, 1)
  const slew = F35_VECTOR_SLEW * (c.failHyd ? 0.4 : 1)
  const dV = want - c.vectorPos
  const maxStep = slew * dt
  if (Math.abs(dV) <= maxStep) c.vectorPos = want
  else c.vectorPos += Math.sign(dV) * maxStep
  c.flaps = lerp(c.flaps, clamp(ctrl.flaps, 0, 1), 1 - Math.exp(-3 * dt))
  const mode = modeFromVector(c.vectorPos)
  const vlFrac = clamp(c.vectorPos, 0, 1)
  const stovlBlend = mode === 'STOVL' ? 1 : mode === 'VL' ? 1 : 0
  const eng = c.engineL * (c.electricsOn ? 1 : 0.2) * (0.45 + 0.55 * c.fuel)
  const powerAvail = clamp(eng * (c.failAsymmetric ? 0.7 : 1), 0, 1)
  const wantRpm = 0.1 + ctrl.tcl * (0.75 + vlFrac * 0.2) * powerAvail
  c.rotorRpm += (wantRpm - c.rotorRpm) * (1 - Math.exp(-4 * dt))
  if (ctrl.tcl > 0.05 && c.fuel > 0) {
    c.fuel = Math.max(0, c.fuel - dt * (0.001 + ctrl.tcl * 0.0015))
  }
  const speedHoriz = Math.hypot(c.vx, c.vz)
  const speedKt = speedHoriz * 1.94384
  const agl = Math.max(0, c.y - F35_GEAR_H)
  const contactH = c.gearDown ? F35_GEAR_H : F35_GEAR_H * 0.5
  const ctolVec = vlFrac < F35_STOVL_MIN * 0.85
  const nearDeck = c.gearDown && agl < 0.85
  let wowCtol = false
  if (ctolVec && c.gearDown) {
    if (c.onGround) {
      wowCtol = agl < F35_CTOL_AIR_HYST + 0.4
    } else if (agl < 0.25 && c.vy <= 0.4) {
      wowCtol = true
    }
  }
  if (mode === 'STOVL') {
    if (speedKt > 180) envelopeWarn = 'FAST for STOVL — slow or go CTOL'
    else if (speedKt < 25 && agl < 6 && !c.onGround) envelopeWarn = 'STOVL — watch sink'
    else envelopeWarn = 'STOVL — thrust vector blend'
  } else if (mode === 'VL') {
    if (speedKt > 55) envelopeWarn = 'VL — reduce forward speed'
    else if (experience !== 'casual') envelopeWarn = 'VL — lift fan + nozzle'
  } else if (mode === 'CTOL' && wowCtol) {
    if (ctrl.tcl < 0.08) envelopeWarn = 'CTOL cold — throttle up to taxi / roll'
    else if (speedKt < 70) envelopeWarn = 'CTOL roll — accelerate, stick-up to rotate'
  } else if (mode === 'CTOL' && speedKt < 75 && agl > 5 && ctrl.tcl < 0.45) {
    envelopeWarn = 'CTOL — keep speed / AoA'
  }
  const noseUpCmd = -ctrl.cyclicPitch
  const pitchCmd = ctrl.cyclicPitch * F35_PITCH_RATE
  let rollCmd = ctrl.cyclicRoll * F35_ROLL_RATE
  let yawCmd = ctrl.yaw * F35_YAW_RATE * (mode === 'CTOL' ? clamp(speedHoriz / 50, 0.2, 1) : 1)
  if (c.failAsymmetric) rollCmd += 0.2
  if (mode === 'VL') {
    yawCmd += ctrl.tcl * 0.04 * ctrl.cyclicRoll
  }
  if (!wowCtol) {
    if (c.onGround && speedHoriz < 10 && ctrl.tcl < 0.14) {
      c.pitch *= Math.exp(-8 * dt)
      if (Math.abs(c.pitch) < 0.01) c.pitch = 0
      c.roll *= Math.exp(-8 * dt)
    } else {
      c.pitch += pitchCmd * dt
      if (c.onGround) c.roll *= Math.exp(-8 * dt)
      else c.roll += rollCmd * dt
    }
    c.yaw = wrapAngle(c.yaw + yawCmd * dt)
  } else {
    const rotateAuth = clamp(
      (speedHoriz - F35_CTOL_ROTATE_SPEED * 0.5) / (F35_CTOL_ROTATE_SPEED * 0.5),
      0,
      1,
    )
    const stickNoseUp = noseUpCmd >= 0.04
    const parked = speedHoriz < 10 && ctrl.tcl < 0.14
    const pitchAuth = parked
      ? 0
      : stickNoseUp
        ? 0.12 + 0.88 * rotateAuth
        : 0.08 * rotateAuth
    c.pitch += pitchCmd * dt * pitchAuth
    if (parked) {
      c.pitch *= Math.exp(-8 * dt)
      if (Math.abs(c.pitch) < 0.01) c.pitch = 0
    }
    c.roll *= Math.exp(-10 * dt)
  }
  const pitchLim = mode === 'STOVL' ? 0.62 : mode === 'VL' ? 0.5 : wowCtol ? 0.42 : 0.58
  c.pitch = clamp(c.pitch, -pitchLim, pitchLim)
  c.roll = clamp(c.roll, -0.9, 0.9)
  const stickPitchLive = Math.abs(ctrl.cyclicPitch) >= 0.04
  const stickRollLive = Math.abs(ctrl.cyclicRoll) >= 0.04
  if (!stickPitchLive && !wowCtol) c.pitch *= Math.exp(-0.2 * dt)
  if (!stickRollLive && !wowCtol) c.roll *= Math.exp(-0.26 * dt)
  if (wowCtol && !stickPitchLive) c.pitch *= Math.exp(-2.2 * dt)
  if (wowCtol) c.roll *= Math.exp(-6 * dt)
  const cy = Math.cos(c.yaw)
  const sy = Math.sin(c.yaw)
  const cp = Math.cos(c.pitch)
  const sp = Math.sin(c.pitch)
  const cr = Math.cos(c.roll)
  const sr = Math.sin(c.roll)
  const fxB = sy * cp
  const fyB = -sp
  const fzB = cy * cp
  const ux = sy * sp * cr - cy * sr
  const uy = cp * cr
  const uz = cy * sp * cr + sy * sr
  let nozzleDown = wowCtol ? 0 : vlFrac
  let nx = (1 - nozzleDown) * fxB + nozzleDown * ux
  let ny = (1 - nozzleDown) * fyB + nozzleDown * uy
  let nz = (1 - nozzleDown) * fzB + nozzleDown * uz
  const tipBlend = wowCtol ? 0 : mode === 'CTOL' ? 0.12 : 0.4
  const tip = clamp(noseUpCmd, -1, 1) * tipBlend
  nx += tip * fxB
  ny += tip * fyB
  nz += tip * fzB
  const nMag = Math.hypot(nx, ny, nz) || 1
  nx /= nMag
  ny /= nMag
  nz /= nMag
  const stovlBoost = 1 + vlFrac * 0.2
  const mainThrust =
    F35_MAX_THRUST * ctrl.tcl * powerAvail * (0.75 + 0.25 * c.rotorRpm) * stovlBoost
  const airspeedEarly = Math.hypot(c.vx, c.vy, c.vz)
  const wingReadyEarly = clamp(airspeedEarly / F35_CONV_WING_SPEED, 0, 1)
  const fanFrac = clamp((vlFrac - 0.08) / 0.75, 0, 1)
  let fanKeep = Math.max(fanFrac, (1 - wingReadyEarly) * clamp(vlFrac / 0.35, 0, 1) * 0.55)
  if (wowCtol || (c.onGround && vlFrac < 0.72)) fanKeep = 0
  const fanThrust = F35_LIFT_FAN * ctrl.tcl * fanKeep * powerAvail * (0.65 + 0.35 * c.rotorRpm)
  const ge = wowCtol ? 0 : 0.18 * Math.exp(-agl / 8) * fanKeep * (c.onGround ? 0.3 : 1)
  let fx = nx * mainThrust + ux * fanThrust * (1 + ge)
  let fy = ny * mainThrust + uy * fanThrust * (1 + ge) - F35_MASS * GRAVITY
  let fz = nz * mainThrust + uz * fanThrust * (1 + ge)
  if (!wowCtol && ctrl.tcl > 0.55 && agl < 450) {
    const keep = clamp(1 - agl / 450, 0, 1) * clamp((ctrl.tcl - 0.55) / 0.4, 0, 1)
    const pathBoost = mainThrust * 0.18 * keep
    fx += fxB * pathBoost
    fz += fzB * pathBoost
  }
  if (wowCtol) {
    const upThrust = Math.max(0, ny * mainThrust + uy * fanThrust * (1 + ge))
    fy -= upThrust
    const rollPush = F35_MASS * (9.5 + ctrl.tcl * 17) * ctrl.tcl * powerAvail
    fx += fxB * rollPush
    fz += fzB * rollPush
    if (c.parkingBrake && ctrl.tcl < 0.12) {
      fx -= c.vx * F35_MASS * 8
      fz -= c.vz * F35_MASS * 8
    } else if (c.parkingBrake && ctrl.tcl >= 0.12) {
      c.parkingBrake = false
    }
  }
  if (!wowCtol && (mode === 'VL' || (mode === 'STOVL' && speedKt < 60))) {
    fx += ux * ctrl.tcl * F35_MASS * 2.5 * stovlBlend * 0.15
  }
  const airspeed = Math.min(Math.hypot(c.vx, c.vy, c.vz), 180)
  const qDyn = 0.5 * AIR_DENSITY * airspeed * airspeed
  const wingOn = wowCtol
    ? clamp(1 - vlFrac * 0.65, 0.22, 1) * clamp(airspeed / 28, 0, 1)
    : clamp(1 - vlFrac * 0.65, 0.22, 1) * clamp(airspeed / 16, 0, 1)
  if (wingOn > 0.02 && airspeed > 3) {
    const vPitch = Math.atan2(-c.vy, Math.max(1, speedHoriz))
    const aoa = clamp(-c.pitch - vPitch, -1.2, 1.2)
    c.aoa = aoa
    const cl = clamp(F35_CL0 + F35_CL * aoa + FLAP_CL * c.flaps * 0.8, -1.1, 1.7)
    const energyKeep =
      clamp(1 - agl / 450, 0, 1) * clamp((ctrl.tcl - 0.5) / 0.45, 0, 1) * clamp(1 - Math.abs(aoa) / 1.05, 0.2, 1)
    const induced = 0.055 * (1 - 0.55 * energyKeep)
    const cd = F35_CD0 + induced * cl * cl + FLAP_CD * c.flaps * 0.65
    const lift = clamp(qDyn * F35_WING * cl * wingOn, -F35_MASS * 45, F35_MASS * 45)
    const drag = clamp(qDyn * F35_WING * cd * wingOn * (0.85 - 0.2 * energyKeep), 0, F35_MASS * 35)
    fx += ux * lift
    fy += uy * lift
    fz += uz * lift
    if (airspeed > 0.1) {
      fx -= (c.vx / airspeed) * drag
      fy -= (c.vy / airspeed) * drag
      fz -= (c.vz / airspeed) * drag
    }
  } else {
    c.aoa = c.pitch
  }
  const wingReady = clamp(airspeed / F35_CONV_WING_SPEED, 0, 1) * clamp(1 - vlFrac * 0.7, 0.15, 1)
  const tilted = clamp((0.95 - vlFrac) / 0.85, 0, 1)
  const inConvert =
    !wowCtol &&
    !(c.onGround && vlFrac < 0.72) &&
    (mode === 'STOVL' || (mode === 'CTOL' && vlFrac > 0.05) || (mode === 'VL' && vlFrac < 0.95))
  if (inConvert) {
    const bridgeNeed = tilted * (1 - wingReady) * F35_CONV_BRIDGE
    fy += F35_MASS * GRAVITY * ctrl.tcl * powerAvail * bridgeNeed
    if (bridgeNeed > 0.05 && ctrl.tcl > 0.4) {
      const stoPush = F35_MASS * (3.2 + noseUpCmd * 4) * bridgeNeed * ctrl.tcl
      fx += fxB * stoPush
      fz += fzB * stoPush
    }
  }
  const dragScale =
    (0.25 + vlFrac * 0.12) * (0.3 + airspeed * 0.0055) * (wowCtol ? F35_WOW_DRAG_SCALE : 1)
  fx -= c.vx * F35_DRAG_H * F35_MASS * dragScale
  fz -= c.vz * F35_DRAG_H * F35_MASS * dragScale
  fy -= c.vy * 1.2 * F35_MASS * 0.08
  if (c.gearDown && mode === 'CTOL') {
    const gearDrag = wowCtol ? F35_WOW_GEAR_DRAG : 0.1
    fx -= c.vx * gearDrag * F35_MASS
    fz -= c.vz * gearDrag * F35_MASS
  }
  const ax = clamp(fx / F35_MASS, -100, 100)
  const ay = clamp(fy / F35_MASS, -70, 50)
  const az = clamp(fz / F35_MASS, -100, 100)
  c.vx += ax * dt
  c.vy += ay * dt
  c.vz += az * dt
  c.vx = clamp(c.vx, -160, 160)
  c.vy = clamp(c.vy, -45, 45)
  c.vz = clamp(c.vz, -160, 160)
  c.x += c.vx * dt
  c.y += c.vy * dt
  c.z += c.vz * dt
  if (!Number.isFinite(c.x)) c.x = 0
  if (!Number.isFinite(c.y)) c.y = F35_GEAR_H
  if (!Number.isFinite(c.z)) c.z = 0
  if (!Number.isFinite(c.aoa)) c.aoa = c.pitch
  if (wowCtol || (ctolVec && c.gearDown && c.y <= contactH + 0.2 && c.vy < 2)) {
    c.y = contactH
    c.vy *= Math.exp(-28 * dt)
    if (Math.abs(c.vy) < 0.35) c.vy = 0
    c.onGround = true
    const slow = clamp(1 - speedHoriz / 12, 0, 1)
    const rollMu = c.parkingBrake
      ? 16
      : lerp(6.2 + slow * 3.5, 0.58, clamp(ctrl.tcl, 0, 1))
    c.vx *= Math.exp(-rollMu * dt)
    c.vz *= Math.exp(-rollMu * dt)
    if (speedHoriz < 0.35 && ctrl.tcl < 0.08) {
      c.vx = 0
      c.vz = 0
    }
    const steer = clamp(ctrl.yaw - ctrl.cyclicRoll * 0.55, -1, 1)
    const noseAuth = clamp(speedHoriz / 7, 0, 1)
    const rudAuth = clamp(speedHoriz / 45, 0.15, 1)
    const yawRateGnd = F35_YAW_RATE * (noseAuth * 1.35 + rudAuth * 0.85)
    if (speedHoriz > 0.8 || ctrl.tcl > 0.15) {
      c.yaw = wrapAngle(c.yaw + steer * yawRateGnd * dt)
    }
    if (speedHoriz > 0.4) {
      const wantVx = Math.sin(c.yaw) * speedHoriz
      const wantVz = Math.cos(c.yaw) * speedHoriz
      c.vx = lerp(c.vx, wantVx, 1 - Math.exp(-4.5 * dt))
      c.vz = lerp(c.vz, wantVz, 1 - Math.exp(-4.5 * dt))
    }
    const rotateReady =
      speedHoriz > F35_CTOL_ROTATE_SPEED &&
      c.pitch < -F35_CTOL_ROTATE_PITCH &&
      ctrl.tcl > F35_CTOL_ROTATE_THR
    if (rotateReady) {
      c.onGround = false
      c.vy = Math.max(0.8, 1.2 + (ctrl.tcl - F35_CTOL_ROTATE_THR) * 4)
      c.y = contactH + 0.35
    }
  } else if (!ctolVec && nearDeck && (mode === 'VL' || mode === 'STOVL')) {
    const plantThr = mode === 'VL' ? 0.55 : 0.38
    plantGear(c, contactH, ctrl, plantThr, dt)
  } else if (!ctolVec) {
    const plantThr = mode === 'VL' ? 0.55 : mode === 'STOVL' ? 0.38 : 0.18
    plantGear(c, contactH, ctrl, plantThr, dt)
  } else if (ctolVec && c.gearDown && c.y < contactH + F35_CTOL_AIR_HYST) {
    if (c.y < contactH) {
      c.y = contactH
      c.vy = 0
      c.onGround = true
    } else {
      c.vy *= Math.exp(-12 * dt)
    }
  }
  if (mode === 'VL' && !c.onGround && ctrl.tcl < F35_HOVER_THR - 0.15 && experience === 'advanced') {
    c.vy -= 1.0 * dt
  }
  return envelopeWarn
}
