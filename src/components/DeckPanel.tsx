import { trySetGearDown } from '../game/physics'
import type { Hud, Sim } from '../game/types'

type Props = {
  sim: Sim
  hud: Hud
  visible: boolean
  onToggle: () => void
  bump: () => void
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function fmt(v: number, d = 0): string {
  if (!Number.isFinite(v)) return '---'
  return v.toFixed(d)
}

/** Compact Extreme-Landings-style deck: switches + glanceable gauges. */
export function DeckPanel({ sim, hud, visible, onToggle, bump }: Props) {
  const c = sim.craft
  const flapPct = Math.round(clamp(c.flaps, 0, 1) * 100)
  const flapStep = (dir: 1 | -1) => {
    const steps = [0, 0.25, 0.5, 1]
    let i = 0
    let best = 99
    for (let s = 0; s < steps.length; s++) {
      const d = Math.abs(steps[s]! - c.flaps)
      if (d < best) {
        best = d
        i = s
      }
    }
    const next = steps[clamp(i + dir, 0, steps.length - 1)]!
    sim.controls.flaps = next
    c.flaps = next
    bump()
  }

  if (!visible) {
    return (
      <button type="button" className="deck-panel-tab" onClick={onToggle} title="Show deck">
        DECK
      </button>
    )
  }

  const vsFpm = hud.vs * 196.85 // m/s → ft/min-ish cue
  const n1 = Math.round(hud.rpm * 100)
  const nacOrVec =
    hud.bird === 'osprey'
      ? `${fmt(hud.nacelleDeg)}°`
      : `${Math.round(hud.vectorPos * 100)}%`

  return (
    <div className="deck-panel" onClick={(e) => e.stopPropagation()}>
      <div className="deck-panel-head">
        <span className="deck-panel-title">DECK</span>
        <button type="button" className="deck-panel-hide" onClick={onToggle} title="Hide deck">
          ▾
        </button>
      </div>

      <div className="deck-gauges">
        <div className="deck-gauge">
          <span className="dk">ASI</span>
          <span className="dv">{fmt(hud.speed)}</span>
          <span className="du">kt</span>
        </div>
        <div className="deck-gauge">
          <span className="dk">ALT</span>
          <span className="dv">{fmt(hud.alt)}</span>
          <span className="du">m</span>
        </div>
        <div className="deck-gauge">
          <span className="dk">VS</span>
          <span className={`dv ${hud.vs < -1 ? 'neg' : hud.vs > 1 ? 'pos' : ''}`}>
            {hud.vs >= 0 ? '+' : ''}
            {fmt(vsFpm / 100, 0)}
          </span>
          <span className="du">×100</span>
        </div>
        <div className="deck-gauge">
          <span className="dk">HDG</span>
          <span className="dv">{Number.isFinite(hud.hdg) ? hud.hdg.toFixed(0).padStart(3, '0') : '---'}</span>
          <span className="du">°</span>
        </div>
        <div className="deck-gauge">
          <span className="dk">{hud.bird === 'osprey' ? 'NAC' : 'VEC'}</span>
          <span className="dv">{nacOrVec}</span>
        </div>
        <div className="deck-gauge">
          <span className="dk">N1</span>
          <span className="dv">{n1}</span>
          <span className="du">%</span>
        </div>
      </div>

      <div className="deck-hdg-strip" aria-hidden>
        <div
          className="deck-hdg-tape"
          style={{ transform: `translateX(${50 - ((hud.hdg % 360) / 360) * 100}%)` }}
        >
          {[-90, -45, 0, 45, 90, 135, 180, 225, 270, 315, 360, 405].map((a) => (
            <span key={a} className="deck-hdg-tick">
              {((a % 360) + 360) % 360}
            </span>
          ))}
        </div>
        <span className="deck-hdg-caret">▼</span>
      </div>

      <div className="deck-emer">
        <span className="deck-emer-lab">EMER</span>
        <button
          type="button"
          className="deck-sw down"
          title="Emergency gear down"
          onClick={() => {
            trySetGearDown(c, true)
            bump()
          }}
        >
          <span className="sw-lab">GEAR</span>
          <span className="sw-val">DOWN</span>
        </button>
        <button
          type="button"
          className="deck-sw"
          onClick={() => {
            sim.controls.flaps = 1
            c.flaps = 1
            bump()
          }}
        >
          <span className="sw-lab">FLAPS</span>
          <span className="sw-val">FULL</span>
        </button>
        <button
          type="button"
          className="deck-sw warn"
          onClick={() => {
            sim.controls.tcl = 0
            bump()
          }}
        >
          <span className="sw-lab">THR</span>
          <span className="sw-val">CUT</span>
        </button>
        <button
          type="button"
          className="deck-sw"
          onClick={() => {
            if (c.kind === 'f35') {
              sim.controls.vector = 0
              c.vectorPos = 0
            } else {
              sim.controls.nacelle = 0
              c.nacelleDeg = 0
            }
            bump()
          }}
        >
          <span className="sw-lab">MODE</span>
          <span className="sw-val">{c.kind === 'f35' ? 'CTOL' : 'APL'}</span>
        </button>
      </div>

      <div className="deck-switches">
        <button
          type="button"
          className={`deck-sw ${c.gearDown ? 'down' : 'up'}`}
          title={c.onGround ? 'Gear locked DOWN on deck' : 'Toggle gear'}
          onClick={() => {
            const wantDown = !c.gearDown
            const ok = trySetGearDown(c, wantDown)
            if (!ok) sim.message = 'Gear locked — get airborne to retract'
            bump()
          }}
        >
          <span className="sw-lab">GEAR</span>
          <span className="sw-val">{c.gearDown ? 'DOWN' : 'UP'}</span>
        </button>
        <div className="deck-flaps">
          <span className="sw-lab">FLAPS</span>
          <div className="deck-flap-row">
            <button type="button" onClick={() => flapStep(-1)}>
              −
            </button>
            <span className="sw-val">{flapPct}%</span>
            <button type="button" onClick={() => flapStep(1)}>
              +
            </button>
          </div>
        </div>
        <button
          type="button"
          className={`deck-sw ${c.lightsOn ? 'on' : ''}`}
          onClick={() => {
            c.lightsOn = !c.lightsOn
            bump()
          }}
        >
          <span className="sw-lab">LIGHTS</span>
          <span className="sw-val">{c.lightsOn ? 'ON' : 'OFF'}</span>
        </button>
        <button
          type="button"
          className={`deck-sw ${c.parkingBrake ? 'on' : ''}`}
          onClick={() => {
            c.parkingBrake = !c.parkingBrake
            bump()
          }}
        >
          <span className="sw-lab">PARK</span>
          <span className="sw-val">{c.parkingBrake ? 'SET' : 'OFF'}</span>
        </button>
      </div>
    </div>
  )
}
