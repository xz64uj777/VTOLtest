import type { CSSProperties } from 'react'
import { CAM_LABEL } from '../game/camera'
import type { Hud } from '../game/types'

export type LevelReading = {
  pitchDeg: number
  bankDeg: number
  level: boolean
  source: 'tilt' | 'craft'
}

type Props = {
  hud: Hud
  message: string
  paused: boolean
  level: LevelReading
}

const FL_SHOW_M = 305

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function fmtNum(v: number, digits = 0): string {
  if (!Number.isFinite(v)) return '---'
  const n = Math.abs(v) > 1e6 ? 0 : v
  return Number.isFinite(n) ? n.toFixed(digits) : '---'
}

function LevelGauge({ reading }: { reading: LevelReading }) {
  const pitchPx = clamp(reading.pitchDeg, -20, 20) * 0.85
  const bank = clamp(reading.bankDeg, -45, 45)
  const bubbleX = clamp(reading.bankDeg * 0.62, -17, 17)
  const bubbleY = clamp(reading.pitchDeg * 0.62, -17, 17)
  const horizonStyle = {
    '--level-pitch': `${pitchPx}px`,
    '--level-bank': `${bank}deg`,
  } as CSSProperties
  const bubbleStyle = {
    '--bubble-x': `${bubbleX}px`,
    '--bubble-y': `${bubbleY}px`,
  } as CSSProperties

  return (
    <div
      className={`level-gauge ${reading.level ? 'level-gauge-ok' : ''}`}
      title={`${reading.source === 'tilt' ? 'Phone vs frozen Cal' : 'Aircraft attitude'} · pitch ${reading.pitchDeg.toFixed(1)}° · bank ${reading.bankDeg.toFixed(1)}°`}
    >
      <span className="level-label">ATTITUDE</span>
      <div className="level-dial">
        <div className="level-horizon" style={horizonStyle}>
          <span className="level-horizon-line" />
        </div>
        <span className="level-tick level-tick-l" />
        <span className="level-tick level-tick-r" />
        <span className="level-center" />
        <span className="level-bubble" style={bubbleStyle} />
      </div>
      <span className="level-source">{reading.source === 'tilt' ? 'GYRO' : 'CRAFT'}</span>
    </div>
  )
}

function statusClass(active: boolean, warning = false) {
  if (warning) return 'hud-state warn'
  return active ? 'hud-state active' : 'hud-state'
}

export function HUD({ hud, message, paused, level }: Props) {
  const modeClass =
    hud.mode === 'HEL' || hud.mode === 'VL'
      ? 'mode-hel'
      : hud.mode === 'CONV' || hud.mode === 'STOVL'
        ? 'mode-conv'
        : 'mode-apl'

  const showFl = hud.alt >= FL_SHOW_M
  const camLabel = CAM_LABEL[hud.cam] ?? hud.cam.toUpperCase()
  const vsFpm = Math.round(hud.vs * 196.85)
  const powerPct = Math.round(hud.tcl * 100)
  const flapPct = Math.round(hud.flaps * 100)
  const hardSink = !hud.onGround && hud.alt < 70 && hud.vs < -5.5

  return (
    <div className="hud hud-v12">
      <div className="hud-row hud-primary">
        <div className="hud-chip hud-alt">
          <span className="k">ALT</span>
          <span className="v">{fmtNum(hud.alt)}</span>
          <span className="u">m</span>
        </div>
        {showFl && (
          <div className="hud-chip hud-fl">
            <span className="k">FL</span>
            <span className="v">{Number.isFinite(hud.fl) ? hud.fl.toFixed(0).padStart(3, '0') : '---'}</span>
          </div>
        )}
        <div className="hud-chip hud-speed">
          <span className="k">SPD</span>
          <span className="v">{fmtNum(hud.speed)}</span>
          <span className="u">kt</span>
        </div>
        <div className={`hud-chip hud-vs ${hardSink ? 'danger' : hud.vs < -1 ? 'descending' : ''}`}>
          <span className="k">V/S</span>
          <span className="v">{vsFpm >= 0 ? '+' : ''}{vsFpm}</span>
          <span className="u">fpm</span>
        </div>
        <div className="hud-chip">
          <span className="k">HDG</span>
          <span className="v">{Number.isFinite(hud.hdg) ? hud.hdg.toFixed(0).padStart(3, '0') : '---'}</span>
          <span className="u">°</span>
        </div>
        {hud.bird === 'osprey' ? (
          <div className="hud-chip">
            <span className="k">NAC</span>
            <span className="v">{fmtNum(hud.nacelleDeg)}</span>
            <span className="u">°</span>
          </div>
        ) : (
          <div className="hud-chip">
            <span className="k">AOA</span>
            <span className="v">{fmtNum(hud.aoaDeg)}</span>
            <span className="u">°</span>
          </div>
        )}
        <div className={`hud-chip mode-chip ${modeClass}`}>
          <span className="v">{hud.mode}</span>
        </div>
      </div>

      <div className="hud-status-rail">
        <span className="hud-airframe">{hud.bird === 'f35' ? 'F-35' : 'V-22'}</span>
        <span className="hud-power">PWR <strong>{powerPct}%</strong></span>
        <span className={statusClass(hud.gearDown, hud.gearDown && hud.speed > 125)}>
          GEAR {hud.gearDown ? 'DN' : 'UP'}
        </span>
        <span className={statusClass(flapPct > 0)}>FLAP {flapPct}%</span>
        <span className={statusClass(hud.onGround)}>WOW {hud.onGround ? 'ON' : 'OFF'}</span>
        <span className="hud-camera">{camLabel}</span>
      </div>

      {(message || paused) && <div className="hud-msg">{paused ? 'PAUSED · FLIGHT FROZEN' : message}</div>}

      <div className="hud-instruments">
        <LevelGauge reading={level} />
      </div>

      <div className="hud-reticle" aria-hidden>
        <span className="reticle-wing reticle-left" />
        <span className="reticle-dot" />
        <span className="reticle-wing reticle-right" />
      </div>
    </div>
  )
}
