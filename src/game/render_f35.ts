import { clamp } from './physics'
import type { Cam, Craft } from './types'
import { fillPoly, project, type Pt, type Vec2 } from './render_math'

export function drawF35(ctx: CanvasRenderingContext2D, craft: Craft, cam: Cam, w: number, h: number, shadows: boolean, rotorPhase: number, inside = false) {
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
      const s = clamp(95 / sh.d, 4, 30) * (1 - clamp(craft.y / 50, 0, 0.85))
      ctx.fillStyle = 'rgba(0,0,0,0.28)'
      ctx.beginPath()
      ctx.ellipse(sh.x, sh.y, s * 1.3, s * 0.38, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const parts: { a: Pt; b: Pt; color: string; width: number }[] = []
  const P = (x: number, y: number, z: number) => project(xf(x, y, z), cam, w, h)
  if (!inside) {
    fillPoly(ctx, [P(-0.7, 0.4, -3.6), P(0.7, 0.4, -3.6), P(0.28, 0.22, 5.2), P(-0.28, 0.22, 5.2)], 'rgba(150,158,164,0.95)')
    fillPoly(ctx, [P(-0.55, 0.05, -3.2), P(0.55, 0.05, -3.2), P(0.22, -0.35, 4.2), P(-0.22, -0.35, 4.2)], 'rgba(70,76,82,0.92)')
  } else {
    fillPoly(ctx, [P(-0.28, 0.28, 1.8), P(0.28, 0.28, 1.8), P(0.08, 0.12, 6.2), P(-0.08, 0.12, 6.2)], 'rgba(168,176,182,0.95)')
  }
  fillPoly(ctx, [P(-5.6, 0.32, -0.4), P(5.6, 0.32, -0.4), P(4.2, 0.28, 2.0), P(-4.2, 0.28, 2.0)], 'rgba(130,138,144,0.9)')
  fillPoly(ctx, [P(-1.5, 0.4, -2.6), P(-1.5, 2.05, -3.7), P(-0.7, 0.35, -2.4)], 'rgba(120,128,134,0.9)')
  fillPoly(ctx, [P(1.5, 0.4, -2.6), P(1.5, 2.05, -3.7), P(0.7, 0.35, -2.4)], 'rgba(120,128,134,0.9)')

  if (craft.gearDown) {
    parts.push({ a: xf(-1.2, -1.7, 1.2), b: xf(-1.2, -0.2, 1.0), color: '#555', width: 2 })
    parts.push({ a: xf(1.2, -1.7, 1.2), b: xf(1.2, -0.2, 1.0), color: '#555', width: 2 })
    parts.push({ a: xf(0, -1.7, -2.0), b: xf(0, -0.1, -1.6), color: '#555', width: 2 })
  }

  // Fuselage — gray fighter
  parts.push({ a: xf(0, 0.15, -4.0), b: xf(0, 0.25, 4.5), color: '#9aa3a8', width: 6 })
  parts.push({ a: xf(-0.7, 0.35, 2.8), b: xf(0.7, 0.35, 2.8), color: '#3a6088', width: 4 })
  // Nose
  parts.push({ a: xf(0, 0.2, 4.5), b: xf(0, 0.1, 5.8), color: '#8a9298', width: 3 })
  // Twin tails
  parts.push({ a: xf(-0.9, 0.3, -2.8), b: xf(-1.4, 2.0, -3.6), color: '#7a8288', width: 2.5 })
  parts.push({ a: xf(0.9, 0.3, -2.8), b: xf(1.4, 2.0, -3.6), color: '#7a8288', width: 2.5 })
  // Wings
  parts.push({ a: xf(-5.5, 0.35, 0.5), b: xf(5.5, 0.35, 0.5), color: '#8a9298', width: 3.5 })
  parts.push({ a: xf(-5.2, 0.3, 0.5), b: xf(-2.5, 0.3, 2.2), color: '#7a8288', width: 2 })
  parts.push({ a: xf(5.2, 0.3, 0.5), b: xf(2.5, 0.3, 2.2), color: '#7a8288', width: 2 })
  // Flaps cue
  const fd = craft.flaps * 0.45
  parts.push({ a: xf(-4.2, 0.3 - fd, 1.2), b: xf(-2.0, 0.3 - fd, 1.2), color: '#5a6268', width: 2 })
  parts.push({ a: xf(2.0, 0.3 - fd, 1.2), b: xf(4.2, 0.3 - fd, 1.2), color: '#5a6268', width: 2 })

  // Lift-fan cue disc on top when VL/STOVL
  const vl = craft.vectorPos
  if (vl > 0.25) {
    const disc: Vec2[] = []
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2
      const p = project(xf(Math.cos(a) * 1.1, 0.85, 1.2 + Math.sin(a) * 1.1), cam, w, h)
      if (p) disc.push(p)
    }
    if (disc.length > 5) {
      ctx.beginPath()
      ctx.moveTo(disc[0]!.x, disc[0]!.y)
      for (const p of disc) ctx.lineTo(p.x, p.y)
      ctx.closePath()
      ctx.fillStyle = `rgba(180,200,220,${0.08 + craft.rotorRpm * 0.12 * vl})`
      ctx.fill()
      ctx.strokeStyle = `rgba(100,140,180,${0.3 + vl * 0.4})`
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
    // Fan blades
    for (let i = 0; i < 4; i++) {
      const a = rotorPhase * 1.8 + (i * Math.PI) / 2
      const t1 = xf(Math.cos(a) * 1.0, 0.9, 1.2 + Math.sin(a) * 1.0)
      const t2 = xf(-Math.cos(a) * 1.0, 0.9, 1.2 - Math.sin(a) * 1.0)
      const p1 = project(t1, cam, w, h)
      const p2 = project(t2, cam, w, h)
      if (p1 && p2) {
        ctx.strokeStyle = `rgba(40,50,60,${0.25 + craft.rotorRpm * 0.35})`
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
      }
    }
  }

  // Rear nozzle — tilts with vector
  const nd = (craft.vectorPos * Math.PI) / 2 // 0 aft, 90 down
  const nz = -Math.cos(nd) * 1.6
  const ny = -Math.sin(nd) * 1.6
  parts.push({ a: xf(0, 0.1, -3.8), b: xf(0, 0.1 + ny, -3.8 + nz), color: '#c07040', width: 4 })

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
}
