import {
  PAD_X,
  PAD_Z,
  RWY_HALF_W,
  RWY_X,
  RWY_Z0,
  RWY_Z1,
} from './config'
import type { Cam } from './types'
import { projectNear, type Vec2 } from './render_math'
import { drawAirportProps } from './render_airport_props'

export function drawAirport(ctx: CanvasRenderingContext2D, cam: Cam, w: number, h: number) {
  const half = RWY_HALF_W
  const x0 = RWY_X - half
  const x1 = RWY_X + half
  const z0 = RWY_Z0
  const z1 = RWY_Z1

  const fillPoly = (pts: (Vec2 | null)[], fill: string, stroke?: string, lw = 1) => {
    const ok = pts.filter((p): p is Vec2 => !!p)
    if (ok.length < 3) return
    ctx.beginPath()
    ctx.moveTo(ok[0]!.x, ok[0]!.y)
    for (let i = 1; i < ok.length; i++) ctx.lineTo(ok[i]!.x, ok[i]!.y)
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
    if (stroke) {
      ctx.strokeStyle = stroke
      ctx.lineWidth = lw
      ctx.stroke()
    }
  }

  // Segmented asphalt - each slab draws independently so frustum / behind-cam
  // corners no longer cull the entire strip.
  const seg = 18
  for (let z = z0; z < z1; z += seg) {
    const ze = Math.min(z + seg, z1)
    const corners = [
      projectNear({ x: x0, y: 0.02, z }, cam, w, h),
      projectNear({ x: x1, y: 0.02, z }, cam, w, h),
      projectNear({ x: x1, y: 0.02, z: ze }, cam, w, h),
      projectNear({ x: x0, y: 0.02, z: ze }, cam, w, h),
    ]
    // Need >=3 corners; skip only if all far behind
    if (corners.filter(Boolean).length < 3) continue
    fillPoly(corners, 'rgba(52,56,62,0.94)', 'rgba(90,95,100,0.45)', 1.2)
  }

  // Shoulder / overrun extensions (visual cue, longer draw)
  for (const [za, zb] of [
    [z0 - 18, z0],
    [z1, z1 + 18],
  ] as const) {
    const corners = [
      projectNear({ x: x0 + 1, y: 0.015, z: za }, cam, w, h),
      projectNear({ x: x1 - 1, y: 0.015, z: za }, cam, w, h),
      projectNear({ x: x1 - 1, y: 0.015, z: zb }, cam, w, h),
      projectNear({ x: x0 + 1, y: 0.015, z: zb }, cam, w, h),
    ]
    fillPoly(corners, 'rgba(48,52,58,0.75)')
  }

  // Centerline dashes
  const dashLen = 10
  const gap = 8
  for (let z = z0 + 8; z < z1 - 8; z += dashLen + gap) {
    const a = projectNear({ x: RWY_X, y: 0.05, z }, cam, w, h)
    const b = projectNear({ x: RWY_X, y: 0.05, z: Math.min(z + dashLen, z1 - 6) }, cam, w, h)
    if (!a || !b) continue
    ctx.strokeStyle = 'rgba(240,240,220,0.88)'
    ctx.lineWidth = Math.max(1.5, 55 / ((a.d + b.d) / 2))
    ctx.lineCap = 'butt'
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }

  // Edge lines (segmented so long edges survive)
  for (const ex of [x0 + 0.8, x1 - 0.8]) {
    for (let z = z0 + 4; z < z1 - 4; z += 40) {
      const ze = Math.min(z + 40, z1 - 4)
      const a = projectNear({ x: ex, y: 0.05, z }, cam, w, h)
      const b = projectNear({ x: ex, y: 0.05, z: ze }, cam, w, h)
      if (!a || !b) continue
      ctx.strokeStyle = 'rgba(230,230,210,0.72)'
      ctx.lineWidth = Math.max(1, 40 / ((a.d + b.d) / 2))
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
  }

  // Threshold bars (both ends)
  for (const zBase of [z0 + 6, z1 - 14]) {
    for (let i = 0; i < 6; i++) {
      const sx = RWY_X - half + 2.2 + i * 3.5
      const a = projectNear({ x: sx, y: 0.06, z: zBase }, cam, w, h)
      const b = projectNear({ x: sx, y: 0.06, z: zBase + 8 }, cam, w, h)
      if (!a || !b) continue
      ctx.strokeStyle = 'rgba(245,245,230,0.92)'
      ctx.lineWidth = Math.max(2, 48 / ((a.d + b.d) / 2))
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
  }

  // Taxiway pad <-> runway
  fillPoly(
    [
      projectNear({ x: PAD_X + 8, y: 0.015, z: PAD_Z - 6 }, cam, w, h),
      projectNear({ x: PAD_X + 8, y: 0.015, z: PAD_Z + 6 }, cam, w, h),
      projectNear({ x: RWY_X - half - 1, y: 0.015, z: 12 }, cam, w, h),
      projectNear({ x: RWY_X - half - 1, y: 0.015, z: 0 }, cam, w, h),
    ],
    'rgba(58,62,68,0.88)',
    'rgba(180,160,80,0.35)',
    1,
  )

  // Extra parallel taxi / ramp east of runway
  fillPoly(
    [
      projectNear({ x: half + 4, y: 0.012, z: -50 }, cam, w, h),
      projectNear({ x: half + 14, y: 0.012, z: -50 }, cam, w, h),
      projectNear({ x: half + 14, y: 0.012, z: 80 }, cam, w, h),
      projectNear({ x: half + 4, y: 0.012, z: 80 }, cam, w, h),
    ],
    'rgba(55,60,66,0.82)',
  )
  // Cross connectors
  for (const zc of [-40, 10, 55]) {
    fillPoly(
      [
        projectNear({ x: half, y: 0.013, z: zc - 4 }, cam, w, h),
        projectNear({ x: half + 14, y: 0.013, z: zc - 4 }, cam, w, h),
        projectNear({ x: half + 14, y: 0.013, z: zc + 4 }, cam, w, h),
        projectNear({ x: half, y: 0.013, z: zc + 4 }, cam, w, h),
      ],
      'rgba(58,62,68,0.8)',
    )
  }

  drawAirportProps(ctx, cam, w, h)
}
