import {
  PAD_R,
  PAD_X,
  PAD_Z,
} from './config'
import { clamp } from './physics'
import type { Cam } from './types'
import { project } from './render_math'

export function drawAirportProps(ctx: CanvasRenderingContext2D, cam: Cam, w: number, h: number) {
  // Hangars / terminal
  const hangars: { x: number; z: number; bw: number; bd: number; bh: number; color: string }[] = [
    { x: -48, z: -40, bw: 10, bd: 8, bh: 7, color: 'rgb(72,78,88)' },
    { x: -52, z: -18, bw: 8, bd: 12, bh: 6, color: 'rgb(68,74,82)' },
    { x: 38, z: 40, bw: 9, bd: 7, bh: 5.5, color: 'rgb(70,76,84)' },
    { x: 42, z: -30, bw: 7, bd: 9, bh: 5, color: 'rgb(66,72,80)' },
  ]
  for (const hng of hangars) {
    const { x: bx, z: bz, bw, bd, bh, color } = hng
    const corners = [
      { x: bx - bw, y: 0, z: bz - bd },
      { x: bx + bw, y: 0, z: bz - bd },
      { x: bx + bw, y: 0, z: bz + bd },
      { x: bx - bw, y: 0, z: bz + bd },
      { x: bx - bw, y: bh, z: bz - bd },
      { x: bx + bw, y: bh, z: bz - bd },
      { x: bx + bw, y: bh, z: bz + bd },
      { x: bx - bw, y: bh, z: bz + bd },
    ]
    const proj = corners.map((p) => project(p, cam, w, h))
    if (proj.filter(Boolean).length < 6) continue
    if (proj.some((p) => !p)) continue
    const roof = [4, 5, 6, 7].map((i) => proj[i]!)
    ctx.beginPath()
    ctx.moveTo(roof[0]!.x, roof[0]!.y)
    for (const p of roof) ctx.lineTo(p.x, p.y)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
    for (const idx of [
      [0, 1, 5, 4],
      [1, 2, 6, 5],
    ] as const) {
      const pts = idx.map((j) => proj[j]!)
      ctx.beginPath()
      ctx.moveTo(pts[0]!.x, pts[0]!.y)
      for (const p of pts) ctx.lineTo(p.x, p.y)
      ctx.closePath()
      ctx.fillStyle = 'rgba(40,48,56,0.65)'
      ctx.fill()
    }
  }

  // Control tower
  const twx = -55
  const twz = 70
  const towerPts = [
    { x: twx - 2.5, y: 0, z: twz - 2.5 },
    { x: twx + 2.5, y: 0, z: twz - 2.5 },
    { x: twx + 2.5, y: 0, z: twz + 2.5 },
    { x: twx - 2.5, y: 0, z: twz + 2.5 },
    { x: twx - 2.5, y: 22, z: twz - 2.5 },
    { x: twx + 2.5, y: 22, z: twz - 2.5 },
    { x: twx + 2.5, y: 22, z: twz + 2.5 },
    { x: twx - 2.5, y: 22, z: twz + 2.5 },
  ]
  const tproj = towerPts.map((p) => project(p, cam, w, h))
  if (!tproj.some((p) => !p)) {
    const roof = [4, 5, 6, 7].map((i) => tproj[i]!)
    ctx.beginPath()
    ctx.moveTo(roof[0]!.x, roof[0]!.y)
    for (const p of roof) ctx.lineTo(p.x, p.y)
    ctx.closePath()
    ctx.fillStyle = 'rgb(90,98,110)'
    ctx.fill()
    const cab = project({ x: twx, y: 26, z: twz }, cam, w, h)
    if (cab) {
      const s = clamp(90 / cab.d, 3, 14)
      ctx.fillStyle = 'rgba(140,180,210,0.75)'
      ctx.fillRect(cab.x - s, cab.y - s * 0.7, s * 2, s * 1.1)
      ctx.strokeStyle = '#d4a84a'
      ctx.lineWidth = 1.5
      ctx.strokeRect(cab.x - s, cab.y - s * 0.7, s * 2, s * 1.1)
    }
  }

  // Windsock near pad
  const wsx = PAD_X + PAD_R + 6
  const wsz = PAD_Z - 8
  const base = project({ x: wsx, y: 0, z: wsz }, cam, w, h)
  const top = project({ x: wsx, y: 7, z: wsz }, cam, w, h)
  const sock = project({ x: wsx + 4, y: 6.2, z: wsz + 1.5 }, cam, w, h)
  if (base && top) {
    ctx.strokeStyle = '#8890a0'
    ctx.lineWidth = Math.max(1.5, 35 / base.d)
    ctx.beginPath()
    ctx.moveTo(base.x, base.y)
    ctx.lineTo(top.x, top.y)
    ctx.stroke()
    if (sock) {
      ctx.fillStyle = 'rgba(220,90,50,0.85)'
      ctx.beginPath()
      ctx.moveTo(top.x, top.y)
      ctx.lineTo(sock.x, sock.y - 3)
      ctx.lineTo(sock.x, sock.y + 3)
      ctx.closePath()
      ctx.fill()
    }
  }
}
