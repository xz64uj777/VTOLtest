import {
  PAD_R,
  PAD_X,
  PAD_Z,
  RWY_HALF_W,
  RWY_X,
  RWY_Z0,
  RWY_Z1,
  SCENERY_NEAR_M,
} from './config'
import { clamp } from './physics'
import type { Sim } from './types'
import { hash, project } from './render_math'

export function drawBuildings(ctx: CanvasRenderingContext2D, sim: Sim, w: number, h: number, n: number) {
  for (let i = 0; i < n; i++) {
    const ang = hash(i + 1.1) * Math.PI * 2
    const dist = 70 + hash(i + 2.2) * 150
    const bx = Math.cos(ang) * dist
    const bz = Math.sin(ang) * dist
    if (Math.hypot(bx - PAD_X, bz - PAD_Z) < PAD_R + 18) continue
    if (Math.abs(bx - RWY_X) < RWY_HALF_W + 22 && bz > RWY_Z0 - 20 && bz < RWY_Z1 + 20) continue
    const bw = 5 + hash(i + 3) * 9
    const bh = 7 + hash(i + 4) * 20
    const corners = [
      { x: bx - bw, y: 0, z: bz - bw },
      { x: bx + bw, y: 0, z: bz - bw },
      { x: bx + bw, y: 0, z: bz + bw },
      { x: bx - bw, y: 0, z: bz + bw },
      { x: bx - bw, y: bh, z: bz - bw },
      { x: bx + bw, y: bh, z: bz - bw },
      { x: bx + bw, y: bh, z: bz + bw },
      { x: bx - bw, y: bh, z: bz + bw },
    ]
    const proj = corners.map((p) => project(p, sim.cam, w, h))
    if (proj.some((p) => !p)) continue
    const face = [4, 5, 6, 7].map((i) => proj[i]!)
    ctx.beginPath()
    ctx.moveTo(face[0]!.x, face[0]!.y)
    for (const p of face) ctx.lineTo(p.x, p.y)
    ctx.closePath()
    ctx.fillStyle = `rgb(${65 + hash(i) * 35 | 0},${75 + hash(i + 5) * 28 | 0},${85 + hash(i + 6) * 35 | 0})`
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
      ctx.fillStyle = `rgba(35,45,55,${0.5 + hash(i + idx[0]) * 0.2})`
      ctx.fill()
    }
  }
}

export function drawTrees(ctx: CanvasRenderingContext2D, sim: Sim, w: number, h: number, n: number) {
  const cam = sim.cam
  const alt = Math.max(0, sim.craft.y)
  // At altitude: fewer near trees (phone), but still ring the craft so scenery doesn't vanish
  const lod = clamp(alt / 180, 0, 1)
  const nearN = Math.max(8, Math.floor(n * (1 - 0.55 * lod)))
  const drawR = SCENERY_NEAR_M + alt * 1.2
  const cell = 90

  const scrub = Math.min(nearN, Math.floor(nearN * 0.45) + 6)
  for (let i = 0; i < scrub; i++) {
    const ang = hash(i + 90.1) * Math.PI * 2
    const dist = 18 + hash(i + 91) * Math.min(140, drawR * 0.55)
    const tx = cam.x + Math.cos(ang) * dist
    const tz = cam.z + Math.sin(ang) * dist
    if (Math.hypot(tx - PAD_X, tz - PAD_Z) < PAD_R + 6) continue
    if (Math.abs(tx - RWY_X) < RWY_HALF_W + 10 && tz > RWY_Z0 - 8 && tz < RWY_Z1 + 8) continue
    const base = project({ x: tx, y: 0, z: tz }, cam, w, h)
    if (!base || base.d > drawR) continue
    const s = clamp(28 / base.d, 1.5, 9)
    ctx.fillStyle = `rgba(${40 + (hash(i) * 40) | 0},${70 + (hash(i + 2) * 50) | 0},32,0.75)`
    ctx.beginPath()
    ctx.ellipse(base.x, base.y - s * 0.2, s * 1.4, s * 0.55, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Tile-anchored trees that follow the craft (world never runs out)
  const ox = Math.floor(cam.x / cell)
  const oz = Math.floor(cam.z / cell)
  const ring = 3 + Math.floor(nearN / 20)
  let drawn = 0
  for (let ix = -ring; ix <= ring && drawn < nearN; ix++) {
    for (let iz = -ring; iz <= ring && drawn < nearN; iz++) {
      const gx = ox + ix
      const gz = oz + iz
      const hsh = hash(gx * 12.7 + gz * 9.3 + 20.1)
      if (hsh < 0.42) continue
      const tx = gx * cell + (hash(gx + 1.2) - 0.5) * cell * 0.8
      const tz = gz * cell + (hash(gz + 2.2) - 0.5) * cell * 0.8
      if (Math.hypot(tx - PAD_X, tz - PAD_Z) < PAD_R + 8) continue
      if (Math.abs(tx - RWY_X) < RWY_HALF_W + 14 && tz > RWY_Z0 - 10 && tz < RWY_Z1 + 10) continue
      const kind = hash(gx * 3 + gz + 7)
      const ht = 6 + hsh * 10
      const base = project({ x: tx, y: 0, z: tz }, cam, w, h)
      const top = project({ x: tx, y: ht, z: tz }, cam, w, h)
      if (!base || !top || base.d > drawR) continue
      drawn++
      const s = clamp(55 / base.d, 3, 22)
      ctx.strokeStyle = '#3a2818'
      ctx.lineWidth = Math.max(1.5, s * 0.35)
      ctx.beginPath()
      ctx.moveTo(base.x, base.y)
      ctx.lineTo(top.x, top.y)
      ctx.stroke()
      const g = (28 + hsh * 35) | 0
      const gr = (85 + hash(gx + gz) * 45) | 0
      if (kind > 0.45) {
        ctx.fillStyle = `rgba(${g},${gr},38,0.88)`
        for (let tier = 0; tier < 3; tier++) {
          const ty = top.y + (base.y - top.y) * (0.15 + tier * 0.22)
          const tw = s * (0.7 + tier * 0.35)
          ctx.beginPath()
          ctx.moveTo(top.x, top.y + (base.y - top.y) * (tier * 0.18))
          ctx.lineTo(top.x - tw, ty)
          ctx.lineTo(top.x + tw, ty)
          ctx.closePath()
          ctx.fill()
        }
      } else {
        ctx.fillStyle = `rgba(${g},${gr},38,0.85)`
        ctx.beginPath()
        ctx.arc(top.x, top.y, s, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(top.x + s * 0.35, top.y + s * 0.2, s * 0.65, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}
