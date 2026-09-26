import {
  PAD_R,
  PAD_X,
  PAD_Z,
} from './config'
import { clamp } from './physics'
import type { Cam } from './types'
import { project, type Vec2 } from './render_math'

export function drawPad(ctx: CanvasRenderingContext2D, cam: Cam, w: number, h: number) {
  const ring: Vec2[] = []
  for (let i = 0; i <= 36; i++) {
    const a = (i / 36) * Math.PI * 2
    const p = project(
      { x: PAD_X + Math.cos(a) * PAD_R, y: 0.05, z: PAD_Z + Math.sin(a) * PAD_R },
      cam,
      w,
      h,
    )
    if (p) ring.push(p)
  }
  if (ring.length > 4) {
    ctx.beginPath()
    ctx.moveTo(ring[0]!.x, ring[0]!.y)
    for (const p of ring) ctx.lineTo(p.x, p.y)
    ctx.closePath()
    ctx.fillStyle = 'rgba(45,50,58,0.88)'
    ctx.fill()
    ctx.strokeStyle = '#d4a84a'
    ctx.lineWidth = 2.5
    ctx.stroke()
  }
  const c = project({ x: PAD_X, y: 0.08, z: PAD_Z }, cam, w, h)
  if (c) {
    const s = clamp(200 / c.d, 5, 32)
    ctx.strokeStyle = '#d4a84a'
    ctx.lineWidth = Math.max(2, s * 0.14)
    // VTOL pad mark (circle + cross)
    ctx.beginPath()
    ctx.arc(c.x, c.y, s * 0.9, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(c.x - s * 0.7, c.y)
    ctx.lineTo(c.x + s * 0.7, c.y)
    ctx.moveTo(c.x, c.y - s * 0.7)
    ctx.lineTo(c.x, c.y + s * 0.7)
    ctx.stroke()
  }
}
