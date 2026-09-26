import { GEAR_H } from './config'
import { clamp } from './physics'
import type { Cam, Craft } from './types'
import { fillPoly, project, type Pt, type Vec2 } from './render_math'

export function drawOsprey(ctx: CanvasRenderingContext2D, craft: Craft, cam: Cam, w: number, h: number, shadows: boolean, rotorPhase: number, inside = false) {
  const cy = Math.cos(craft.yaw)
  const sy = Math.sin(craft.yaw)
  const cp = Math.cos(craft.pitch)
  const sp = Math.sin(craft.pitch)
  const cr = Math.cos(craft.roll)
  const sr = Math.sin(craft.roll)

  const xf = (lx: number, ly: number, lz: number): Pt => {
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

  if (shadows && craft.y < 50) {
    const sh = project({ x: craft.x, y: 0.05, z: craft.z }, cam, w, h)
    if (sh) {
      const s = clamp(110 / sh.d, 5, 36) * (1 - clamp(craft.y / 50, 0, 0.85))
      ctx.fillStyle = 'rgba(0,0,0,0.28)'
      ctx.beginPath()
      ctx.ellipse(sh.x, sh.y, s * 1.5, s * 0.4, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const parts: { a: Pt; b: Pt; color: string; width: number }[] = []
  const P = (x: number, y: number, z: number) => project(xf(x, y, z), cam, w, h)
  if (!inside) {
    fillPoly(ctx, [P(-0.9, 0.55, -3.8), P(0.9, 0.55, -3.8), P(0.45, 0.32, 4.1), P(-0.45, 0.32, 4.1)], 'rgba(122,128,118,0.95)')
    fillPoly(ctx, [P(-0.75, 0.05, -3.4), P(0.75, 0.05, -3.4), P(0.35, -0.45, 3.4), P(-0.35, -0.45, 3.4)], 'rgba(62,66,60,0.92)')
  } else {
    fillPoly(ctx, [P(-0.35, 0.35, 2.2), P(0.35, 0.35, 2.2), P(0.12, 0.15, 5.4), P(-0.12, 0.15, 5.4)], 'rgba(140,146,136,0.95)')
  }
  fillPoly(ctx, [P(-7.6, 0.85, -0.9), P(7.6, 0.85, -0.9), P(6.2, 0.72, 1.6), P(-6.2, 0.72, 1.6)], 'rgba(108,114,104,0.9)')
  fillPoly(ctx, [P(0, 0.45, -3.2), P(-1.7, 1.7, -5.1), P(1.7, 1.7, -5.1)], 'rgba(96,102,94,0.9)')

  // Landing gear
  if (craft.gearDown) {
    parts.push({ a: xf(-1.4, -2.0, 1.5), b: xf(-1.4, -0.3, 1.2), color: '#444', width: 2 })
    parts.push({ a: xf(1.4, -2.0, 1.5), b: xf(1.4, -0.3, 1.2), color: '#444', width: 2 })
    parts.push({ a: xf(0, -2.0, -2.2), b: xf(0, -0.2, -1.8), color: '#444', width: 2 })
    parts.push({ a: xf(-1.6, -2.05, 1.5), b: xf(-1.2, -2.05, 1.5), color: '#222', width: 3 })
    parts.push({ a: xf(1.2, -2.05, 1.5), b: xf(1.6, -2.05, 1.5), color: '#222', width: 3 })
  }

  // Fuselage
  parts.push({ a: xf(0, 0.1, -4.5), b: xf(0, 0.3, 4.2), color: '#8a9088', width: 7 })
  parts.push({ a: xf(-1.1, 0.4, 1.5), b: xf(1.1, 0.4, 1.5), color: '#2a5080', width: 5 })
  parts.push({ a: xf(-1.1, 0.4, 3.2), b: xf(1.1, 0.4, 3.2), color: '#2a5080', width: 5 })
  // Tail
  parts.push({ a: xf(0, 0.4, -3.5), b: xf(0, 2.2, -5.2), color: '#7a8078', width: 3 })
  parts.push({ a: xf(-1.8, 2.0, -5.0), b: xf(1.8, 2.0, -5.0), color: '#6a7068', width: 2.5 })

  // Wing spar
  const wingY = 0.9
  parts.push({ a: xf(-7.5, wingY, 0.2), b: xf(7.5, wingY, 0.2), color: '#757b73', width: 4 })
  // Flaperons hint
  const flapDrop = craft.flaps * 0.6
  parts.push({ a: xf(-5.5, wingY - flapDrop, 0.8), b: xf(-2.5, wingY - flapDrop, 0.8), color: '#5a6058', width: 2 })
  parts.push({ a: xf(2.5, wingY - flapDrop, 0.8), b: xf(5.5, wingY - flapDrop, 0.8), color: '#5a6058', width: 2 })

  const drawn = parts
    .map((p) => {
      const pa = project(p.a, cam, w, h)
      const pb = project(p.b, cam, w, h)
      return pa && pb ? { pa, pb, color: p.color, width: p.width, d: (pa.d + pb.d) / 2 } : null
    })
    .filter(Boolean) as { pa: Vec2; pb: Vec2; color: string; width: number; d: number }[]
  drawn.sort((a, b) => b.d - a.d)
  for (const p of drawn) {
    ctx.strokeStyle = p.color
    ctx.lineWidth = Math.max(1, p.width * clamp(45 / p.d, 0.4, 2.2))
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(p.pa.x, p.pa.y)
    ctx.lineTo(p.pb.x, p.pb.y)
    ctx.stroke()
  }

  // Twin nacelles + proprotors
  const nacRad = (craft.nacelleDeg * Math.PI) / 180
  // Local nacelle: hub offset; blades spin in plane perpendicular to nacelle axis
  // Nacelle axis in body: at 90° points +Y (up), at 0° points +Z (forward)
  const drawNacelle = (side: number) => {
    const wx = side * 7.2
    const wy = wingY
    const wz = 0.2
    // Nacelle body along thrust axis
    const ax = Math.sin(nacRad) // up component
    const az = Math.cos(nacRad) // forward component
    const tipLen = 1.4
    const hub = xf(wx, wy, wz)
    const tip = xf(wx + 0, wy + ax * tipLen, wz + az * tipLen)
    const ph = project(hub, cam, w, h)
    const pt = project(tip, cam, w, h)
    if (ph && pt) {
      ctx.strokeStyle = '#4a4e48'
      ctx.lineWidth = Math.max(2, 5 * clamp(45 / ph.d, 0.4, 2))
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(ph.x, ph.y)
      ctx.lineTo(pt.x, pt.y)
      ctx.stroke()
    }

    // Blade disc: rotate blades in plane ⊥ to nacelle
    // Basis for blade plane: lateral + cross(thrust, lateral)
    const bladeR = 4.2
    for (let i = 0; i < 3; i++) {
      const a = rotorPhase + (i * Math.PI * 2) / 3
      // Blade direction in body: mix of lateral and "edge" depending on nacelle
      const bx = Math.cos(a) * bladeR
      const by = -Math.sin(a) * bladeR * Math.cos(nacRad)
      const bz = Math.sin(a) * bladeR * Math.sin(nacRad)
      const tip1 = xf(wx + bx, wy + ax * 0.3 + by, wz + az * 0.3 + bz)
      const tip2 = xf(wx - bx, wy + ax * 0.3 - by, wz + az * 0.3 - bz)
      const p1 = project(tip1, cam, w, h)
      const p2 = project(tip2, cam, w, h)
      if (p1 && p2) {
        ctx.strokeStyle = `rgba(25,25,30,${0.3 + craft.rotorRpm * 0.4})`
        ctx.lineWidth = Math.max(1, 2.2 * clamp(45 / (p1.d || 20), 0.4, 2))
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
      }
    }

    // Disc wash
    const disc: Vec2[] = []
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2
      const bx = Math.cos(a) * bladeR * 0.95
      const by = -Math.sin(a) * bladeR * 0.95 * Math.cos(nacRad)
      const bz = Math.sin(a) * bladeR * 0.95 * Math.sin(nacRad)
      const p = project(xf(wx + bx, wy + ax * 0.25 + by, wz + az * 0.25 + bz), cam, w, h)
      if (p) disc.push(p)
    }
    if (disc.length > 6) {
      ctx.beginPath()
      ctx.moveTo(disc[0]!.x, disc[0]!.y)
      for (const p of disc) ctx.lineTo(p.x, p.y)
      ctx.closePath()
      ctx.fillStyle = `rgba(190,200,210,${0.05 + craft.rotorRpm * 0.07})`
      ctx.fill()
    }
  }

  drawNacelle(-1)
  drawNacelle(1)
  void GEAR_H
}
