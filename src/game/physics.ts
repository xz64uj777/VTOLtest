import {
  AIR_DENSITY,
  APL_PITCH_RATE,
  APL_ROLL_RATE,
  APL_YAW_RATE,
  CD0,
  CD_INDUCED,
  CL0,
  CL_ALPHA,
  CONV_BRIDGE,
  CONV_MAX_SPEED,
  CONV_MIN_ALT,
  CONV_MIN_SPEED,
  CONV_PITCH_FLOOR,
  CONV_WING_SPEED,
  CYCLIC_THRUST_TIP,
  DRAG_H,
  DRAG_V,
  F35_CD0,
  F35_CL,
  F35_CL0,
  F35_CONV_BRIDGE,
  F35_CONV_WING_SPEED,
  F35_DRAG_H,
  F35_WOW_DRAG_SCALE,
  F35_WOW_GEAR_DRAG,
  F35_CTOL_ROTATE_SPEED,
  F35_CTOL_ROTATE_PITCH,
  F35_CTOL_ROTATE_THR,
  F35_CTOL_AIR_HYST,
  F35_GEAR_H,
  F35_HOVER_THR,
  F35_LIFT_FAN,
  F35_MASS,
  F35_MAX_THRUST,
  F35_PITCH_RATE,
  F35_ROLL_RATE,
  F35_STOVL_MIN,
  F35_VECTOR_SLEW,
  F35_VL_MIN,
  F35_WING,
  F35_YAW_RATE,
  FLAP_CD,
  FLAP_CL,
  FRICTION,
  GE_BONUS,
  GE_HEIGHT,
  GEAR_H,
  GRAVITY,
  LAND_DAMP,
  LAND_SPRING,
  MASS,
  MAX_THRUST,
  NACELLE_APL_MAX,
  NACELLE_HEL_MIN,
  NACELLE_SLEW,
  PITCH_RATE,
  ROLL_RATE,
  SETTLE,
  WING_AREA,
  YAW_RATE,
  SPAWN_F35_X,
  SPAWN_F35_Z,
  SPAWN_OSP_X,
  SPAWN_OSP_Z,
} from './config'
import type { BirdKind, Controls, Craft, Experience, F35Mode, FlightMode, OspreyMode } from './types'

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function wrapAngle(a: number): number {
  const tau = Math.PI * 2
  let x = ((a + Math.PI) % tau)
  if (x < 0) x += tau
  return x - Math.PI
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function nacelleCmdToDeg(cmd: number): number {
  return clamp(cmd, 0, 1) * 90
}

export function modeFromNacelle(deg: number): OspreyMode {
  if (deg >= NACELLE_HEL_MIN) return 'HEL'
  if (deg <= NACELLE_APL_MAX) return 'APL'
  return 'CONV'
}

export function modeFromVector(v: number): F35Mode {
  if (v >= F35_VL_MIN) return 'VL'
  if (v >= F35_STOVL_MIN) return 'STOVL'
  return 'CTOL'
}

export function modeFromCraft(c: Craft): FlightMode {
  return c.kind === 'f35' ? modeFromVector(c.vectorPos) : modeFromNacelle(c.nacelleDeg)
}

export function createCraft(kind: BirdKind = 'osprey'): Craft {
  const gearH = kind === 'f35' ? F35_GEAR_H : GEAR_H
  const onPad = kind === 'osprey'
  return {
    kind,
    x: onPad ? SPAWN_OSP_X : SPAWN_F35_X,
    y: gearH,
    z: onPad ? SPAWN_OSP_Z : SPAWN_F35_Z,
    vx: 0,
    vy: 0,
    vz: 0,
    pitch: 0,
    roll: 0,
    yaw: 0,
    onGround: true,
    rotorRpm: 0.05,
    // Cold start: airplane / CTOL — nacelles forward, VEC aft (not mid-hover demo)
    nacelleDeg: 0,
    vectorPos: 0,
    aoa: 0,
    gearDown: true,
    flaps: 0,
    fuel: 1,
    engineL: 1,
    engineR: 1,
    apuOn: false,
    electricsOn: true,
    failAsymmetric: false,
    failHyd: false,
    parkingBrake: true,
    lightsOn: false,
  }
}

function plantGear(c: Craft, contactH: number, ctrl: Controls, plantThr: number, dt: number): void {
  if (c.y <= contactH) {
    const pen = contactH - c.y
    const spring = LAND_SPRING * pen
    const damp = LAND_DAMP * Math.min(0, c.vy)
    const mass = c.kind === 'f35' ? F35_MASS : MASS
    c.vy += ((spring - damp) / mass) * dt
    c.y = contactH
    const grip = clamp(1 - Math.abs(c.vy) * 0.4, 0.15, 1)
    c.vx *= Math.exp(-FRICTION * grip * dt)
    c.vz *= Math.exp(-FRICTION * grip * dt)

    if (ctrl.tcl < plantThr) {
      c.vy *= Math.exp(-6 * dt)
      if (Math.abs(c.vy) < 1.2) {
        c.vy = 0
        c.onGround = true
        c.pitch *= Math.exp(-4 * dt)
        c.roll *= Math.exp(-4 * dt)
      } else {
        c.onGround = false
      }
    } else if (Math.abs(c.vy) < 0.3) {
      c.vy = 0
      c.onGround = true
    } else {
      c.onGround = Math.abs(c.vy) < 1.0
    }
  } else {
    c.onGround = false
  }
}

/** Osprey tiltrotor: HEL / CONV / APL via nacelle. */
function stepOsprey(c: Craft, ctrl: Controls, dt: number, experience: Experience): string {
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
    // v11: parked / walking speed + no power — stick does not rock the nose.
    if (speedHoriz < 10 && ctrl.tcl < 0.14) pitchCmd = 0
    else if (helFrac < 0.65) {
      const fromSpeed = clamp((speedHoriz - 12) / 22, 0, 1)
      const fromPower = clamp((ctrl.tcl - 0.1) / 0.4, 0, 1)
      pitchCmd *= 0.05 + 0.95 * Math.max(fromSpeed, fromPower * 0.35)
    } else {
      const fromSpeed = clamp((speedHoriz - 8) / 18, 0, 1)
      pitchCmd *= 0.04 + 0.5 * fromSpeed
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

/**
 * F-35 phone-simple: CTOL / STOVL / VL via thrust vector + lift-fan cue.
 * vector 0 = CTOL (aft thrust), mid = STOVL blend, 1 = VL (lift fan + nozzle down).
 */
function stepF35(c: Craft, ctrl: Controls, dt: number, experience: Experience): string {
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

  // v10: CTOL spool higher so takeoff-roll thrust clears rotate speed
  const wantRpm = 0.1 + ctrl.tcl * (0.75 + vlFrac * 0.2) * powerAvail
  c.rotorRpm += (wantRpm - c.rotorRpm) * (1 - Math.exp(-4 * dt))

  if (ctrl.tcl > 0.05 && c.fuel > 0) {
    c.fuel = Math.max(0, c.fuel - dt * (0.001 + ctrl.tcl * 0.0015))
  }

  const speedHoriz = Math.hypot(c.vx, c.vz)
  const speedKt = speedHoriz * 1.94384
  const agl = Math.max(0, c.y - F35_GEAR_H)
  const contactH = c.gearDown ? F35_GEAR_H : F35_GEAR_H * 0.5

  // CTOL weight-on-wheels (jet-specific — NOT Osprey plantGear spring)
  const ctolVec = vlFrac < F35_STOVL_MIN * 0.85 // ~0.30 — clear of STOVL float
  const nearDeck = c.gearDown && agl < 0.85
  // Hysteresis: stay WOW until clear rotate; re-latch only when firmly planted
  let wowCtol = false
  if (ctolVec && c.gearDown) {
    if (c.onGround) {
      // Stay latched while onGround until rotate criteria met (handled below)
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

  // Attitude — same as Osprey and the drawing: negative pitch = nose UP.
  // Casual stick-up is cyclicPitch < 0, so it raises the nose, the thrust, and the wing.
  const noseUpCmd = -ctrl.cyclicPitch
  const pitchCmd = ctrl.cyclicPitch * F35_PITCH_RATE
  let rollCmd = ctrl.cyclicRoll * F35_ROLL_RATE
  let yawCmd = ctrl.yaw * F35_YAW_RATE * (mode === 'CTOL' ? clamp(speedHoriz / 50, 0.2, 1) : 1)
  if (c.failAsymmetric) rollCmd += 0.2
  if (mode === 'VL') {
    yawCmd += ctrl.tcl * 0.04 * ctrl.cyclicRoll
  }

  if (!wowCtol) {
    const parked = c.onGround && speedHoriz < 10 && ctrl.tcl < 0.14
    if (parked) {
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
    // v10 WOW: pin bank (deck feel); pitch authority only near rotate speed + stick
    const rotateAuth = clamp(
      (speedHoriz - F35_CTOL_ROTATE_SPEED * 0.5) / (F35_CTOL_ROTATE_SPEED * 0.5),
      0,
      1,
    )
    const stickNoseUp = noseUpCmd >= 0.04
    const parked = speedHoriz < 10 && ctrl.tcl < 0.14
    const pitchAuth = parked ? 0 : stickNoseUp ? 0.12 + 0.88 * rotateAuth : 0.08 * rotateAuth
    c.pitch += pitchCmd * dt * pitchAuth
    if (parked) {
      c.pitch *= Math.exp(-8 * dt)
      if (Math.abs(c.pitch) < 0.01) c.pitch = 0
    }
    c.roll *= Math.exp(-10 * dt) // hard pin wings level on deck
    // no airborne rollCmd float while WOW — nosewheel/yaw steers
  }

  const pitchLim = mode === 'STOVL' ? 0.62 : mode === 'VL' ? 0.5 : wowCtol ? 0.42 : 0.58
  c.pitch = clamp(c.pitch, -pitchLim, pitchLim)
  c.roll = clamp(c.roll, -0.9, 0.9)
  const stickPitchLive = Math.abs(ctrl.cyclicPitch) >= 0.04
  const stickRollLive = Math.abs(ctrl.cyclicRoll) >= 0.04
  if (!stickPitchLive && !wowCtol) c.pitch *= Math.exp(-0.2 * dt)
  if (!stickRollLive && !wowCtol) c.roll *= Math.exp(-0.26 * dt)
  // Settle nosewheel only when stick dead — never cancel held Casual nose-up
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
  // +roll raises the right wing (bank left). Drift follows the LOW wing.
  const ux = sy * sp * cr - cy * sr
  const uy = cp * cr
  const uz = cy * sp * cr + sy * sr

  // Main nozzle: tilts from aft (CTOL) toward down (VL) — forced aft on WOW CTOL
  let nozzleDown = wowCtol ? 0 : vlFrac
  let nx = (1 - nozzleDown) * fxB + nozzleDown * ux
  let ny = (1 - nozzleDown) * fyB + nozzleDown * uy
  let nz = (1 - nozzleDown) * fzB + nozzleDown * uz

  const tipBlend = wowCtol ? 0 : mode === 'CTOL' ? 0.12 : 0.4
  // Align tip with nose-up cmd (Casual stick-up tips with attitude)
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

  // Lift fan — killed on WOW CTOL (no residual float / ground-effect hover)
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

  // WOW CTOL: cancel any upward thrust / fan / GE so weight stays on wheels
  if (wowCtol) {
    const upThrust = Math.max(0, ny * mainThrust + uy * fanThrust * (1 + ge))
    fy -= upThrust
    // v10: stronger takeoff-roll push — clear ≥80–90 kt at full THR
    const rollPush = F35_MASS * (6.5 + ctrl.tcl * 11) * ctrl.tcl * powerAvail
    fx += fxB * rollPush
    fz += fzB * rollPush
    // Parking brake holds until throttle breaks it
    if (c.parkingBrake && ctrl.tcl < 0.12) {
      fx -= c.vx * F35_MASS * 8
      fz -= c.vz * F35_MASS * 8
    } else if (c.parkingBrake && ctrl.tcl >= 0.12) {
      c.parkingBrake = false
    }
  }

  if (!wowCtol && ctrl.tcl > 0.55 && agl < 450) {
    // v11: low-altitude full power keeps a bit of path thrust so a modest nose-up doesn't stall.
    const keep = clamp(1 - agl / 450, 0, 1) * clamp((ctrl.tcl - 0.55) / 0.4, 0, 1)
    const extra = mainThrust * 0.18 * keep
    fx += fxB * extra
    fz += fzB * extra
  }

  if (!wowCtol && (mode === 'VL' || (mode === 'STOVL' && speedKt < 60))) {
    fx += ux * ctrl.tcl * F35_MASS * 2.5 * stovlBlend * 0.15
  }

  const airspeed = Math.min(Math.hypot(c.vx, c.vy, c.vz), 180)
  const qDyn = 0.5 * AIR_DENSITY * airspeed * airspeed
  // On WOW CTOL don't invent wing float at walking speed
  const wingOn = wowCtol
    ? clamp(1 - vlFrac * 0.65, 0.22, 1) * clamp(airspeed / 28, 0, 1)
    : clamp(1 - vlFrac * 0.65, 0.22, 1) * clamp(airspeed / 16, 0, 1)

  if (wingOn > 0.02 && airspeed > 3) {
    const vPitch = Math.atan2(-c.vy, Math.max(1, speedHoriz))
    const aoa = clamp(-c.pitch - vPitch, -1.2, 1.2)
    c.aoa = aoa
    const cl = clamp(F35_CL0 + F35_CL * aoa + FLAP_CL * c.flaps * 0.8, -1.1, 1.7)
    // Cut induced drag only while low, powered, and not hung at an extreme nose-up.
    const energyKeep =
      clamp(1 - agl / 450, 0, 1) *
      clamp((ctrl.tcl - 0.5) / 0.45, 0, 1) *
      clamp(1 - Math.abs(aoa) / 1.05, 0.2, 1)
    const cdInduced = 0.055 * (1 - 0.55 * energyKeep)
    const cd = F35_CD0 + cdInduced * cl * cl + FLAP_CD * c.flaps * 0.65
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

  // Conversion lift bridge — never while WOW CTOL (kills leftover VL float)
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

  // —— F-35 CTOL ground (jet-specific): hard pin + critical damp — no plantGear spring ——
  if (wowCtol || (ctolVec && c.gearDown && c.y <= contactH + 0.2 && c.vy < 2)) {
    // Critically damp vertical & pin every frame — kills runway hop / spring fight
    c.y = contactH
    c.vy *= Math.exp(-28 * dt) // critical settle
    if (Math.abs(c.vy) < 0.35) c.vy = 0
    c.onGround = true

    // v10: full-THR rolling friction low enough to clear rotate (~70–90 kt)
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

    // Nosewheel only bites when the jet is actually rolling. Stopped + no power = sit still.
    // cyclicRoll is already casual-flipped (stick right is negative) — negate so stick right yaws nose right.
    const steer = clamp(ctrl.yaw - ctrl.cyclicRoll * 0.55, -1, 1)
    const noseAuth = clamp(speedHoriz / 7, 0, 1)
    const rudAuth = clamp(speedHoriz / 45, 0.15, 1)
    const yawRateGnd = F35_YAW_RATE * (noseAuth * 1.35 + rudAuth * 0.85)
    if (speedHoriz > 0.8 || ctrl.tcl > 0.15) {
      c.yaw = wrapAngle(c.yaw + steer * yawRateGnd * dt)
    }

    // Align velocity with heading when rolling (no sideways skate)
    if (speedHoriz > 0.4) {
      const wantVx = Math.sin(c.yaw) * speedHoriz
      const wantVz = Math.cos(c.yaw) * speedHoriz
      c.vx = lerp(c.vx, wantVx, 1 - Math.exp(-4.5 * dt))
      c.vz = lerp(c.vz, wantVz, 1 - Math.exp(-4.5 * dt))
    }

    // Leave ground ONLY with clear rotate criteria (hysteresis — no flicker)
    const rotateReady =
      speedHoriz > F35_CTOL_ROTATE_SPEED &&
      c.pitch < -F35_CTOL_ROTATE_PITCH &&
      ctrl.tcl > F35_CTOL_ROTATE_THR
    if (rotateReady) {
      c.onGround = false
      c.vy = Math.max(0.8, 1.2 + (ctrl.tcl - F35_CTOL_ROTATE_THR) * 4)
      c.y = contactH + 0.35 // clear latch band so WOW does not re-grab next frame
    }
  } else if (!ctolVec && nearDeck && (mode === 'VL' || mode === 'STOVL')) {
    // VL/STOVL hover-taxi only — Osprey-style plant OK here (not CTOL)
    const plantThr = mode === 'VL' ? 0.55 : 0.38
    plantGear(c, contactH, ctrl, plantThr, dt)
  } else if (!ctolVec) {
    const plantThr = mode === 'VL' ? 0.55 : mode === 'STOVL' ? 0.38 : 0.18
    plantGear(c, contactH, ctrl, plantThr, dt)
  } else if (ctolVec && c.gearDown && c.y < contactH + F35_CTOL_AIR_HYST) {
    // CTOL but briefly airborne under hysteresis ceiling: soft settle, still no spring
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

export function stepCraft(
  c: Craft,
  ctrl: Controls,
  dt: number,
  experience: Experience,
): string {
  const dtClamped = clamp(dt, 0, 0.05)
  const warn =
    c.kind === 'f35' ? stepF35(c, ctrl, dtClamped, experience) : stepOsprey(c, ctrl, dtClamped, experience)
  // v10: never allow gear UP while weight-on-wheels
  if (c.onGround) c.gearDown = true
  return warn
}


/** Refuse gear UP while weight-on-wheels / firmly on deck. Extend always OK. */
export function trySetGearDown(c: Craft, wantDown: boolean): boolean {
  if (wantDown) {
    c.gearDown = true
    return true
  }
  const gearH = c.kind === 'f35' ? F35_GEAR_H : GEAR_H
  const agl = Math.max(0, c.y - gearH)
  if (c.onGround || agl < 1.2) {
    c.gearDown = true
    return false
  }
  c.gearDown = false
  return true
}

export function hardLanding(c: Craft): boolean {
  const contactH = c.kind === 'f35'
    ? c.gearDown
      ? F35_GEAR_H
      : F35_GEAR_H * 0.5
    : c.gearDown
      ? GEAR_H
      : GEAR_H * 0.55
  return c.y <= contactH + 0.08 && (c.vy < -8 || Math.hypot(c.vx, c.vz) > 22)
}


/** Freeze craft if any kinematic field is non-finite. Returns true if a fault was caught. */
export function sanitizeCraft(c: Craft): boolean {
  const fields = [c.x, c.y, c.z, c.vx, c.vy, c.vz, c.pitch, c.roll, c.yaw, c.aoa, c.nacelleDeg, c.vectorPos, c.rotorRpm]
  if (fields.every((v) => Number.isFinite(v))) {
    // Soft clamp attitudes even when finite
    c.pitch = clamp(c.pitch, -1.2, 1.2)
    c.roll = clamp(c.roll, -1.4, 1.4)
    c.yaw = wrapAngle(c.yaw)
    c.nacelleDeg = clamp(c.nacelleDeg, 0, 90)
    c.vectorPos = clamp(c.vectorPos, 0, 1)
    c.rotorRpm = clamp(c.rotorRpm, 0, 1.5)
    c.aoa = clamp(c.aoa, -1.5, 1.5)
    const gearH = c.kind === 'f35' ? F35_GEAR_H : GEAR_H
    if (c.y < gearH * 0.4) c.y = gearH * 0.4
    if (c.y > 8000) c.y = 8000
    return false
  }
  const gearH = c.kind === 'f35' ? F35_GEAR_H : GEAR_H
  c.vx = 0
  c.vy = 0
  c.vz = 0
  c.x = Number.isFinite(c.x) ? c.x : 0
  c.y = Number.isFinite(c.y) ? clamp(c.y, gearH, 500) : gearH
  c.z = Number.isFinite(c.z) ? c.z : 0
  c.pitch = Number.isFinite(c.pitch) ? clamp(c.pitch, -0.5, 0.5) : 0
  c.roll = Number.isFinite(c.roll) ? clamp(c.roll, -0.5, 0.5) : 0
  c.yaw = Number.isFinite(c.yaw) ? wrapAngle(c.yaw) : 0
  c.aoa = 0
  c.rotorRpm = clamp(Number.isFinite(c.rotorRpm) ? c.rotorRpm : 0.2, 0, 1)
  c.nacelleDeg = clamp(Number.isFinite(c.nacelleDeg) ? c.nacelleDeg : 0, 0, 90)
  c.vectorPos = clamp(Number.isFinite(c.vectorPos) ? c.vectorPos : 0, 0, 1)
  c.onGround = c.y <= gearH + 0.2
  return true
}

export function headingDeg(yaw: number): number {
  let d = ((yaw * 180) / Math.PI) % 360
  if (d < 0) d += 360
  return d
}

export function contactHeight(c: Craft): number {
  if (c.kind === 'f35') return c.gearDown ? F35_GEAR_H : F35_GEAR_H * 0.5
  return c.gearDown ? GEAR_H : GEAR_H * 0.55
}
