import {
  AIR_DENSITY, APL_PITCH_RATE, APL_ROLL_RATE, APL_YAW_RATE, CD0, CD_INDUCED, CL0, CL_ALPHA,
  CONV_BRIDGE, CONV_MAX_SPEED, CONV_MIN_ALT, CONV_MIN_SPEED, CONV_PITCH_FLOOR, CONV_WING_SPEED,
  CYCLIC_THRUST_TIP, DRAG_H, DRAG_V, FLAP_CD, FLAP_CL, GE_BONUS, GE_HEIGHT, GEAR_H,
  GRAVITY, MASS, MAX_THRUST, NACELLE_SLEW,
  PITCH_RATE, ROLL_RATE, SETTLE, WING_AREA, YAW_RATE,
} from './config'
import type { Controls, Craft, Experience } from './types'
import { clamp, lerp, modeFromNacelle, nacelleCmdToDeg, plantGear, wrapAngle } from './physics_shared'

/** Osprey tiltrotor: HEL / CONV / APL via nacelle. */
export function stepOsprey(c: Craft, ctrl: Controls, dt: number, experience: Experience): string {
  let envelopeWarn = ''
  const wantDeg = nacelleCmdToDeg(ctrl.nacelle)
  const slew = NACELLE_SLEW * (c.failHyd ? 0.35 : 1)
  const dN = wantDeg - c.nacelleDeg
  const maxStep = slew * dt
  if (Math.abs(dN) <= maxStep) c.nacelleDeg = wantDeg
  else c.nacelleDeg += Math.sign(dN) * maxStep

  c.flaps = lerp(c.flaps, clamp(ctrl.flaps, 0, 1), 1 - Math.exp(-3 * dt))

  const mode = modeFromNacelle(c.nacelleDeg)
  const nacRad = (c.nacelleDeg * Math.PI) / 180
  const helFrac = Math.sin(nacRad)
  const aplFrac = Math.cos(nacRad)

  const engAvg = ((c.engineL + c.engineR) / 2) * (c.electricsOn ? 1 : 0.15)
  const asym = c.failAsymmetric ? 0.55 : 1
  const powerAvail = clamp(engAvg * asym * (0.4 + 0.6 * c.fuel), 0, 1)

  const wantRpm = 0.15 + ctrl.tcl * 0.85 * powerAvail
  c.rotorRpm += (wantRpm - c.rotorRpm) * (1 - Math.exp(-3.2 * dt))

  if (ctrl.tcl > 0.05 && c.fuel > 0) {
    c.fuel = Math.max(0, c.fuel - dt * (0.0008 + ctrl.tcl * 0.0012))
  }

  const speedHoriz = Math.hypot(c.vx, c.vz)
  const speedKt = speedHoriz * 1.94384
  const agl = Math.max(0, c.y - GEAR_H)

  if (mode === 'CONV' || (mode === 'HEL' && c.nacelleDeg < 85) || (mode === 'APL' && c.nacelleDeg > 5)) {
    if (speedKt < CONV_MIN_SPEED && c.nacelleDeg < 70) {
      envelopeWarn = 'SLOW — accelerate before converting down'
      if (experience === 'advanced' && c.nacelleDeg < 50) c.vy -= 1.2 * dt
    } else if (speedKt > CONV_MAX_SPEED && c.nacelleDeg > 40) {
      envelopeWarn = 'FAST — slow before converting up'
    } else if (agl < CONV_MIN_ALT && mode === 'CONV' && !c.onGround) {
      envelopeWarn = 'LOW — convert higher'
    } else if (mode === 'CONV') {
      envelopeWarn = 'CONV — keep speed in band'
    }
  }

  // v4: pitch authority floor through CONV — stick always commands pitch
  const pitchRate = Math.max(lerp(APL_PITCH_RATE, PITCH_RATE, helFrac), CONV_PITCH_FLOOR)
  const rollRate = lerp(APL_ROLL_RATE, ROLL_RATE, helFrac)
  const yawRate = lerp(APL_YAW_RATE, YAW_RATE, helFrac)

  let pitchCmd = ctrl.cyclicPitch * pitchRate
  let rollCmd = ctrl.cyclicRoll * rollRate
  let yawCmd = ctrl.yaw * yawRate
  if (helFrac > 0.4) yawCmd += ctrl.tcl * 0.06 * ctrl.cyclicRoll * helFrac
  else yawCmd *= clamp(speedHoriz / 40, 0.15, 1)
  // On the wheels in ANY nacelle angle — not only airplane mode.
  // Starting rotation used to drop this lock and the bird went loose.
  const deckAirplane = c.onGround && speedHoriz < 1.5 && ctrl.tcl < 0.1
  if (deckAirplane && helFrac < 0.75) yawCmd = 0
  if (c.onGround) {
    rollCmd = 0
    // Kyle A: parked / idle — no free pitch rock. Authority only with speed + power.
    const parked = speedHoriz < 10 && ctrl.tcl < 0.14
    if (parked) {
      pitchCmd = 0
    } else if (helFrac < 0.65) {
      const speedAuth = clamp((speedHoriz - 12) / 22, 0, 1)
      const powerAuth = clamp((ctrl.tcl - 0.1) / 0.4, 0, 1)
      const pitchAuth = Math.max(speedAuth, powerAuth * 0.35)
      pitchCmd *= 0.05 + 0.95 * pitchAuth
    } else {
      // Nacelle off airplane but wheels still planted — stay planted, don't get loose
      const speedAuth = clamp((speedHoriz - 8) / 18, 0, 1)
      pitchCmd *= 0.04 + 0.5 * speedAuth
    }
  }
  if (c.failAsymmetric) rollCmd += 0.25

  c.pitch += pitchCmd * dt
  c.roll += rollCmd * dt
  c.yaw = wrapAngle(c.yaw + yawCmd * dt)

  // Wider limits in CONV so short-takeoff rotate / dive-for-speed works
  const pitchLim = mode === 'CONV' ? 0.65 : lerp(0.5, 0.58, helFrac)
  const rollLim = lerp(0.85, 0.65, helFrac)
  c.pitch = clamp(c.pitch, -pitchLim, pitchLim)
  c.roll = clamp(c.roll, -rollLim, rollLim)
  // v4: never fight stick toward zero — only gentle center when stick is dead
  const stickPitchLive = Math.abs(ctrl.cyclicPitch) >= 0.04
  const stickRollLive = Math.abs(ctrl.cyclicRoll) >= 0.04
  if (!stickPitchLive) c.pitch *= Math.exp(-0.22 * dt)
  if (!stickRollLive || c.onGround) c.roll *= Math.exp(-6 * dt)
  // Kyle A: parked idle — hard damp pitch to wings-level (stronger than stick-dead settle)
  if (c.onGround && speedHoriz < 10 && ctrl.tcl < 0.14) {
    c.pitch *= Math.exp(-8 * dt)
    if (Math.abs(c.pitch) < 0.01) c.pitch = 0
  }

  const cy = Math.cos(c.yaw)
  const sy = Math.sin(c.yaw)
  const cp = Math.cos(c.pitch)
  const sp = Math.sin(c.pitch)
  const cr = Math.cos(c.roll)
  const sr = Math.sin(c.roll)

  const fxB = sy * cp
  const fyB = -sp
  const fzB = cy * cp
  // +roll raises the right wing (bank left). Drift follows the LOW wing.
  const ux = sy * sp * cr - cy * sr
  const uy = cp * cr
  const uz = cy * sp * cr + sy * sr

  let tx = Math.sin(nacRad) * ux + Math.cos(nacRad) * fxB
  let ty = Math.sin(nacRad) * uy + Math.cos(nacRad) * fyB
  let tz = Math.sin(nacRad) * uz + Math.cos(nacRad) * fzB

  // v4: direct cyclic → thrust tip (heli-like). +cyclicPitch = tip thrust forward.
  // Stays alive through CONV so "pitch forward" accelerates even before attitude catches.
  const tipBlend = helFrac * 0.75 + (mode === 'CONV' ? 0.45 : mode === 'HEL' ? 0.25 : 0.08)
  const tip = clamp(ctrl.cyclicPitch, -1, 1) * CYCLIC_THRUST_TIP * tipBlend
  tx += tip * fxB
  ty += tip * fyB
  tz += tip * fzB
  const tMag = Math.hypot(tx, ty, tz) || 1
  tx /= tMag
  ty /= tMag
  tz /= tMag

  const ge = GE_BONUS * Math.exp(-agl / GE_HEIGHT) * helFrac * (c.onGround ? 0.35 : 1)
  const thrustMag = MAX_THRUST * ctrl.tcl * (0.7 + 0.3 * c.rotorRpm) * powerAvail * (1 + ge)

  let fx = tx * thrustMag
  let fy = ty * thrustMag - MASS * GRAVITY
  let fz = tz * thrustMag

  const airspeed = Math.min(Math.hypot(c.vx, c.vy, c.vz), 140)
  const qDyn = 0.5 * AIR_DENSITY * airspeed * airspeed
  // Wing comes online earlier so convert has a lift path
  const wingOn = clamp(aplFrac * 1.25, 0, 1) * clamp(airspeed / 16, 0, 1)

  if (wingOn > 0.02 && airspeed > 2) {
    const vPitch = Math.atan2(-c.vy, Math.max(1, speedHoriz))
    // Nose-up is negative pitch (same as thrust and the drawn nose). Wing must lift that way.
    const aoa = clamp(-c.pitch - vPitch, -1.2, 1.2)
    c.aoa = aoa
    const cl = clamp(CL0 + CL_ALPHA * aoa + FLAP_CL * c.flaps, -1.2, 1.85)
    const cd = CD0 + CD_INDUCED * cl * cl + FLAP_CD * c.flaps
    const lift = clamp(qDyn * WING_AREA * cl * wingOn, -MASS * 40, MASS * 40)
    const drag = clamp(qDyn * WING_AREA * cd * wingOn * 0.85, 0, MASS * 30)
    fx += ux * lift
    fy += uy * lift
    fz += uz * lift
    /* wing vert tracked via fy */
    if (airspeed > 0.1) {
      fx -= (c.vx / airspeed) * drag
      fy -= (c.vy / airspeed) * drag
      fz -= (c.vz / airspeed) * drag
    }
  } else {
    c.aoa = c.pitch
  }

  // —— Conversion lift bridge (v4) ——
  // As nacelle tilts, rotor vertical drops before wing q is enough. Fill the gap
  // so short-takeoff / convert doesn't dump altitude. Fades with wing readiness.
  const wingReady = clamp(airspeed / CONV_WING_SPEED, 0, 1) * clamp(aplFrac * 1.1, 0, 1)
  const tilted = clamp((90 - c.nacelleDeg) / 75, 0, 1) // 0 HEL → 1 deep convert
  const bridgeNeed = tilted * (1 - wingReady) * CONV_BRIDGE
  const bridgeFy = MASS * GRAVITY * ctrl.tcl * powerAvail * bridgeNeed
  fy += bridgeFy
  // Slight forward assist while bridging so rotate+power gains speed (STO profile)
  if (bridgeNeed > 0.05 && ctrl.tcl > 0.45) {
    const stoPush = MASS * (2.8 + ctrl.cyclicPitch * 3.5) * bridgeNeed * ctrl.tcl
    fx += fxB * stoPush
    fz += fzB * stoPush
  }

  // Parasite drag — much lighter in CONV/APL (v4 energy retention)
  const dragScale =
    (0.22 + helFrac * 0.18) * (0.32 + airspeed * (aplFrac > 0.7 ? 0.0095 : 0.006))
  fx -= c.vx * DRAG_H * MASS * dragScale
  fz -= c.vz * DRAG_H * MASS * dragScale
  fy -= c.vy * DRAG_V * MASS * 0.08 * (0.4 + helFrac * 0.4)

  // Settle / VRS-like — only when not intentionally pitching for speed
  if (c.vy < 0 && ctrl.tcl > 0.3 && helFrac > 0.55 && !stickPitchLive) {
    fy -= SETTLE * MASS * (-c.vy) * ctrl.tcl * helFrac
  }
  if (c.gearDown && aplFrac > 0.5) {
    fx -= c.vx * 0.1 * MASS
    fz -= c.vz * 0.1 * MASS
  }

  // Cap accelerations so extreme AoA / q cannot explode into NaN next frame
  const ax = clamp(fx / MASS, -80, 80)
  const ay = clamp(fy / MASS, -60, 40)
  const az = clamp(fz / MASS, -80, 80)
  c.vx += ax * dt
  c.vy += ay * dt
  c.vz += az * dt
  c.vx = clamp(c.vx, -120, 120)
  c.vy = clamp(c.vy, -40, 40)
  c.vz = clamp(c.vz, -120, 120)
  c.x += c.vx * dt
  c.y += c.vy * dt
  c.z += c.vz * dt
  if (!Number.isFinite(c.x)) c.x = 0
  if (!Number.isFinite(c.y)) c.y = GEAR_H
  if (!Number.isFinite(c.z)) c.z = 0
  if (!Number.isFinite(c.aoa)) c.aoa = c.pitch

  const contactH = c.gearDown ? GEAR_H : GEAR_H * 0.55
  const plantThr = mode === 'HEL' ? 0.55 : 0.25
  plantGear(c, contactH, ctrl, plantThr, dt)

  // Wheels in any nacelle position until the gear actually unloads.
  if (c.onGround) {
    if (c.parkingBrake && ctrl.tcl < 0.12) {
      c.vx = 0
      c.vz = 0
    } else if (c.parkingBrake && ctrl.tcl >= 0.12) {
      c.parkingBrake = false
    }
    const fwdX = Math.sin(c.yaw)
    const fwdZ = Math.cos(c.yaw)
    const fwd = c.vx * fwdX + c.vz * fwdZ
    c.vx = fwd * fwdX
    c.vz = fwd * fwdZ
  }
  return envelopeWarn
}
