import type { Cam } from './types'

export type Pt = { x: number; y: number; z: number }
export type Vec2 = { x: number; y: number; d: number }

export function fillPoly(ctx: CanvasRenderingContext2D, pts: (Vec2 | null)[], color: string) {
  if (pts.length < 3 || pts.some((p) => !p)) return
  ctx.beginPath()
  ctx.moveTo(pts[0]!.x, pts[0]!.y)
  for (const p of pts) ctx.lineTo(p!.x, p!.y)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

export function project(p: Pt, cam: Cam, w: number, h: number): Vec2 | null {
  const cy = Math.cos(cam.yaw)
  const sy = Math.sin(cam.yaw)
  const cp = Math.cos(cam.pitch)
  const sp = Math.sin(cam.pitch)

  const dx = p.x - cam.x
  const dy = p.y - cam.y
  const dz = p.z - cam.z

  const rx = dx * cy - dz * sy
  const rz = dx * sy + dz * cy
  const ry = dy

  const fx = rx
  const fy = ry * cp - rz * sp
  const fz = ry * sp + rz * cp

  if (fz < 0.6) return null
  const fov = 1.12
  const sx = w / 2 + (fx / fz) * (h * 0.5 * fov)
  const screenY = h / 2 - (fy / fz) * (h * 0.5 * fov)
  return { x: sx, y: screenY, d: fz }
}

/** Near-plane clamp for long ground strips — keeps runway visible when one end is behind cam. */
export function projectNear(p: Pt, cam: Cam, w: number, h: number): Vec2 | null {
  const cy = Math.cos(cam.yaw)
  const sy = Math.sin(cam.yaw)
  const cp = Math.cos(cam.pitch)
  const sp = Math.sin(cam.pitch)

  const dx = p.x - cam.x
  const dy = p.y - cam.y
  const dz = p.z - cam.z

  const rx = dx * cy - dz * sy
  const rz = dx * sy + dz * cy
  const ry = dy

  const fx = rx
  const fy = ry * cp - rz * sp
  let fz = ry * sp + rz * cp

  // Far behind camera — skip; otherwise clamp to near plane so strip persists
  if (fz < -40) return null
  if (fz < 0.85) fz = 0.85
  const fov = 1.12
  const sx = w / 2 + (fx / fz) * (h * 0.5 * fov)
  const screenY = h / 2 - (fy / fz) * (h * 0.5 * fov)
  return { x: sx, y: screenY, d: fz }
}

export function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

export function mix(a: string, b: string, t: number): string {
  const pa = hex(a)
  const pb = hex(b)
  const r = (pa[0]! + (pb[0]! - pa[0]!) * t) | 0
  const g = (pa[1]! + (pb[1]! - pa[1]!) * t) | 0
  const bl = (pa[2]! + (pb[2]! - pa[2]!) * t) | 0
  return `rgb(${r},${g},${bl})`
}

export function hex(h: string): [number, number, number] {
  const s = h.replace('#', '')
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
}
