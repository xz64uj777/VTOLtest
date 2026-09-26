import { useEffect, useRef } from 'react'
import type { QualityKey } from '../game/config'
import type { BirdKind, Experience } from '../game/types'

type Props = {
  quality: QualityKey
  experience: Experience
  bird: BirdKind
  onQuality: (q: QualityKey) => void
  onExperience: (e: Experience) => void
  onBird: (b: BirdKind) => void
  onFly: () => void
}

function HangarPadCanvas({ bird }: { bird: BirdKind }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let t0 = performance.now()
    let phase = 0

    const draw = (now: number) => {
      const dt = (now - t0) / 1000
      t0 = now
      phase += dt * 12
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr)
        canvas.height = Math.floor(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const g = ctx.createLinearGradient(0, h * 0.3, 0, h)
      g.addColorStop(0, 'rgba(80,110,70,0)')
      g.addColorStop(0.4, 'rgba(55,85,50,0.55)')
      g.addColorStop(1, 'rgba(30,45,32,0.9)')
      ctx.fillStyle = g
      ctx.fillRect(0, h * 0.3, w, h * 0.7)

      const cx = w * 0.5
      const cy = h * 0.76
      const padR = Math.min(w, h) * 0.24

      ctx.beginPath()
      ctx.ellipse(cx, cy, padR, padR * 0.36, 0, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(45,50,58,0.92)'
      ctx.fill()
      ctx.strokeStyle = '#d4a84a'
      ctx.lineWidth = 2.5
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(cx, cy, padR * 0.35, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx - padR * 0.28, cy)
      ctx.lineTo(cx + padR * 0.28, cy)
      ctx.moveTo(cx, cy - padR * 0.28)
      ctx.lineTo(cx, cy + padR * 0.28)
      ctx.stroke()

      const hx = cx
      const hy = cy - padR * 0.28
      const s = padR * 0.038
      ctx.lineCap = 'round'

      if (bird === 'osprey') {
        ctx.strokeStyle = '#8a9088'
        ctx.lineWidth = 6
        ctx.beginPath()
        ctx.moveTo(hx + 22 * s, hy + 2 * s)
        ctx.lineTo(hx - 28 * s, hy)
        ctx.stroke()
        ctx.fillStyle = 'rgba(42,80,128,0.9)'
        ctx.fillRect(hx + 4 * s, hy - 5 * s, 14 * s, 9 * s)
        ctx.strokeStyle = '#757b73'
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.moveTo(hx - 48 * s, hy - 4 * s)
        ctx.lineTo(hx + 48 * s, hy - 4 * s)
        ctx.stroke()
        for (const side of [-1, 1]) {
          const nx = hx + side * 48 * s
          const ny = hy - 4 * s
          ctx.strokeStyle = '#4a4e48'
          ctx.lineWidth = 5
          ctx.beginPath()
          ctx.moveTo(nx, ny)
          ctx.lineTo(nx, ny - 14 * s)
          ctx.stroke()
          const a = phase + side
          ctx.strokeStyle = 'rgba(30,30,35,0.55)'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(nx - Math.cos(a) * 22 * s, ny - 12 * s)
          ctx.lineTo(nx + Math.cos(a) * 22 * s, ny - 12 * s)
          ctx.stroke()
        }
      } else {
        // F-35 silhouette
        ctx.strokeStyle = '#9aa3a8'
        ctx.lineWidth = 5
        ctx.beginPath()
        ctx.moveTo(hx + 28 * s, hy)
        ctx.lineTo(hx - 22 * s, hy + 2 * s)
        ctx.stroke()
        ctx.fillStyle = 'rgba(50,90,130,0.85)'
        ctx.fillRect(hx + 8 * s, hy - 4 * s, 10 * s, 7 * s)
        ctx.strokeStyle = '#8a9298'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(hx - 6 * s, hy)
        ctx.lineTo(hx - 36 * s, hy + 2 * s)
        ctx.moveTo(hx - 6 * s, hy)
        ctx.lineTo(hx + 36 * s, hy + 2 * s)
        ctx.stroke()
        // twin tails
        ctx.beginPath()
        ctx.moveTo(hx - 18 * s, hy)
        ctx.lineTo(hx - 24 * s, hy - 14 * s)
        ctx.moveTo(hx - 14 * s, hy)
        ctx.lineTo(hx - 8 * s, hy - 14 * s)
        ctx.stroke()
        // lift fan cue
        ctx.strokeStyle = 'rgba(100,160,200,0.7)'
        ctx.beginPath()
        ctx.arc(hx + 4 * s, hy - 6 * s, 6 * s, 0, Math.PI * 2)
        ctx.stroke()
        const a = phase
        ctx.beginPath()
        ctx.moveTo(hx + 4 * s - Math.cos(a) * 5 * s, hy - 6 * s)
        ctx.lineTo(hx + 4 * s + Math.cos(a) * 5 * s, hy - 6 * s)
        ctx.stroke()
        // nozzle down
        ctx.strokeStyle = '#c07040'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(hx - 20 * s, hy + 2 * s)
        ctx.lineTo(hx - 20 * s, hy + 12 * s)
        ctx.stroke()
      }

      ctx.strokeStyle = '#333'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(hx - 10 * s, hy + 8 * s)
      ctx.lineTo(hx - 10 * s, hy + 16 * s)
      ctx.moveTo(hx + 12 * s, hy + 8 * s)
      ctx.lineTo(hx + 12 * s, hy + 16 * s)
      ctx.stroke()

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [bird])

  return <canvas ref={ref} className="hangar-canvas" />
}

export function Hangar({
  quality,
  experience,
  bird,
  onQuality,
  onExperience,
  onBird,
  onFly,
}: Props) {
  const isOsprey = bird === 'osprey'
  const brief = isOsprey
    ? {
        role: 'V-22 style tiltrotor',
        start: 'Cold APL · nacelles forward · TCL 0%',
        launch: 'Raise NAC for hover or stay APL for a rolling departure.',
        mode: 'HEL → CONV → APL',
      }
    : {
        role: 'F-35 style STOVL jet',
        start: 'Cold CTOL · runway · THR 0%',
        launch: 'Accelerate through 70–90 kt, then pull for rotation.',
        mode: 'CTOL → STOVL → VL',
      }

  return (
    <div className="hangar hangar-v12">
      <HangarPadCanvas bird={bird} />
      <div className="hangar-vignette" />

      <section className="hangar-hero">
        <div className="hangar-eyebrow">MOBILE FLIGHT LAB · BUILD 12</div>
        <h1>OSPREY <span>FLIGHT</span></h1>
        <p>Two aircraft. One phone-first cockpit. No canned takeoff animation — you fly it.</p>
        <div className="hangar-statusline">
          <span>GYRO READY</span>
          <span>TOUCH CONTROLS</span>
          <span>6 CAMERAS</span>
        </div>
      </section>

      <div className="hangar-panel hangar-panel-v12">
        <div className="aircraft-picker" aria-label="Aircraft">
          <button
            type="button"
            className={isOsprey ? 'aircraft-card active' : 'aircraft-card'}
            onClick={() => onBird('osprey')}
          >
            <span className="aircraft-kicker">TILTROTOR</span>
            <strong>OSPREY</strong>
            <small>Hover · convert · cruise</small>
          </button>
          <button
            type="button"
            className={!isOsprey ? 'aircraft-card active' : 'aircraft-card'}
            onClick={() => onBird('f35')}
          >
            <span className="aircraft-kicker">STOVL</span>
            <strong>F-35</strong>
            <small>CTOL · vector · vertical</small>
          </button>
        </div>

        <div className="launch-brief">
          <div>
            <span className="brief-label">AIRFRAME</span>
            <strong>{brief.role}</strong>
          </div>
          <div>
            <span className="brief-label">START</span>
            <strong>{brief.start}</strong>
          </div>
          <div>
            <span className="brief-label">MODE PATH</span>
            <strong>{brief.mode}</strong>
          </div>
          <p>{brief.launch}</p>
        </div>

        <div className="hangar-options">
          <div className="hangar-option">
            <label className="hangar-label">Assist</label>
            <div className="seg compact">
              {(['casual', 'intermediate', 'advanced'] as Experience[]).map((e) => (
                <button
                  key={e}
                  type="button"
                  className={experience === e ? 'active' : ''}
                  onClick={() => onExperience(e)}
                >
                  {e === 'casual' ? 'Casual' : e === 'intermediate' ? 'Pilot' : 'Raw'}
                </button>
              ))}
            </div>
          </div>

          <div className="hangar-option">
            <label className="hangar-label">Graphics</label>
            <div className="seg compact">
              {(['low', 'med', 'high'] as QualityKey[]).map((q) => (
                <button
                  key={q}
                  type="button"
                  className={quality === q ? 'active' : ''}
                  onClick={() => onQuality(q)}
                >
                  {q === 'med' ? 'Balanced' : q}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button type="button" className="fly-btn fly-btn-v12" onClick={onFly}>
          <span>START SORTIE</span>
          <small>{isOsprey ? 'VTOL PAD' : 'RUNWAY 01'} · {experience.toUpperCase()}</small>
        </button>

        <p className="hangar-hint hangar-hint-v12">
          v12 keeps the v11 flight model and adds a rebuilt cockpit layer, live flight director,
          persistent setup, mobile layout cleanup, and portable build paths for Android packaging.
        </p>
      </div>
    </div>
  )
}
