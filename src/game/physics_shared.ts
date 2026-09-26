import {
  F35_GEAR_H,
  F35_MASS,
  F35_STOVL_MIN,
  F35_VL_MIN,
  FRICTION,
  GEAR_H,
  LAND_DAMP,
  LAND_SPRING,
  MASS,
  NACELLE_APL_MAX,
  NACELLE_HEL_MIN,
  SPAWN_F35_X,
  SPAWN_F35_Z,
  SPAWN_OSP_X,
  SPAWN_OSP_Z,
} from './config'
import type { BirdKind, Controls, Craft, F35Mode, FlightMode, OspreyMode } from './types'

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

export function plantGear(c: Craft, contactH: number, ctrl: Controls, plantThr: number, dt: number): void {
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
