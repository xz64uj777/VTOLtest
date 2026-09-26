import { clamp } from './physics'
import type { Sim } from './types'
import { mix, project } from './render_math'

export function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, alt: number) {
  const t = clamp(alt / 140, 0, 1)
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, mix('#5eb8f0', '#1a3558', t * 0.5))
  g.addColorStop(0.42, mix('#9ecfe8', '#3a5a78', t * 0.3))
  g.addColorStop(1, mix('#c4b090', '#5a5848', t * 0.2))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

export function drawCoaming(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = 'rgba(16, 18, 20, 0.94)'
  ctx.beginPath()
  ctx.moveTo(0, h)
  ctx.lineTo(0, h * 0.78)
  ctx.lineTo(w * 0.22, h * 0.74)
  ctx.lineTo(w * 0.42, h * 0.66)
  ctx.lineTo(w * 0.5, h * 0.64)
  ctx.lineTo(w * 0.58, h * 0.66)
  ctx.lineTo(w * 0.78, h * 0.74)
  ctx.lineTo(w, h * 0.78)
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(180, 190, 180, 0.35)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(w * 0.22, h * 0.74)
  ctx.lineTo(w * 0.5, h * 0.64)
  ctx.lineTo(w * 0.78, h * 0.74)
  ctx.stroke()
}

export function drawParticles(ctx: CanvasRenderingContext2D, sim: Sim, w: number, h: number, dt: number, max: number, dust: { x: number; z: number; life: number; vx: number; vz: number }[]) {
  const craft = sim.craft
  const hel = Math.sin((craft.nacelleDeg * Math.PI) / 180)
  if (craft.y < 12 && craft.rotorRpm > 0.4 && !craft.onGround && hel > 0.4) {
    if (dust.length < max && Math.random() < 0.55) {
      const a = Math.random() * Math.PI * 2
      dust.push({
        x: craft.x + Math.cos(a) * 4,
        z: craft.z + Math.sin(a) * 4,
        life: 0.55 + Math.random() * 0.5,
        vx: Math.cos(a) * (2 + Math.random() * 5),
        vz: Math.sin(a) * (2 + Math.random() * 5),
      })
    }
  }
  for (let i = dust.length - 1; i >= 0; i--) {
    const d = dust[i]!
    d.life -= dt
    d.x += d.vx * dt
    d.z += d.vz * dt
    if (d.life <= 0) {
      dust.splice(i, 1)
      continue
    }
    const p = project({ x: d.x, y: 0.2, z: d.z }, sim.cam, w, h)
    if (!p) continue
    ctx.fillStyle = `rgba(175,165,135,${d.life * 0.35})`
    ctx.beginPath()
    ctx.arc(p.x, p.y, clamp(32 / p.d, 2, 11), 0, Math.PI * 2)
    ctx.fill()
  }
}

export function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.78)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(0,0,0,0.38)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}
