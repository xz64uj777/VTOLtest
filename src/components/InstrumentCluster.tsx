import type { CSSProperties, ReactNode } from 'react'
import type { Hud, Sim } from '../game/types'

type Props = {
  sim: Sim
  hud: Hud
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function angleFor(v: number, min: number, max: number, sweep = 270) {
  const t = clamp((v - min) / Math.max(0.0001, max - min), 0, 1)
  return -sweep / 2 + t * sweep
}

function RoundGauge({
  label,
  value,
  unit,
  min,
  max,
  display,
  danger = false,
}: {
  label: string
  value: number
  unit: string
  min: number
  max: number
  display?: string
  danger?: boolean
}) {
  const style = {
    '--needle-angle': `${angleFor(value, min, max)}deg`,
  } as CSSProperties

  return (
    <div className={`inst-round ${danger ? 'inst-danger' : ''}`}>
      <span className="inst-label">{label}</span>
      <div className="inst-dial" style={style}>
        {Array.from({ length: 11 }, (_, i) => (
          <i key={i} className="inst-tick" style={{ transform: `rotate(${-135 + i * 27}deg)` }} />
        ))}
        <span className="inst-needle" />
        <span className="inst-hub" />
      </div>
      <strong>{display ?? Math.round(value)}</strong>
      <small>{unit}</small>
    </div>
  )
}

function Attitude({ pitch, bank }: { pitch: number; bank: number }) {
  const style = {
    '--att-bank': `${clamp(bank, -60, 60)}deg`,
    '--att-pitch': `${clamp(pitch, -25, 25) * 1.25}px`,
  } as CSSProperties

  return (
    <div className="inst-attitude">
      <span className="inst-label">ATTITUDE</span>
      <div className="att-bezel">
        <div className="att-world" style={style}>
          <div className="att-sky" />
          <div className="att-ground" />
          <div className="att-horizon" />
        </div>
        <span className="att-wing att-wing-l" />
        <span className="att-wing att-wing-r" />
        <span className="att-center" />
      </div>
      <div className="att-readout">
        <span>P {pitch >= 0 ? '+' : ''}{pitch.toFixed(0)}°</span>
        <span>B {bank >= 0 ? '+' : ''}{bank.toFixed(0)}°</span>
      </div>
    </div>
  )
}

function Heading({ heading }: { heading: number }) {
  const card = {
    transform: `rotate(${-heading}deg)`,
  } as CSSProperties
  return (
    <div className="inst-heading">
      <span className="inst-label">HEADING</span>
      <div className="hdg-bezel">
        <div className="hdg-card" style={card}>
          {[
            ['N', 0],
            ['3', 30],
            ['6', 60],
            ['E', 90],
            ['12', 120],
            ['15', 150],
            ['S', 180],
            ['21', 210],
            ['24', 240],
            ['W', 270],
            ['30', 300],
            ['33', 330],
          ].map(([txt, deg]) => (
            <span key={String(txt)} style={{ transform: `rotate(${deg}deg) translateY(-28px) rotate(${-deg}deg)` }}>
              {txt}
            </span>
          ))}
        </div>
        <span className="hdg-index">▼</span>
      </div>
      <strong>{Math.round(heading).toString().padStart(3, '0')}°</strong>
    </div>
  )
}

function Annunciator({
  label,
  state,
  tone = 'normal',
}: {
  label: string
  state: string
  tone?: 'normal' | 'ok' | 'warn' | 'danger'
}) {
  return (
    <div className={`ann ann-${tone}`}>
      <span>{label}</span>
      <strong>{state}</strong>
    </div>
  )
}

function Meter({
  label,
  value,
  unit,
  tone = 'normal',
  children,
}: {
  label: string
  value: number
  unit: string
  tone?: 'normal' | 'ok' | 'warn' | 'danger'
  children?: ReactNode
}) {
  const pct = clamp(value, 0, 100)
  return (
    <div className={`inst-meter inst-meter-${tone}`}>
      <div className="inst-meter-head">
        <span>{label}</span>
        <strong>{Math.round(value)}{unit}</strong>
      </div>
      <div className="inst-meter-track">
        <i style={{ width: `${pct}%` }} />
      </div>
      {children}
    </div>
  )
}

export function InstrumentCluster({ sim, hud }: Props) {
  const c = sim.craft
  // Physics stores nose-up as negative pitch; present conventional positive nose-up to player.
  const pitchDeg = clamp((-c.pitch * 180) / Math.PI, -90, 90)
  const bankDeg = clamp((c.roll * 180) / Math.PI, -90, 90)
  const altFt = hud.alt * 3.28084
  const vsFpm = hud.vs * 196.8504
  const speedDanger = hud.bird === 'f35' ? hud.speed > 500 : hud.speed > 320
  const sinkDanger = !hud.onGround && hud.alt < 70 && hud.vs < -5.5
  const fuelPct = clamp(c.fuel * 100, 0, 100)
  const rpmPct = clamp(hud.rpm * 100, 0, 120)
  const powerPct = clamp(hud.tcl * 100, 0, 100)
  const engL = clamp(c.engineL * 100, 0, 100)
  const engR = clamp(c.engineR * 100, 0, 100)
  const modePct = hud.bird === 'osprey' ? (hud.nacelleDeg / 90) * 100 : hud.vectorPos * 100
  const modeLabel = hud.bird === 'osprey' ? 'NACELLE' : 'VECTOR'
  const modeUnit = hud.bird === 'osprey' ? `${Math.round(hud.nacelleDeg)}°` : `${Math.round(modePct)}%`
  const flapPct = Math.round(hud.flaps * 100)

  return (
    <div className="instrument-cluster">
      <div className="instrument-main">
        <RoundGauge
          label="AIRSPEED"
          value={hud.speed}
          unit="KTS"
          min={0}
          max={hud.bird === 'f35' ? 600 : 360}
          danger={speedDanger}
        />
        <Attitude pitch={pitchDeg} bank={bankDeg} />
        <RoundGauge
          label="ALTITUDE"
          value={altFt % 10000}
          unit="FT"
          min={0}
          max={10000}
          display={Math.round(altFt).toString()}
        />
        <RoundGauge
          label="VERT SPEED"
          value={vsFpm}
          unit="FPM"
          min={-3000}
          max={3000}
          display={`${vsFpm >= 0 ? '+' : ''}${Math.round(vsFpm)}`}
          danger={sinkDanger}
        />
        <Heading heading={hud.hdg} />
        <RoundGauge
          label={hud.bird === 'f35' ? 'AOA' : 'POWER'}
          value={hud.bird === 'f35' ? hud.aoaDeg : powerPct}
          unit={hud.bird === 'f35' ? 'DEG' : '%'}
          min={hud.bird === 'f35' ? -10 : 0}
          max={hud.bird === 'f35' ? 35 : 100}
          display={hud.bird === 'f35' ? hud.aoaDeg.toFixed(0) : Math.round(powerPct).toString()}
        />
      </div>

      <div className="instrument-secondary">
        <Meter label="POWER" value={powerPct} unit="%" tone={powerPct > 92 ? 'warn' : 'ok'} />
        <Meter label="RPM / N1" value={rpmPct} unit="%" tone={rpmPct > 105 ? 'warn' : 'normal'} />
        <Meter label="FUEL" value={fuelPct} unit="%" tone={fuelPct < 15 ? 'danger' : fuelPct < 30 ? 'warn' : 'ok'} />
        <Meter label="ENGINE L" value={engL} unit="%" tone={engL < 60 ? 'danger' : 'ok'} />
        <Meter label="ENGINE R" value={engR} unit="%" tone={engR < 60 ? 'danger' : 'ok'} />
        <Meter label={modeLabel} value={modePct} unit="">
          <span className="inst-meter-note">{modeUnit} · {hud.mode}</span>
        </Meter>
      </div>

      <div className="instrument-annunciators">
        <Annunciator label="GEAR" state={c.gearDown ? 'DOWN' : 'UP'} tone={c.gearDown ? 'ok' : 'normal'} />
        <Annunciator label="FLAPS" state={`${flapPct}%`} tone={flapPct > 0 ? 'ok' : 'normal'} />
        <Annunciator label="PARK" state={c.parkingBrake ? 'SET' : 'OFF'} tone={c.parkingBrake ? 'warn' : 'normal'} />
        <Annunciator label="ELEC" state={c.electricsOn ? 'ON' : 'OFF'} tone={c.electricsOn ? 'ok' : 'danger'} />
        <Annunciator label="APU" state={c.apuOn ? 'ON' : 'OFF'} tone={c.apuOn ? 'ok' : 'normal'} />
        <Annunciator label="LIGHTS" state={c.lightsOn ? 'ON' : 'OFF'} tone={c.lightsOn ? 'ok' : 'normal'} />
        <Annunciator label="HYD" state={c.failHyd ? 'FAIL' : 'OK'} tone={c.failHyd ? 'danger' : 'ok'} />
        <Annunciator label="ASYM" state={c.failAsymmetric ? 'FAIL' : 'OK'} tone={c.failAsymmetric ? 'danger' : 'ok'} />
      </div>
    </div>
  )
}
