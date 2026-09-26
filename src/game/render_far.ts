import {
  PAD_R,
  PAD_X,
  PAD_Z,
  RWY_HALF_W,
  RWY_X,
  RWY_Z0,
  RWY_Z1,
} from './config'
import { clamp } from './physics'
import type { Cam } from './types'
import { hash, project, projectNear, type Vec2 } from './render_math'

export function drawFields(ctx: CanvasRenderingContext2D, cam: Cam, w: number, h: number, farPatches: number, alt: number) {
  // Static near-airport patches (runway landmark)
  const fixed: { x: number; z: number; sx: number; sz: number; color: string }[] = [
    { x: -90, z: 40, sx: 35, sz: 28, color: 'rgba(92,110,48,0.45)' },
    { x: -100, z: -70, sx: 40, sz: 32, color: 'rgba(110,100,55,0.4)' },
    { x: 95, z: -20, sx: 38, sz: 30, color: 'rgba(85,105,50,0.42)' },
    { x: 110, z: 90, sx: 42, sz: 26, color: 'rgba(100,95,50,0.38)' },
    { x: -70, z: 130, sx: 30, sz: 22, color: 'rgba(70,95,60,0.4)' },
    { x: 60, z: -110, sx: 36, sz: 24, color: 'rgba(88,108,52,0.4)' },
  ]
  const drawPatch = (f: { x: number; z: number; sx: number; sz: number; color: string }) => {
    const corners = [
      projectNear({ x: f.x - f.sx, y: 0.01, z: f.z - f.sz }, cam, w, h),
      projectNear({ x: f.x + f.sx, y: 0.01, z: f.z - f.sz }, cam, w, h),
      projectNear({ x: f.x + f.sx, y: 0.01, z: f.z + f.sz }, cam, w, h),
      projectNear({ x: f.x - f.sx, y: 0.01, z: f.z + f.sz }, cam, w, h),
    ]
    const ok = corners.filter((p): p is Vec2 => !!p)
    if (ok.length < 3) return
    ctx.beginPath()
    ctx.moveTo(ok[0]!.x, ok[0]!.y)
    for (let i = 1; i < ok.length; i++) ctx.lineTo(ok[i]!.x, ok[i]!.y)
    ctx.closePath()
    ctx.fillStyle = f.color
    ctx.fill()
  }
  for (const f of fixed) drawPatch(f)

  // Craft-following countryside tiles so world never empties past tree radius
  const cell = 160 + alt * 0.35
  const ox = Math.floor(cam.x / cell)
  const oz = Math.floor(cam.z / cell)
  const ring = 2 + Math.floor(farPatches / 8)
  for (let ix = -ring; ix <= ring; ix++) {
    for (let iz = -ring; iz <= ring; iz++) {
      const gx = ox + ix
      const gz = oz + iz
      const hsh = hash(gx * 17.1 + gz * 31.7)
      if (hsh < 0.35) continue
      const cx = gx * cell + (hash(gx + 0.3) - 0.5) * cell * 0.5
      const cz = gz * cell + (hash(gz + 0.7) - 0.5) * cell * 0.5
      // Keep clear of runway / pad
      if (Math.hypot(cx - PAD_X, cz - PAD_Z) < PAD_R + 40) continue
      if (Math.abs(cx - RWY_X) < RWY_HALF_W + 30 && cz > RWY_Z0 - 40 && cz < RWY_Z1 + 40) continue
      const sx = 28 + hsh * 55 + alt * 0.08
      const sz = 22 + hash(gx * 3.1) * 48 + alt * 0.06
      const colors = [
        'rgba(92,110,48,0.38)',
        'rgba(110,100,55,0.34)',
        'rgba(70,95,60,0.36)',
        'rgba(100,95,50,0.32)',
      ]
      drawPatch({
        x: cx,
        z: cz,
        sx,
        sz,
        color: colors[(Math.abs(gx * 3 + gz) % colors.length)]!,
      })
    }
  }
}

export function drawFarMassing(ctx: CanvasRenderingContext2D, cam: Cam, w: number, h: number, farPatches: number, alt: number) {
  if (alt < 40) return
  const cell = 900
  const ox = Math.floor(cam.x / cell)
  const oz = Math.floor(cam.z / cell)
  const ring = 3
  let n = 0
  const cap = Math.min(farPatches + 4, 28)
  for (let ix = -ring; ix <= ring && n < cap; ix++) {
    for (let iz = -ring; iz <= ring && n < cap; iz++) {
      const gx = ox + ix
      const gz = oz + iz
      const hsh = hash(gx * 4.1 + gz * 9.3)
      if (hsh < 0.62) continue
      n++
      const wx = gx * cell + (hash(gx + 1.7) - 0.5) * cell * 0.5
      const wz = gz * cell + (hash(gz + 2.8) - 0.5) * cell * 0.5
      const elev = 8 + hsh * 36
      const half = 70 + hash(gx + gz) * 120
      const corners = [
        project({ x: wx - half, y: 0, z: wz - half * 0.5 }, cam, w, h),
        project({ x: wx + half, y: 0, z: wz - half * 0.5 }, cam, w, h),
        project({ x: wx + half * 0.7, y: elev, z: wz + half * 0.4 }, cam, w, h),
        project({ x: wx - half * 0.7, y: elev, z: wz + half * 0.4 }, cam, w, h),
      ]
      const ok = corners.filter((p): p is Vec2 => !!p)
      if (ok.length < 3) continue
      ctx.beginPath()
      ctx.moveTo(ok[0]!.x, ok[0]!.y)
      for (const p of ok) ctx.lineTo(p.x, p.y)
      ctx.closePath()
      ctx.fillStyle = `rgba(${50 + ((hsh * 30) | 0)},${70 + ((hsh * 20) | 0)},${48},${0.14 + hsh * 0.12})`
      ctx.fill()
    }
  }
  if (alt > 60) {
    // Soft far cloud decks — denser bands, fade by |alt-baseY| (no hitch at 3k/6k ft)
    const bands = [350, 650, 950, 1300, 1750, 2300]
    for (const baseY of bands) {
      const fade = clamp(1 - Math.abs(alt - baseY) / 2600, 0, 1)
      if (fade < 0.04) continue
      const cxy = Math.floor(cam.x / 1200)
      const czy = Math.floor(cam.z / 1200)
      for (let i = 0; i < 5; i++) {
        const wx = (cxy + (hash(i + baseY) - 0.5) * 4) * 1200
        const wz = (czy + (hash(i + baseY + 3) - 0.5) * 4) * 1200
        const p = project({ x: wx, y: baseY, z: wz }, cam, w, h)
        if (!p || p.d < 200) continue
        const s = clamp(160 / p.d, 3, 28)
        const a = (0.08 + hash(i + baseY) * 0.1) * fade
        ctx.fillStyle = `rgba(240,245,250,${a})`
        ctx.beginPath()
        ctx.ellipse(p.x, p.y, s * 1.6, s * 0.45, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}
