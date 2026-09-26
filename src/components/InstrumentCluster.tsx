import type { CSSProperties } from 'react'
import type { Hud, Sim } from '../game/types'

type Props = {
  sim: Sim
  hud: Hud
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function Tape({
  label,
  value,
  unit,
  step,
}: {
  label: string
  value: number
  unit: string
  step: number
}) {
  const marks = [-2, -1, 0, 1, 2]
  return (
    <div className="pfd-tape">
      <span className="pfd-tape-label">{label}</span>
      <div className="pfd-tape-scale">
        {marks.map((n) => {
          const v = Math.max(0, Math.round((value + n * step) / step) * step)
          return (
            <span key={n} className={n === 0 ? 'major' : ''}>
              {Math.round(v)}
            </span>
          )
        })}
      </div>
      <div className="pfd-tape-box">{Math.round(value)}</div>
      <small>{unit}</small>
    </div>
  )
}

function Pfd({ sim, hud }: Props) {
  const c = sim.craft
  const pitchDeg = clamp((-c.pitch * 180) / Math.PI, -45, 45)
  const bankDeg = clamp((c.roll * 180) / Math.PI, -65, 65)
  const altFt = hud.alt * 3.28084
  const vsFpm = hud.vs * 196.8504
  const worldStyle = {
    '--pfd-bank': `${bankDeg}deg`,
    '--pfd-pitch': `${pitchDeg * 1.6}px`,
  } as CSSProperties

  return (
    <div className="pfd-screen">
      <Tape label="SPD" value={hud.speed} unit="KT" step={10} />
      <div className="pfd-center">
        <div className="pfd-attitude">
          <div className="pfd-world" style={worldStyle}>
            <div className="pfd-sky" />
            <div className="pfd-ground" />
            <div className="pfd-horizon" />
            {[-20, -10, 10, 20].map((p) => (
              <span key={p} className="pfd-pitch-line" style={{ top: `${50 - p * 1.1}%` }}>
                {Math.abs(p)}
              </span>
            ))}
          </div>
          <span className="pfd-wing pfd-wing-l" />
          <span className="pfd-wing pfd-wing-r" />
          <span className="pfd-center-dot" />
          <div className="pfd-bank-scale">
            <i>30</i><i>20</i><i>10</i><b>▼</b><i>10</i><i>20</i><i>30</i>
          </div>
        </div>

        <div className="pfd-heading">
          <span>W</span>
          <span>{((hud.hdg + 330) % 360).toFixed(0).padStart(3, '0')}</span>
          <strong>{hud.hdg.toFixed(0).padStart(3, '0')}°</strong>
          <span>{((hud.hdg + 30) % 360).toFixed(0).padStart(3, '0')}</span>
          <span>E</span>
        </div>

        <div className="pfd-footer">
          <span>{hud.bird === 'osprey' ? `NAC ${hud.nacelleDeg.toFixed(0)}°` : `VEC ${Math.round(hud.vectorPos * 100)}%`}</span>
          <strong>{hud.mode}</strong>
          <span>VS {vsFpm >= 0 ? '+' : ''}{Math.round(vsFpm)}</span>
        </div>
      </div>
      <Tape label="ALT" value={altFt} unit="FT" step={100} />
    </div>
  )
}

function Lever({
  label,
  value,
  top,
  bottom,
}: {
  label: string
  value: number
  top: string
  bottom: string
}) {
  const pct = clamp(value, 0, 1)
  return (
    <div className="cockpit-lever">
      <span>{label}</span>
      <div className="cockpit-lever-slot">
        <i style={{ bottom: `calc(${pct * 100}% - 9px)` }} />
      </div>
      <small className="lever-top">{top}</small>
      <small className="lever-bottom">{bottom}</small>
      <strong>{Math.round(pct * 100)}%</strong>
    </div>
  )
}

function SystemLamp({
  label,
  state,
  danger = false,
}: {
  label: string
  state: string
  danger?: boolean
}) {
  return (
    <div className={`cockpit-lamp ${danger ? 'danger' : ''}`}>
      <span>{label}</span>
      <strong>{state}</strong>
    </div>
  )
}

export function InstrumentCluster({ sim, hud }: Props) {
  const c = sim.craft
  const power = clamp(hud.tcl, 0, 1)
  const mode = hud.bird === 'osprey' ? clamp(hud.nacelleDeg / 90, 0, 1) : clamp(hud.vectorPos, 0, 1)
  const flapPct = Math.round(hud.flaps * 100)
  const fuelPct = Math.round(clamp(c.fuel, 0, 1) * 100)

  return (
    <div className="cockpit-console">
      <div className="cockpit-side cockpit-side-left">
        <Lever label={hud.bird === 'f35' ? 'THROTTLE' : 'TCL'} value={power} top="MAX" bottom="IDLE" />
        <div className="cockpit-engine-strip">
          <SystemLamp label="RPM" state={`${Math.round(hud.rpm * 100)}%`} />
          <SystemLamp label="FUEL" state={`${fuelPct}%`} danger={fuelPct < 15} />
        </div>
      </div>

      <div className="cockpit-center">
        <Pfd sim={sim} hud={hud} />
        <div className="cockpit-annunciators">
          <SystemLamp label="GEAR" state={c.gearDown ? 'DOWN' : 'UP'} />
          <SystemLamp label="FLAPS" state={`${flapPct}%`} />
          <SystemLamp label="ELEC" state={c.electricsOn ? 'ON' : 'OFF'} danger={!c.electricsOn} />
          <SystemLamp label="APU" state={c.apuOn ? 'ON' : 'OFF'} />
          <SystemLamp label="HYD" state={c.failHyd ? 'FAIL' : 'OK'} danger={c.failHyd} />
          <SystemLamp label="ASYM" state={c.failAsymmetric ? 'FAIL' : 'OK'} danger={c.failAsymmetric} />
        </div>
      </div>

      <div className="cockpit-side cockpit-side-right">
        <Lever
          label={hud.bird === 'osprey' ? 'NACELLE' : 'VECTOR'}
          value={mode}
          top={hud.bird === 'osprey' ? 'HEL' : 'VL'}
          bottom={hud.bird === 'osprey' ? 'APL' : 'CTOL'}
        />
        <div className="cockpit-engine-strip">
          <SystemLamp label="ENG L" state={`${Math.round(c.engineL * 100)}%`} danger={c.engineL < 0.6} />
          {hud.bird === 'osprey' ? (
            <SystemLamp label="ENG R" state={`${Math.round(c.engineR * 100)}%`} danger={c.engineR < 0.6} />
          ) : (
            <SystemLamp label="AOA" state={`${hud.aoaDeg.toFixed(0)}°`} />
          )}
        </div>
      </div>
    </div>
  )
}
