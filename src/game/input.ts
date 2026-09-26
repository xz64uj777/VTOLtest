import type { BirdKind, Controls } from './types'
import { clamp } from './physics'
import { applyDeadzone, SENS_SCALE, type FlightPrefs } from './prefs'

/** Rolling window for sustained gyro (ms). */
export const GYRO_SUSTAIN_MS = 500
/** Min orientation events inside the window before live / gyroReady. */
export const GYRO_SUSTAIN_COUNT = 3

export type InputState = {
  keys: Set<string>
  stickX: number
  stickY: number
  yawStick: number
  tclStick: number
  touchTcl: number | null
  touchNacelle: number | null
  touchVector: number | null
  /** Live device orientation (deg). */
  gyroBeta: number
  gyroGamma: number
  gyroActive: boolean
  /** performance.now() of last non-null orientation event; 0 = never. */
  gyroLastMs: number
  /** Recent orientation event timestamps (pruned to sustain window). */
  gyroEvents: number[]
  /** 0..1 reconnect ramp; prevents a resumed phone pose from spiking cyclic. */
  gyroBlend: number
}

export function createInput(): InputState {
  return {
    keys: new Set(),
    stickX: 0,
    stickY: 0,
    yawStick: 0,
    tclStick: 0,
    touchTcl: null,
    touchNacelle: null,
    touchVector: null,
    gyroBeta: 0,
    gyroGamma: 0,
    gyroActive: false,
    gyroLastMs: 0,
    gyroEvents: [],
    gyroBlend: 1,
  }
}

export function emptyControls(_bird: BirdKind = 'osprey'): Controls {
  // Cold start: 0 throttle, flaps 0, rotation/nacelle airplane (CTOL / APL)
  return {
    cyclicPitch: 0,
    cyclicRoll: 0,
    tcl: 0,
    yaw: 0,
    nacelle: 0,
    vector: 0,
    flaps: 0,
  }
}

/**
 * Casual (default): stick-up / W → nose UP. TCL/throttle absolute-hold.
 * Osprey: nacelle slider. F-35: vector/lift-fan slider (not nacelle).
 * Tilt: when prefs.tiltCyclic + gyroReady, phone gyro drives cyclic (additive).
 */
export function sampleControls(
  input: InputState,
  prev: Controls,
  dt: number,
  prefs: FlightPrefs,
  bird: BirdKind,
): Controls {
  const k = input.keys
  const sens = SENS_SCALE[prefs.sens]
  const casual = prefs.pitchMode !== 'realistic'
  // v11: Casual stick-up = nose UP. Roll stays Casual (stick-right = bank right).
  // Invert pitch in Systems if a phone still feels backwards.
  const pitchSign = (casual ? -1 : 1) * (prefs.invertPitch ? -1 : 1)
  const rollSign = (casual ? -1 : 1) * (prefs.invertRoll ? -1 : 1)

  let stickPitch = applyDeadzone(input.stickY) * sens
  let stickRoll = applyDeadzone(input.stickX) * sens
  let yaw = applyDeadzone(input.yawStick) * sens

  // Phone tilt. Axes follow the SCREEN (landscape), not the phone's portrait top.
  // +stickPitch = stick back (nose up after Casual). +stickRoll = stick right.
  if (prefs.tiltCyclic && input.gyroActive && prefs.gyroReady) {
    input.gyroBlend = Math.min(1, input.gyroBlend + dt / 0.32)
    const maxTilt = 28
    const stick = tiltToStick(input.gyroBeta - prefs.gyroZeroBeta, input.gyroGamma - prefs.gyroZeroGamma)
    let gyPitch = clamp(stick.back / maxTilt, -1, 1) * sens * input.gyroBlend
    let gyRoll = clamp(stick.right / maxTilt, -1, 1) * sens * input.gyroBlend
    gyPitch = applyDeadzone(gyPitch, 0.1)
    gyRoll = applyDeadzone(gyRoll, 0.1)
    stickPitch += gyPitch
    stickRoll += gyRoll
  }

  let cyclicPitch = stickPitch * pitchSign
  let cyclicRoll = stickRoll * rollSign
  let tcl = prev.tcl
  let nacelle = prev.nacelle
  let vector = prev.vector
  let flaps = prev.flaps

  if (k.has('KeyW') || k.has('ArrowUp')) cyclicPitch += 1 * pitchSign * sens
  if (k.has('KeyS') || k.has('ArrowDown')) cyclicPitch -= 1 * pitchSign * sens
  if (k.has('ArrowRight') || k.has('KeyL')) cyclicRoll += 1 * rollSign * sens
  if (k.has('ArrowLeft') || k.has('KeyJ')) cyclicRoll -= 1 * rollSign * sens

  if (k.has('KeyA') || k.has('KeyQ')) yaw -= 1 * sens
  if (k.has('KeyD') || k.has('KeyE')) yaw += 1 * sens

  const tclRate = 0.55
  let tclDelta = 0
  if (k.has('KeyR') || k.has('Space')) tclDelta += tclRate * dt
  if (k.has('KeyF') || k.has('ControlLeft') || k.has('ControlRight')) tclDelta -= tclRate * dt
  if (Math.abs(input.tclStick) > 0.02) tclDelta += input.tclStick * tclRate * dt

  if (input.touchTcl != null) {
    if (tclDelta !== 0) input.touchTcl = clamp(input.touchTcl + tclDelta, 0, 1)
    tcl = input.touchTcl
  } else {
    tcl += tclDelta
  }

  const modeRate = 0.35
  let modeDelta = 0
  // N/[ = toward HEL (Osprey) or VL (F-35); M/] = toward APL / CTOL
  if (k.has('KeyN') || k.has('BracketLeft')) modeDelta += modeRate * dt
  if (k.has('KeyM') || k.has('BracketRight')) modeDelta -= modeRate * dt

  if (bird === 'osprey') {
    if (input.touchNacelle != null) {
      if (modeDelta !== 0) input.touchNacelle = clamp(input.touchNacelle + modeDelta, 0, 1)
      nacelle = input.touchNacelle
    } else {
      nacelle = clamp(nacelle + modeDelta, 0, 1)
    }
  } else {
    if (input.touchVector != null) {
      if (modeDelta !== 0) input.touchVector = clamp(input.touchVector + modeDelta, 0, 1)
      vector = input.touchVector
    } else {
      vector = clamp(vector + modeDelta, 0, 1)
    }
  }

  if (k.has('Comma') || k.has('KeyZ')) flaps = clamp(flaps + 0.5 * dt, 0, 1)
  if (k.has('Period') || k.has('KeyX')) flaps = clamp(flaps - 0.5 * dt, 0, 1)

  return {
    cyclicPitch: clamp(cyclicPitch, -1, 1),
    cyclicRoll: clamp(cyclicRoll, -1, 1),
    yaw: clamp(yaw, -1, 1),
    tcl: clamp(tcl, 0, 1),
    nacelle: clamp(nacelle, 0, 1),
    vector: clamp(vector, 0, 1),
    flaps: clamp(flaps, 0, 1),
  }
}

export function resetSpringSticks(input: InputState): void {
  input.stickX = 0
  input.stickY = 0
  input.yawStick = 0
}

export function bindKeyboard(input: InputState, target: Window | HTMLElement = window): () => void {
  const down = (e: Event) => {
    const ev = e as KeyboardEvent
    input.keys.add(ev.code)
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.code)) {
      ev.preventDefault()
    }
  }
  const up = (e: Event) => {
    const ev = e as KeyboardEvent
    input.keys.delete(ev.code)
  }
  const blur = () => {
    input.keys.clear()
    resetSpringSticks(input)
  }
  target.addEventListener('keydown', down)
  target.addEventListener('keyup', up)
  window.addEventListener('blur', blur)
  return () => {
    target.removeEventListener('keydown', down)
    target.removeEventListener('keyup', up)
    window.removeEventListener('blur', blur)
  }
}

export async function requestGyroPermission(): Promise<'ok' | 'denied' | 'unsupported'> {
  const DOE = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<'granted' | 'denied'>
  }
  if (typeof DOE.requestPermission === 'function') {
    try {
      const r = await DOE.requestPermission()
      return r === 'granted' ? 'ok' : 'denied'
    } catch {
      return 'denied'
    }
  }
  if (typeof window.DeviceOrientationEvent === 'undefined') return 'unsupported'
  return 'ok'
}

export type GyroBind = {
  stop: () => void
  tryAbsoluteFallback: () => void
}

/**
 * Device beta/gamma are in the phone's portrait frame.
 * +beta = top of the phone toward the ground. +gamma = right edge down.
 * Return stick axes for the SCREEN: +back = top of the screen up, +right = right edge down.
 */
export function tiltToStick(beta: number, gamma: number): { back: number; right: number } {
  let angle = 0
  if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.angle === 'number') {
    angle = screen.orientation.angle
  } else if (typeof window !== 'undefined' && typeof (window as Window & { orientation?: number }).orientation === 'number') {
    const o = (window as Window & { orientation?: number }).orientation ?? 0
    angle = ((-o % 360) + 360) % 360
  }
  const a = ((angle % 360) + 360) % 360
  let screenBeta = beta
  let screenGamma = gamma
  if (a === 90) {
    screenBeta = -gamma
    screenGamma = beta
  } else if (a === 270) {
    screenBeta = gamma
    screenGamma = -beta
  } else if (a === 180) {
    screenBeta = -beta
    screenGamma = -gamma
  }
  return { back: -screenBeta, right: screenGamma }
}

function applyOrient(input: InputState, beta: number | null, gamma: number | null): void {
  if (beta == null || gamma == null) return
  const now = performance.now()
  input.gyroBeta = beta
  input.gyroGamma = gamma
  input.gyroActive = true
  input.gyroLastMs = now
  input.gyroEvents.push(now)
  const cutoff = now - GYRO_SUSTAIN_MS
  while (input.gyroEvents.length > 0 && input.gyroEvents[0]! < cutoff) {
    input.gyroEvents.shift()
  }
}

/** Bind deviceorientation → input.gyro*. Caller manages prefs.tiltCyclic / gyroReady. */
export function bindGyro(input: InputState): GyroBind {
  const onOrient = (e: DeviceOrientationEvent) => applyOrient(input, e.beta, e.gamma)
  const onAbsolute = (e: Event) => {
    const ev = e as DeviceOrientationEvent
    applyOrient(input, ev.beta, ev.gamma)
  }

  const attach = () => {
    // Re-arm without permanently removing: remove+add refreshes the OS subscription
    // when phones throttle orientation under convert load.
    window.removeEventListener('deviceorientation', onOrient)
    window.removeEventListener('deviceorientationabsolute', onAbsolute)
    window.addEventListener('deviceorientation', onOrient)
    window.addEventListener('deviceorientationabsolute', onAbsolute)
  }

  attach()

  // Re-add both listeners (used when silence >1s during holdover).
  const tryAbsoluteFallback = () => {
    attach()
  }

  return {
    stop: () => {
      window.removeEventListener('deviceorientation', onOrient)
      window.removeEventListener('deviceorientationabsolute', onAbsolute)
    },
    tryAbsoluteFallback,
  }
}

export function gyroIsLive(input: InputState, now = performance.now(), maxAgeMs = 1000): boolean {
  return input.gyroLastMs > 0 && now - input.gyroLastMs < maxAgeMs
}

/** True when ≥ GYRO_SUSTAIN_COUNT orientation events arrived within GYRO_SUSTAIN_MS. */
export function gyroIsSustained(
  input: InputState,
  now = performance.now(),
  windowMs = GYRO_SUSTAIN_MS,
  minCount = GYRO_SUSTAIN_COUNT,
): boolean {
  let n = 0
  for (let i = input.gyroEvents.length - 1; i >= 0; i--) {
    if (now - input.gyroEvents[i]! > windowMs) break
    n++
    if (n >= minCount) return true
  }
  return false
}

export function resetGyroTracking(input: InputState): void {
  input.gyroActive = false
  input.gyroLastMs = 0
  input.gyroEvents.length = 0
  input.gyroBlend = 1
}
