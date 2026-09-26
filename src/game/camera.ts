import { clamp, lerp, modeFromCraft, wrapAngle } from './physics'
import type { Cam, CamMode, Craft } from './types'

/** Minimum camera height above craft CG — never under the belly. */
const CAM_MIN_ABOVE = 4.2
/** Chase look pitch clamp: negative = looking down at craft; never strongly up-from-below. */
const CHASE_PITCH_MIN = -0.72
const CHASE_PITCH_MAX = 0.08

export function createCam(): Cam {
  return {
    x: 0,
    y: 10,
    z: -28,
    yaw: 0,
    pitch: -0.26,
    dist: 34,
    yawOff: 0,
    pitchOff: 0,
  }
}

type CamX = Cam & { orbitAng?: number }

/** Max chase tether as a multiple of wantDist — cam never drifts farther than this from craft. */
const CHASE_TETHER = 1.15

/** Reset touch offsets to default for current mode. */
export function resetCamOffsets(cam: Cam): void {
  cam.yawOff = 0
  cam.pitchOff = 0
}

/** Body point → world. +Z nose, +Y up, +X right. Matches the drawn aircraft. */
export function craftBodyPoint(craft: Craft, lx: number, ly: number, lz: number): { x: number; y: number; z: number } {
  const cy = Math.cos(craft.yaw)
  const sy = Math.sin(craft.yaw)
  const cp = Math.cos(craft.pitch)
  const sp = Math.sin(craft.pitch)
  const cr = Math.cos(craft.roll)
  const sr = Math.sin(craft.roll)
  let x = lx * cr - ly * sr
  let y = lx * sr + ly * cr
  let z = lz
  const y2 = y * cp - z * sp
  const z2 = y * sp + z * cp
  y = y2
  z = z2
  const x3 = x * cy + z * sy
  const z3 = -x * sy + z * cy
  return { x: craft.x + x3, y: craft.y + y, z: craft.z + z3 }
}

/**
 * Chase → Cockpit → Wing → Tower → Pad → Orbit.
 * v10: remove altitude-linked height/shake; no micro-snap oscillation; heavier damp; no chase lead.
 * v9: chase stays above+behind (clamp y / pitch).
 * v7: touch yaw/pitch offsets; wing + tower modes.
 * v6: craft-in-view snap + kill velocity lead on convert/decel + hard tether.
 */
export function updateCamera(cam: Cam, craft: Craft, mode: CamMode, dt: number): void {
  if (
    !Number.isFinite(craft.x) ||
    !Number.isFinite(craft.y) ||
    !Number.isFinite(craft.z) ||
    !Number.isFinite(craft.yaw)
  ) {
    return
  }
  if (!Number.isFinite(cam.yawOff)) cam.yawOff = 0
  if (!Number.isFinite(cam.pitchOff)) cam.pitchOff = 0

  const speed = Math.hypot(craft.vx, craft.vz)
  // v10: stable look soften — no altitude-ramping that jitters past ~200 ft
  const altDamp = 0.85
  let tx = craft.x
  let ty = craft.y + 2.8
  let tz = craft.z
  let wantYaw = cam.yaw
  let wantPitch = cam.pitch
  let wantDist = cam.dist
  const cx = cam as CamX
  const yOff = cam.yawOff
  // Pitch offset: never allow touch drag to drop cam under craft
  const pOff = clamp(cam.pitchOff, -0.35, 0.45)

  if (mode === 'cockpit') {
    // Eyes in the cabin, looking out the nose. Touch drag looks around.
    const eye = craftBodyPoint(craft, 0, 0.72, 1.15)
    const look = craftBodyPoint(craft, yOff * 8, 0.42 + pOff * 5, 18)
    cam.x = eye.x
    cam.y = eye.y
    cam.z = eye.z
    const dx = look.x - eye.x
    const dy = look.y - eye.y
    const dz = look.z - eye.z
    const horiz = Math.hypot(dx, dz) || 1
    cam.yaw = Math.atan2(dx, dz)
    cam.pitch = clamp(Math.atan2(dy, horiz), -0.7, 0.55)
    cam.dist = 2
    return
  }

  if (mode === 'chase') {
    const back = 20 + clamp(speed * 0.4, 0, 16)
    // v10: height from speed only — no agl term (was camera "shake" past ~200 ft)
    const height = 6.5 + clamp(speed * 0.09, 0, 5)
    const lookX = craft.x
    const lookY = craft.y + 1.6
    const lookZ = craft.z
    const yawBase = craft.yaw + yOff
    tx = craft.x - Math.sin(yawBase) * back
    tz = craft.z - Math.cos(yawBase) * back
    ty = craft.y + height + pOff * 10
    ty = Math.max(ty, craft.y + CAM_MIN_ABOVE)
    const dx = lookX - tx
    const dy = lookY - ty
    const dz = lookZ - tz
    const horiz = Math.hypot(dx, dz) || 1
    wantYaw = Math.atan2(dx, dz)
    // Soften look pitch at altitude; clamp so we never look up from below
    wantPitch = clamp(Math.atan2(dy, horiz) * altDamp, CHASE_PITCH_MIN, CHASE_PITCH_MAX)
    wantDist = back
  } else if (mode === 'wing') {
    const side = 18 + clamp(speed * 0.12, 0, 8)
    const back = 6 + clamp(speed * 0.08, 0, 6)
    const yawBase = craft.yaw + Math.PI * 0.5 + yOff
    tx = craft.x - Math.sin(yawBase) * side - Math.sin(craft.yaw) * back
    tz = craft.z - Math.cos(yawBase) * side - Math.cos(craft.yaw) * back
    ty = craft.y + 4.5 + pOff * 8
    ty = Math.max(ty, craft.y + CAM_MIN_ABOVE * 0.85)
    const dx = craft.x - tx
    const dy = craft.y + 1.2 - ty
    const dz = craft.z - tz
    const horiz = Math.hypot(dx, dz) || 1
    wantYaw = Math.atan2(dx, dz)
    wantPitch = clamp(Math.atan2(dy, horiz) * altDamp, CHASE_PITCH_MIN, 0.12)
    wantDist = Math.hypot(side, back)
  } else if (mode === 'tower') {
    const towerX = -55
    const towerY = 38
    const towerZ = 70
    tx = towerX + Math.sin(yOff) * 8
    ty = towerY + pOff * 12
    tz = towerZ + Math.cos(yOff) * 8
    const dx = craft.x - tx
    const dy = craft.y + 1.8 - ty
    const dz = craft.z - tz
    const horiz = Math.hypot(dx, dz) || 1
    wantYaw = Math.atan2(dx, dz)
    wantPitch = Math.atan2(dy, horiz)
    wantDist = Math.hypot(dx, dy, dz)
  } else if (mode === 'pad') {
    tx = -38 + Math.sin(yOff) * 6
    ty = 22 + pOff * 10
    tz = -38 + Math.cos(yOff) * 6
    const dx = craft.x - tx
    const dy = craft.y + 1.8 - ty
    const dz = craft.z - tz
    const horiz = Math.hypot(dx, dz) || 1
    wantYaw = Math.atan2(dx, dz)
    wantPitch = Math.atan2(dy, horiz)
    wantDist = 52
  } else {
    // orbit — auto spin + touch yaw offset
    const orbitSpeed = 0.22
    const base = wrapAngle((cx.orbitAng ?? craft.yaw + 0.9) + orbitSpeed * dt)
    cx.orbitAng = base
    const ang = wrapAngle(base + yOff)
    wantDist = 28 + clamp(speed * 0.28, 0, 12)
    tx = craft.x - Math.sin(ang) * wantDist
    tz = craft.z - Math.cos(ang) * wantDist
    ty = craft.y + 11 + pOff * 10
    ty = Math.max(ty, craft.y + CAM_MIN_ABOVE)
    const dx = craft.x - tx
    const dy = craft.y + 1.4 - ty
    const dz = craft.z - tz
    const horiz = Math.hypot(dx, dz) || 1
    wantYaw = Math.atan2(dx, dz)
    wantPitch = clamp(Math.atan2(dy, horiz), CHASE_PITCH_MIN, 0.1)
  }

  // Velocity lead: cut hard when decelerating, sinking, or mid convert / STOVL.
  if (mode === 'chase' || mode === 'orbit' || mode === 'wing') {
    const flightMode = modeFromCraft(craft)
    const midConvert =
      flightMode === 'CONV' ||
      flightMode === 'STOVL' ||
      (craft.kind === 'osprey' && craft.nacelleDeg > 8 && craft.nacelleDeg < 82) ||
      (craft.kind === 'f35' && craft.vectorPos > 0.12 && craft.vectorPos < 0.88)
    const decelerating =
      speed > 2 && craft.vx * Math.sin(craft.yaw) + craft.vz * Math.cos(craft.yaw) < -0.5
    const sinking = craft.vy < -1.5
    if (midConvert || decelerating || sinking) {
      // No velocity lead
    } else if (mode === 'orbit') {
      const leadT = clamp(speed * 0.03, 0.015, 0.16)
      tx += craft.vx * leadT
      tz += craft.vz * leadT
      ty += craft.vy * leadT * 0.15 * altDamp
    } else if (mode === 'wing') {
      const leadT = clamp(speed * 0.02, 0.01, 0.08)
      tx += craft.vx * leadT
      tz += craft.vz * leadT
    } else {
      // v10 chase: no velocity lead (micro-lead caused altitude jitter)
    }
  }

  // Re-assert above-behind after lead
  if (mode === 'chase' || mode === 'wing' || mode === 'orbit') {
    ty = Math.max(ty, craft.y + CAM_MIN_ABOVE * (mode === 'wing' ? 0.85 : 1))
  }

  const toCraftX = craft.x - cam.x
  const toCraftY = craft.y + 1.6 - cam.y
  const toCraftZ = craft.z - cam.z
  const craftDist = Math.hypot(toCraftX, toCraftY, toCraftZ)
  const lookHx = Math.sin(cam.yaw)
  const lookHz = Math.cos(cam.yaw)
  const horizToCraft = Math.hypot(toCraftX, toCraftZ) || 1e-6
  const forwardDot = (toCraftX * lookHx + toCraftZ * lookHz) / horizToCraft
  const craftBehind = forwardDot < 0.15
  const craftTooFar = craftDist > wantDist * 1.35
  const camUnder = cam.y < craft.y + CAM_MIN_ABOVE * 0.5

  const err = Math.hypot(tx - cam.x, ty - cam.y, tz - cam.z)
  const frameW = Math.max(wantDist, 14)
  const errFrames = err / frameW
  // v10: harder snap threshold — avoid micro-snap oscillation at altitude
  const targetMiss = errFrames >= 1.35 || err > frameW * 1.85
  const snap = targetMiss || craftBehind || craftTooFar || camUnder
  // craftTooClose handled by soft lerp, not snap (was jitter source)

  if (snap) {
    cam.x = tx
    cam.y = Math.max(ty, craft.y + CAM_MIN_ABOVE * 0.9)
    cam.z = tz
    cam.yaw = wantYaw
    cam.pitch = clamp(wantPitch, CHASE_PITCH_MIN, CHASE_PITCH_MAX)
    cam.dist = wantDist
    return
  }

  // v10: heavier chase damp, gentler err boost (no oscillation)
  let k = mode === 'pad' || mode === 'tower' ? 5.5 : mode === 'chase' ? 7.5 : mode === 'wing' ? 8 : 6.5
  k *= 1 + clamp(errFrames * 0.45, 0, 1.6)
  const a = 1 - Math.exp(-k * dt)
  cam.x = lerp(cam.x, tx, a)
  cam.y = lerp(cam.y, ty, a)
  cam.z = lerp(cam.z, tz, a)

  // Hard floor: never under craft
  if (mode === 'chase' || mode === 'wing' || mode === 'orbit') {
    cam.y = Math.max(cam.y, craft.y + CAM_MIN_ABOVE)
  }

  const lookAtX = craft.x - cam.x
  const lookAtY = craft.y + 1.6 - cam.y
  const lookAtZ = craft.z - cam.z
  const lookHoriz = Math.hypot(lookAtX, lookAtZ) || 1
  const craftYaw = Math.atan2(lookAtX, lookAtZ)
  let craftPitch = Math.atan2(lookAtY, lookHoriz)
  if (mode === 'chase' || mode === 'wing' || mode === 'orbit') {
    craftPitch = clamp(craftPitch, CHASE_PITCH_MIN, CHASE_PITCH_MAX)
  }
  const lookK =
    mode === 'pad' || mode === 'tower' ? 1 : mode === 'orbit' ? 5.5 : mode === 'wing' ? 7.5 : 7
  const ka = mode === 'pad' || mode === 'tower' ? 1 : 1 - Math.exp(-lookK * dt)
  cam.yaw += wrapAngle(craftYaw - cam.yaw) * ka
  cam.pitch = lerp(cam.pitch, craftPitch, ka)
  if (mode === 'chase' || mode === 'wing' || mode === 'orbit') {
    cam.pitch = clamp(cam.pitch, CHASE_PITCH_MIN, CHASE_PITCH_MAX)
  }
  cam.dist = lerp(cam.dist, wantDist, ka)

  if (mode === 'chase' || mode === 'orbit' || mode === 'wing') {
    const dx = cam.x - craft.x
    let dy = cam.y - (craft.y + 2.8)
    const dz = cam.z - craft.z
    // Prefer keeping above: if dy would go negative relative to min, bias up
    const minDy = CAM_MIN_ABOVE - 2.8
    if (dy < minDy) dy = minDy
    const d = Math.hypot(dx, dy, dz)
    const maxD = wantDist * CHASE_TETHER
    const minD = wantDist * 0.55
    if (d > maxD && d > 1e-3) {
      const s = maxD / d
      cam.x = craft.x + dx * s
      cam.y = craft.y + 2.8 + dy * s
      cam.z = craft.z + dz * s
    } else if (d < minD && d > 1e-3 && (mode === 'chase' || mode === 'wing')) {
      const s = minD / d
      cam.x = craft.x + dx * s
      cam.y = craft.y + 2.8 + dy * s
      cam.z = craft.z + dz * s
    }
    cam.y = Math.max(cam.y, craft.y + CAM_MIN_ABOVE)
  }
}

export const CAM_ORDER: CamMode[] = ['chase', 'cockpit', 'wing', 'tower', 'pad', 'orbit']

export const CAM_LABEL: Record<CamMode, string> = {
  chase: 'CHASE',
  cockpit: 'COCKPIT',
  wing: 'WING',
  tower: 'TOWER',
  pad: 'PAD',
  orbit: 'ORBIT',
}

export function nextCam(mode: CamMode): CamMode {
  const i = CAM_ORDER.indexOf(mode)
  return CAM_ORDER[(i + 1) % CAM_ORDER.length]!
}
