import type { QualityKey } from './config'

export type Phase = 'hangar' | 'flight'
/** Camera modes — chase, cockpit, wing/side, tower, pad, orbit. */
export type CamMode = 'chase' | 'cockpit' | 'wing' | 'tower' | 'pad' | 'orbit'
export type BirdKind = 'osprey' | 'f35'

/** Osprey flight mode from nacelle. */
export type OspreyMode = 'HEL' | 'CONV' | 'APL'
/** F-35 flight mode from thrust vector / lift-fan. */
export type F35Mode = 'CTOL' | 'STOVL' | 'VL'
export type FlightMode = OspreyMode | F35Mode

export type Experience = 'casual' | 'intermediate' | 'advanced'

export type Controls = {
  /** Cyclic / stick fore/aft: + = nose down (after pitchMode sign). */
  cyclicPitch: number
  /** Stick lateral: + = roll right. */
  cyclicRoll: number
  /** Power 0..1 — TCL (Osprey) or throttle (F-35). Absolute hold. */
  tcl: number
  /** Pedals: + = nose right. */
  yaw: number
  /** Osprey: nacelle 0..1 → 0° APL .. 90° HEL. Absolute hold. */
  nacelle: number
  /** F-35: thrust-vector / lift-fan 0..1 — 0=CTOL, ~0.5=STOVL, 1=VL. Absolute hold. */
  vector: number
  /** Flap position 0..1. */
  flaps: number
}

export type Craft = {
  kind: BirdKind
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  pitch: number
  roll: number
  yaw: number
  onGround: boolean
  rotorRpm: number
  /** Osprey nacelle degrees: 90=HEL, 0=APL. */
  nacelleDeg: number
  /** F-35 vector 0..1 (mirrors controls.vector with slew). */
  vectorPos: number
  /** Approx AoA radians (for F-35 HUD). */
  aoa: number
  gearDown: boolean
  flaps: number
  fuel: number
  engineL: number
  engineR: number
  apuOn: boolean
  electricsOn: boolean
  failAsymmetric: boolean
  failHyd: boolean
  /** Stub: parking brake (ground only cue). */
  parkingBrake: boolean
  /** Stub: nav/landing lights. */
  lightsOn: boolean
}

export type Cam = {
  x: number
  y: number
  z: number
  yaw: number
  pitch: number
  dist: number
  /** Touch orbit yaw offset (radians) — chase/wing/orbit. */
  yawOff: number
  /** Touch pitch offset (radians). */
  pitchOff: number
}

export type Hud = {
  alt: number
  /** Flight level = round(alt_ft / 100). */
  fl: number
  speed: number
  /** Vertical speed m/s. */
  vs: number
  hdg: number
  nacelleDeg: number
  /** F-35 vector 0..1; Osprey unused (HUD shows NAC). */
  vectorPos: number
  aoaDeg: number
  rpm: number
  mode: FlightMode
  bird: BirdKind
  tcl: number
  onGround: boolean
  cam: CamMode
  quality: QualityKey
  envelopeWarn: string
  gearDown: boolean
  flaps: number
}

export type SystemsPanel =
  | 'none'
  | 'flight'
  | 'engines'
  | 'fuel'
  | 'gear'
  | 'electrics'
  | 'autopilot'
  | 'failures'
  | 'emer'

export type Sim = {
  phase: Phase
  craft: Craft
  cam: Cam
  camMode: CamMode
  controls: Controls
  quality: QualityKey
  experience: Experience
  bird: BirdKind
  time: number
  crashed: boolean
  message: string
  envelopeWarn: string
  systemsPanel: SystemsPanel
  paused: boolean
  apHeadingHold: boolean
  apAltitudeHold: boolean
}
