import { F35_GEAR_H, F35_HOVER_THR, GEAR_H, HOVER_TCL, type QualityKey } from './config'
import { createCam, nextCam, resetCamOffsets, updateCamera } from './camera'
import {
  createCraft,
  hardLanding,
  headingDeg,
  modeFromCraft,
  modeFromNacelle,
  modeFromVector,
  sanitizeCraft,
  stepCraft,
} from './physics'
import type { BirdKind, Controls, Experience, Hud, Sim } from './types'
import { emptyControls } from './input'

export function createSim(
  quality: QualityKey = 'med',
  experience: Experience = 'intermediate',
  bird: BirdKind = 'osprey',
): Sim {
  return {
    phase: 'hangar',
    craft: createCraft(bird),
    cam: createCam(),
    camMode: 'chase',
    controls: emptyControls(bird),
    quality,
    experience,
    bird,
    time: 0,
    crashed: false,
    message: '',
    envelopeWarn: '',
    systemsPanel: 'none',
    paused: false,
    apHeadingHold: false,
    apAltitudeHold: false,
  }
}

export function startFlight(sim: Sim): void {
  sim.phase = 'flight'
  sim.craft = createCraft(sim.bird)
  sim.cam = createCam()
  sim.camMode = 'chase'
  // Cold start — no mid-hover demo preset
  sim.controls = emptyControls(sim.bird)
  sim.crashed = false
  sim.message =
    sim.bird === 'f35'
      ? 'Cold CTOL — THR up to taxi/roll; VEC aft. Raise VEC for STOVL/VL hover.'
      : 'Cold APL — nacelles forward. Raise NAC for HEL hover, or roll with TCL.'
  sim.envelopeWarn = ''
  sim.time = 0
  sim.paused = false
  sim.systemsPanel = 'none'
  sim.apHeadingHold = false
  sim.apAltitudeHold = false
}

export function resetToHangar(sim: Sim): void {
  sim.phase = 'hangar'
  sim.craft = createCraft(sim.bird)
  sim.crashed = false
  sim.message = ''
  sim.paused = false
  sim.systemsPanel = 'none'
}

export function cycleCamera(sim: Sim): void {
  sim.camMode = nextCam(sim.camMode)
  resetCamOffsets(sim.cam)
}

/** Double-tap / Cam double-tap: reset view offsets for current mode. */
export function resetCameraView(sim: Sim): void {
  resetCamOffsets(sim.cam)
}

export function setQuality(sim: Sim, q: QualityKey): void {
  sim.quality = q
}

/** If craft kinematics blew up: freeze, flag recoverable fault, recreate cam on craft. */
export function sanitizeSim(sim: Sim): boolean {
  const fault = sanitizeCraft(sim.craft)
  if (!fault) {
    // Keep cam finite even if craft was OK
    const cam = sim.cam
    if (
      !Number.isFinite(cam.x) ||
      !Number.isFinite(cam.y) ||
      !Number.isFinite(cam.z) ||
      !Number.isFinite(cam.yaw) ||
      !Number.isFinite(cam.pitch)
    ) {
      sim.cam = createCam()
      sim.cam.x = sim.craft.x - Math.sin(sim.craft.yaw) * 24
      sim.cam.z = sim.craft.z - Math.cos(sim.craft.yaw) * 24
      sim.cam.y = sim.craft.y + 8
      sim.cam.yaw = sim.craft.yaw
      sim.cam.pitch = -0.26
    }
    return false
  }
  sim.crashed = true
  sim.message = 'SIM FAULT — Reset'
  sim.envelopeWarn = ''
  // Force cam recreate on craft so renderer is not black/NaN
  sim.cam = createCam()
  sim.cam.x = sim.craft.x - Math.sin(sim.craft.yaw) * 24
  sim.cam.z = sim.craft.z - Math.cos(sim.craft.yaw) * 24
  sim.cam.y = sim.craft.y + 8
  sim.cam.yaw = sim.craft.yaw
  sim.cam.pitch = -0.26
  sim.cam.dist = 28
  return true
}

function finiteOr(v: number, fallback: number): number {
  return Number.isFinite(v) ? v : fallback
}

export function stepSim(sim: Sim, controls: Controls, dt: number): void {
  if (sim.phase !== 'flight' || sim.crashed || sim.paused) return

  let ctrl = { ...controls }
  if (sim.apHeadingHold) {
    ctrl.yaw *= 0.2
    ctrl.cyclicRoll *= 0.35
  }
  if (sim.apAltitudeHold) {
    const target = sim.bird === 'f35' ? 35 : 40
    const err = target - sim.craft.y
    ctrl.tcl = Math.max(0.35, Math.min(0.9, ctrl.tcl + err * 0.004))
  }

  sim.controls = ctrl
  sim.time += dt

  const prevY = sim.craft.y
  const prevVy = sim.craft.vy
  const gearH = sim.bird === 'f35' ? F35_GEAR_H : GEAR_H
  sim.envelopeWarn = stepCraft(sim.craft, ctrl, dt, sim.experience)

  if (sanitizeSim(sim)) {
    return
  }

  if (sim.experience === 'casual') {
    if (sim.envelopeWarn.startsWith('CONV') || sim.envelopeWarn.startsWith('STOVL — thrust')) {
      sim.envelopeWarn = ''
    }
  }

  if (hardLanding(sim.craft) || (sim.craft.y <= gearH + 0.1 && prevVy < -8)) {
    if (sim.experience === 'advanced' || prevVy < -12) {
      sim.crashed = true
      sim.message = 'Hard landing — Reset / Hangar'
      sim.craft.vx = 0
      sim.craft.vz = 0
      sim.craft.vy = 0
    } else {
      sim.message = 'Firm touch — ease power'
      sim.craft.vy *= 0.2
    }
  } else if (sim.craft.onGround && ctrl.tcl < 0.55) {
    if (sim.time > 2 && Math.hypot(sim.craft.vx, sim.craft.vz) < 0.5) {
      sim.message =
        sim.bird === 'f35'
          ? 'On deck — CTOL: THR to taxi/roll; or raise VEC for VL hover'
          : 'On pad — raise NAC to HEL + TCL to lift, or APL roll'
    }
  } else if (sim.bird === 'osprey') {
    const mode = modeFromNacelle(sim.craft.nacelleDeg)
    if (
      !sim.craft.onGround &&
      mode === 'HEL' &&
      Math.abs(sim.craft.vy) < 0.55 &&
      Math.abs(ctrl.tcl - HOVER_TCL) < 0.08
    ) {
      sim.message = 'Hover band — fine-tune TCL'
    } else if (sim.craft.y > prevY && sim.craft.y > 4 && !sim.envelopeWarn) {
      sim.message = ''
    }
  } else {
    const mode = modeFromVector(sim.craft.vectorPos)
    if (
      !sim.craft.onGround &&
      mode === 'VL' &&
      Math.abs(sim.craft.vy) < 0.55 &&
      Math.abs(ctrl.tcl - F35_HOVER_THR) < 0.1
    ) {
      sim.message = 'VL hover — fine-tune THR'
    } else if (sim.craft.y > prevY && sim.craft.y > 4 && !sim.envelopeWarn) {
      sim.message = ''
    }
  }

  if (sim.envelopeWarn && sim.experience !== 'casual') {
    sim.message = sim.envelopeWarn
  }

  updateCamera(sim.cam, sim.craft, sim.camMode, dt)
  // Cam can go non-finite if craft somehow did; recover without crashing loop
  if (
    !Number.isFinite(sim.cam.x) ||
    !Number.isFinite(sim.cam.y) ||
    !Number.isFinite(sim.cam.z)
  ) {
    sim.cam = createCam()
    sim.cam.x = sim.craft.x - Math.sin(sim.craft.yaw) * 24
    sim.cam.z = sim.craft.z - Math.cos(sim.craft.yaw) * 24
    sim.cam.y = sim.craft.y + 8
    sim.cam.yaw = sim.craft.yaw
  }
}

export function hudFrom(sim: Sim): Hud {
  const c = sim.craft
  const gearH = c.kind === 'f35' ? F35_GEAR_H : GEAR_H
  const altRaw = Math.max(0, finiteOr(c.y, gearH) - gearH)
  const alt = Number.isFinite(altRaw) ? altRaw : 0
  const altFt = alt * 3.28084
  const spd = Math.hypot(finiteOr(c.vx, 0), finiteOr(c.vz, 0)) * 1.94384
  const aoaDeg = (() => {
    const air = Math.hypot(finiteOr(c.vx, 0), finiteOr(c.vy, 0), finiteOr(c.vz, 0))
    if (air < 8) return (finiteOr(c.pitch, 0) * 180) / Math.PI
    const a = (finiteOr(c.aoa, 0) * 180) / Math.PI
    return Number.isFinite(a) ? clampHud(a, -90, 90) : 0
  })()
  const vs = Number.isFinite(c.vy) ? c.vy : 0
  return {
    alt: Number.isFinite(alt) ? alt : 0,
    fl: Number.isFinite(altFt) ? Math.max(0, Math.round(altFt / 100)) : 0,
    speed: Number.isFinite(spd) ? clampHud(spd, 0, 999) : 0,
    vs: clampHud(vs, -99, 99),
    hdg: Number.isFinite(c.yaw) ? headingDeg(c.yaw) : 0,
    nacelleDeg: Number.isFinite(c.nacelleDeg) ? clampHud(c.nacelleDeg, 0, 90) : 0,
    vectorPos: Number.isFinite(c.vectorPos) ? clampHud(c.vectorPos, 0, 1) : 0,
    aoaDeg,
    rpm: Number.isFinite(c.rotorRpm) ? clampHud(c.rotorRpm, 0, 1) : 0,
    mode: modeFromCraft(c),
    bird: c.kind,
    tcl: Number.isFinite(sim.controls.tcl) ? sim.controls.tcl : 0,
    onGround: c.onGround,
    cam: sim.camMode,
    quality: sim.quality,
    envelopeWarn: sim.envelopeWarn,
    gearDown: c.gearDown,
    flaps: Number.isFinite(c.flaps) ? clampHud(c.flaps, 0, 1) : 0,
  }
}

function clampHud(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return 0
  return v < lo ? lo : v > hi ? hi : v
}
