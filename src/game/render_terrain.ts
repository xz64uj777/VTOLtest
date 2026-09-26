import {
  SCENERY_HORIZON_BASE,
  SCENERY_HORIZON_PER_ALT,
} from './config'
import { clamp } from './physics'
import type { Cam, Sim } from './types'
import { hash, mix, project, type Vec2 } from './render_math'

export function drawGround(ctx: CanvasRenderingContext2D, sim: Sim, w: number, h: number, detail: number) {
  const cam = sim.cam
  const alt = Math.max(0, sim.craft.y)
  // Horizon distance grows with altitude so 1000–5000 ft still shows structure
  const horizDist = SCENERY_HORIZON_BASE + alt * SCENERY_HORIZON_PER_ALT
  const horizon = project(
    { x: cam.x + Math.sin(cam.yaw) * horizDist, y: 0, z: cam.z + Math.cos(cam.yaw) * horizDist },
    cam,
    w,
    h,
  )
  // Real horizon. Do NOT pin it on screen — that fake wall was the "can't climb" ceiling.
  const hy = horizon ? horizon.y : h + 1
  if (hy < h) {
  const g = ctx.createLinearGradient(0, Math.max(0, hy - h * 0.08), 0, h)
  const haze = clamp(alt / 2500, 0, 0.55)
  g.addColorStop(0, mix('#6a8a6a', '#a8b8c0', haze * 0.55))
  g.addColorStop(0.35, mix('#4e6e42', '#7a8a70', haze * 0.25))
  g.addColorStop(1, '#324828')
  ctx.fillStyle = g
  const top = Math.max(0, hy - h * 0.02)
  ctx.fillRect(0, top, w, h - top)

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, Math.max(0, hy), w, h - Math.max(0, hy))
  ctx.clip()
  // World-locked grid. Tiles stay put as you fly — open countryside, not a texture glued to the camera.
  const step = Math.max(40, 70 + alt * 0.15)
  const tiles = Math.max(8, Math.min(22, detail + Math.floor(alt / 400)))
  const gx0 = Math.floor(cam.x / step)
  const gz0 = Math.floor(cam.z / step)
  ctx.lineWidth = 1
  for (let iz = -tiles; iz <= tiles; iz++) {
    const z = (gz0 + iz) * step
    const a = project({ x: (gx0 - tiles) * step, y: 0, z }, cam, w, h)
    const b = project({ x: (gx0 + tiles) * step, y: 0, z }, cam, w, h)
    if (!a || !b) continue
    ctx.strokeStyle = `rgba(35,55,28,${0.08 + 0.08 * (1 - Math.abs(iz) / tiles)})`
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  for (let ix = -tiles; ix <= tiles; ix++) {
    const x = (gx0 + ix) * step
    const a = project({ x, y: 0, z: (gz0 - tiles) * step }, cam, w, h)
    const b = project({ x, y: 0, z: (gz0 + tiles) * step }, cam, w, h)
    if (!a || !b) continue
    ctx.strokeStyle = `rgba(30,50,25,${0.06 + 0.06 * (1 - Math.abs(ix) / tiles)})`
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  ctx.restore()
  }
}

export function drawDistantTerrain(ctx: CanvasRenderingContext2D, cam: Cam, w: number, h: number, ridgeCount: number, alt: number) {
  const cell = 1400
  const ox = Math.floor(cam.x / cell)
  const oz = Math.floor(cam.z / cell)
  const ring = Math.max(2, Math.min(4, ridgeCount))
  for (let ix = -ring; ix <= ring; ix++) {
    for (let iz = -ring; iz <= ring; iz++) {
      const gx = ox + ix
      const gz = oz + iz
      const hsh = hash(gx * 19.2 + gz * 7.7)
      if (hsh < 0.55) continue
      const wx = gx * cell + (hash(gx + 2.2) - 0.5) * cell * 0.4
      const wz = gz * cell + (hash(gz + 4.4) - 0.5) * cell * 0.4
      const hgt = 40 + hsh * 160
      const half = 180 + hash(gx * 3 + gz) * 280
      const corners = [
        project({ x: wx - half, y: 0, z: wz - half * 0.35 }, cam, w, h),
        project({ x: wx + half, y: 0, z: wz - half * 0.35 }, cam, w, h),
        project({ x: wx + half * 0.55, y: hgt, z: wz + half * 0.2 }, cam, w, h),
        project({ x: wx - half * 0.55, y: hgt, z: wz + half * 0.2 }, cam, w, h),
      ]
      const ok = corners.filter((p): p is Vec2 => !!p)
      if (ok.length < 3) continue
      ctx.beginPath()
      ctx.moveTo(ok[0]!.x, ok[0]!.y)
      for (const p of ok) ctx.lineTo(p.x, p.y)
      ctx.closePath()
      const shade = 40 + ((hsh * 30) | 0)
      ctx.fillStyle = `rgba(${shade},${shade + 18},${shade - 4},${0.28 + hsh * 0.2})`
      ctx.fill()
    }
  }
  void alt

  if (alt > 40) {
    // Kyle B: world-fixed cloud decks with soft altitude fades — no hard pop at ~3k/6k ft
    const bands = [280, 520, 780, 1050, 1400, 1850, 2400]
    for (const baseY of bands) {
      const fade = clamp(1 - Math.abs(alt - baseY) / 2400, 0, 1)
      if (fade < 0.05) continue
      for (let i = 0; i < 6; i++) {
        const ang = hash(i + baseY) * Math.PI * 2
        const dist = 600 + hash(i + baseY + 1) * 1400
        const wx = Math.floor(cam.x / 800) * 800 + Math.cos(ang) * dist
        const wz = Math.floor(cam.z / 800) * 800 + Math.sin(ang) * dist
        const p = project({ x: wx, y: baseY, z: wz }, cam, w, h)
        if (!p || p.d < 180) continue
        const s = clamp(180 / p.d, 4, 36)
        const a = (0.10 + hash(i + baseY) * 0.14) * fade
        ctx.fillStyle = `rgba(240,245,250,${a})`
        ctx.beginPath()
        ctx.ellipse(p.x, p.y, s * 1.7, s * 0.5, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}
