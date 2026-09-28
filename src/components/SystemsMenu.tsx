import type { CSSProperties, ReactNode } from 'react'
import { trySetGearDown } from '../game/physics'
import type { Sim, SystemsPanel } from '../game/types'

type Props = {
  sim: Sim
  open: boolean
  onClose: () => void
  onPanel: (p: SystemsPanel) => void
  bump: () => void
}

type Tone = 'off' | 'green' | 'amber' | 'red' | 'blue'

const PANELS: { id: SystemsPanel; label: string; short: string }[] = [
  { id: 'main', label: 'Main Instrument Panel', short: 'MAIN' },
  { id: 'overhead', label: 'Overhead Panel', short: 'OVHD' },
  { id: 'engine', label: 'Engine Panel', short: 'ENG' },
  { id: 'pedestal', label: 'Center Pedestal', short: 'PED' },
  { id: 'gearflap', label: 'Gear / Flap Panel', short: 'G/F' },
  { id: 'afcs', label: 'AFCS / Autopilot', short: 'AFCS' },
  { id: 'ground', label: 'Ground / Service', short: 'GND' },
  { id: 'failures', label: 'Failure Panel', short: 'FAIL' },
]

function Toggle({
  label,
  on,
  onClick,
  warn = false,
  disabled = false,
}: {
  label: string
  on: boolean
  onClick: () => void
  warn?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`sys-switch ${on ? 'active' : ''} ${warn ? 'warn' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span>{label}</span>
      <strong>{on ? 'ON' : 'OFF'}</strong>
    </button>
  )
}

function PanelBox({
  title,
  subtitle,
  children,
  wide = false,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className={`aircraft-panel-box ${wide ? 'wide' : ''}`}>
      <div className="aircraft-panel-title">
        <strong>{title}</strong>
        {subtitle && <span>{subtitle}</span>}
      </div>
      <div className="aircraft-panel-content">{children}</div>
    </div>
  )
}

function Annunciator({
  label,
  state,
  tone = 'off',
}: {
  label: string
  state: string
  tone?: Tone
}) {
  return (
    <div className={`panel-annunciator tone-${tone}`}>
      <span>{label}</span>
      <strong>{state}</strong>
    </div>
  )
}

function Meter({
  label,
  value,
  pct,
  warn = false,
  danger = false,
}: {
  label: string
  value: string
  pct: number
  warn?: boolean
  danger?: boolean
}) {
  const safe = Math.max(0, Math.min(100, pct))
  return (
    <div className={`panel-meter ${warn ? 'warn' : ''} ${danger ? 'danger' : ''}`}>
      <div><span>{label}</span><strong>{value}</strong></div>
      <div className="panel-meter-track"><i style={{ width: `${safe}%` }} /></div>
    </div>
  )
}

function Selector({
  label,
  value,
  onMinus,
  onPlus,
  minusLabel = '−',
  plusLabel = '+',
}: {
  label: string
  value: string
  onMinus: () => void
  onPlus: () => void
  minusLabel?: string
  plusLabel?: string
}) {
  return (
    <div className="panel-selector">
      <span>{label}</span>
      <div>
        <button type="button" onClick={onMinus}>{minusLabel}</button>
        <strong>{value}</strong>
        <button type="button" onClick={onPlus}>{plusLabel}</button>
      </div>
    </div>
  )
}

function gearTone(pos: number): Tone {
  if (pos >= 0.985) return 'green'
  if (pos <= 0.015) return 'off'
  return 'amber'
}

function MainPfd({ sim }: { sim: Sim }) {
  const c = sim.craft
  const speedKt = Math.hypot(c.vx, c.vz) * 1.94384
  const altFt = c.y * 3.28084
  const vsFpm = c.vy * 196.8504
  const hdg = ((c.yaw * 180) / Math.PI + 360) % 360
  const pitchDeg = Math.max(-35, Math.min(35, (-c.pitch * 180) / Math.PI))
  const rollDeg = Math.max(-55, Math.min(55, (c.roll * 180) / Math.PI))
  const style = {
    '--panel-pitch': `${pitchDeg * 1.25}px`,
    '--panel-roll': `${rollDeg}deg`,
  } as CSSProperties

  return (
    <div className="panel-pfd">
      <div className="panel-pfd-tape">
        <span>SPD</span><strong>{Math.round(speedKt)}</strong><small>KT</small>
      </div>
      <div className="panel-pfd-center">
        <div className="panel-pfd-attitude">
          <div className="panel-pfd-world" style={style}>
            <div className="panel-pfd-sky" />
            <div className="panel-pfd-ground" />
            <div className="panel-pfd-horizon" />
          </div>
          <i className="panel-pfd-wing left" />
          <i className="panel-pfd-wing right" />
          <b className="panel-pfd-dot" />
        </div>
        <div className="panel-pfd-hdg">HDG <strong>{Math.round(hdg).toString().padStart(3, '0')}°</strong></div>
        <div className="panel-pfd-vs">V/S <strong>{Math.round(vsFpm)}</strong> FPM</div>
      </div>
      <div className="panel-pfd-tape">
        <span>ALT</span><strong>{Math.round(altFt)}</strong><small>FT</small>
      </div>
    </div>
  )
}

export function SystemsMenu({ sim, open, onClose, onPanel, bump }: Props) {
  if (!open) return null

  const p = sim.systemsPanel === 'none' ? 'main' : sim.systemsPanel
  const c = sim.craft
  const currentPanel = PANELS.find((tab) => tab.id === p) ?? PANELS[0]!
  const flapSteps = [0, 0.25, 0.5, 1]
  const flapPct = Math.round(c.flaps * 100)
  const fuelPct = Math.round(c.fuel * 100)
  const rpmPct = Math.round(c.rotorRpm * 100)
  const fuelFeedL = c.fuelPumpLOn || (c.kind === 'osprey' && c.crossfeedOn && c.fuelPumpROn)
  const fuelFeedR = c.fuelPumpROn || (c.kind === 'osprey' && c.crossfeedOn && c.fuelPumpLOn)
  const genLOnline = c.generatorLOn && c.engineMasterL && c.engineL > 0.2
  const genROnline = c.kind === 'osprey' && c.generatorROn && c.engineMasterR && c.engineR > 0.2
  const busVolts = c.electricsOn ? 28 : 0
  const speedKt = Math.hypot(c.vx, c.vz) * 1.94384
  const altFt = c.y * 3.28084
  const hdg = ((c.yaw * 180) / Math.PI + 360) % 360
  const modeLabel =
    c.kind === 'osprey'
      ? c.nacelleDeg > 75 ? 'HEL' : c.nacelleDeg < 20 ? 'APL' : 'CONV'
      : c.vectorPos > .8 ? 'VL' : c.vectorPos > .35 ? 'STOVL' : 'CTOL'

  const setFlaps = (index: number) => {
    sim.controls.flaps = flapSteps[Math.max(0, Math.min(flapSteps.length - 1, index))]!
    bump()
  }

  const setMode = (level: 0 | 1 | 2) => {
    if (c.kind === 'osprey') {
      sim.controls.nacelle = level === 0 ? 0 : level === 1 ? 0.55 : 1
    } else {
      sim.controls.vector = level === 0 ? 0 : level === 1 ? 0.55 : 1
    }
    bump()
  }

  const changeHeading = (delta: number) => {
    sim.apHeadingTargetDeg = (sim.apHeadingTargetDeg + delta + 360) % 360
    bump()
  }

  const changeAltitudeFt = (deltaFt: number) => {
    sim.apAltitudeTargetM = Math.max(0, sim.apAltitudeTargetM + deltaFt / 3.28084)
    bump()
  }

  return (
    <div className="sys-overlay" onClick={onClose}>
      <div className="sys-panel sys-panel-v18 sys-panel-v19 sys-panel-v20" onClick={(e) => e.stopPropagation()}>
        <div className="sys-head">
          <div>
            <small>{c.kind === 'osprey' ? 'V-22 COCKPIT' : 'F-35 COCKPIT'}</small>
            <strong>{currentPanel.label}</strong>
          </div>
          <button type="button" className="sys-x" onClick={onClose}>✕</button>
        </div>

        <div className="cockpit-location-strip">
          {PANELS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={p === tab.id ? 'active' : ''}
              onClick={() => onPanel(tab.id)}
            >
              <strong>{tab.short}</strong>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="cockpit-panel-stage">
          {p === 'main' && (
            <section className="cockpit-location-panel main-panel">
              <PanelBox title="PRIMARY FLIGHT DISPLAY" subtitle="Main instrument panel" wide>
                <MainPfd sim={sim} />
              </PanelBox>

              <PanelBox title="ENGINE / SYSTEM STRIP" subtitle="Main panel indications">
                <div className="panel-instrument-row">
                  <Meter label="RPM / N1" value={`${rpmPct}%`} pct={rpmPct} warn={rpmPct < 35 && sim.controls.tcl > .25} />
                  <Meter label="FUEL" value={`${fuelPct}%`} pct={fuelPct} warn={fuelPct < 25} danger={fuelPct < 10} />
                </div>
              </PanelBox>

              <PanelBox title="MASTER ANNUNCIATOR" subtitle="Warnings / configuration">
                <div className="panel-lamp-row">
                  <Annunciator label="GEAR" state={c.gearDown ? '3 GREEN' : c.gearCommandDown ? 'TRANSIT' : 'UP'} tone={c.gearDown ? 'green' : c.gearCommandDown ? 'amber' : 'off'} />
                  <Annunciator label="FLAPS" state={flapPct === 0 ? 'UP' : `${flapPct}%`} tone={flapPct > 0 ? 'green' : 'off'} />
                  <Annunciator label="ELEC" state={c.electricsOn ? 'NORM' : 'FAULT'} tone={c.electricsOn ? 'green' : 'red'} />
                  <Annunciator label="HYD" state={c.failHyd ? 'FAULT' : 'NORM'} tone={c.failHyd ? 'red' : 'green'} />
                  <Annunciator label="MODE" state={modeLabel} tone="blue" />
                </div>
              </PanelBox>
            </section>
          )}

          {p === 'overhead' && (
            <section className="cockpit-location-panel overhead-board">
              <PanelBox title="ELECTRICAL" subtitle="Overhead left">
                <div className="overhead-switch-grid">
                  <Toggle label="BATTERY" on={c.batteryOn} onClick={() => { c.batteryOn = !c.batteryOn; bump() }} />
                  <Toggle label={c.kind === 'f35' ? 'GEN' : 'GEN 1'} on={c.generatorLOn} onClick={() => { c.generatorLOn = !c.generatorLOn; bump() }} />
                  {c.kind === 'osprey' && <Toggle label="GEN 2" on={c.generatorROn} onClick={() => { c.generatorROn = !c.generatorROn; bump() }} />}
                  <Toggle label="APU" on={c.apuOn} onClick={() => { c.apuOn = !c.apuOn; bump() }} />
                </div>
                <div className="panel-lamp-row">
                  <Annunciator label="BUS" state={c.electricsOn ? `${busVolts}V` : 'DEAD'} tone={c.electricsOn ? 'green' : 'red'} />
                  <Annunciator label={c.kind === 'osprey' ? 'GEN 1' : 'GEN'} state={genLOnline ? 'ONLINE' : 'OFF'} tone={genLOnline ? 'green' : c.generatorLOn ? 'amber' : 'off'} />
                  {c.kind === 'osprey' && <Annunciator label="GEN 2" state={genROnline ? 'ONLINE' : 'OFF'} tone={genROnline ? 'green' : c.generatorROn ? 'amber' : 'off'} />}
                </div>
              </PanelBox>

              <PanelBox title="FUEL FEED" subtitle="Overhead center">
                <div className="overhead-switch-grid">
                  <Toggle label={c.kind === 'f35' ? 'MAIN PUMP' : 'PUMP 1'} on={c.fuelPumpLOn} onClick={() => { c.fuelPumpLOn = !c.fuelPumpLOn; bump() }} />
                  <Toggle label={c.kind === 'f35' ? 'AUX PUMP' : 'PUMP 2'} on={c.fuelPumpROn} onClick={() => { c.fuelPumpROn = !c.fuelPumpROn; bump() }} />
                  {c.kind === 'osprey' && <Toggle label="X-FEED" on={c.crossfeedOn} onClick={() => { c.crossfeedOn = !c.crossfeedOn; bump() }} />}
                </div>
                <div className="panel-lamp-row">
                  <Annunciator label="FEED 1" state={fuelFeedL ? 'PRESS' : 'LOW'} tone={fuelFeedL ? 'green' : 'red'} />
                  <Annunciator label="FEED 2" state={fuelFeedR ? 'PRESS' : 'LOW'} tone={fuelFeedR ? 'green' : 'amber'} />
                  <Annunciator label="FUEL LOW" state={fuelPct < 15 ? 'ON' : 'OFF'} tone={fuelPct < 15 ? 'amber' : 'off'} />
                </div>
              </PanelBox>

              <PanelBox title="LIGHTS / ANTI-ICE" subtitle="Overhead right">
                <div className="overhead-switch-grid">
                  <Toggle label="NAV" on={c.navLightsOn} onClick={() => { c.navLightsOn = !c.navLightsOn; bump() }} />
                  <Toggle label="LANDING" on={c.landingLightsOn} onClick={() => { c.landingLightsOn = !c.landingLightsOn; bump() }} />
                  <Toggle label="STROBE" on={c.strobeLightsOn} onClick={() => { c.strobeLightsOn = !c.strobeLightsOn; bump() }} />
                  <Toggle label="PITOT" on={c.pitotHeatOn} onClick={() => { c.pitotHeatOn = !c.pitotHeatOn; bump() }} />
                  <Toggle label="ANTI-ICE" on={c.antiIceOn} onClick={() => { c.antiIceOn = !c.antiIceOn; bump() }} />
                </div>
              </PanelBox>
            </section>
          )}

          {p === 'engine' && (
            <section className="cockpit-location-panel engine-board">
              <PanelBox title={c.kind === 'osprey' ? 'ENGINE START / CONTROL' : 'ENGINE / APU CONTROL'} subtitle="Engine panel">
                <div className="engine-switch-row">
                  <Toggle label={c.kind === 'f35' ? 'ENG MASTER' : 'ENG 1 MASTER'} on={c.engineMasterL} onClick={() => { c.engineMasterL = !c.engineMasterL; bump() }} />
                  {c.kind === 'osprey' && <Toggle label="ENG 2 MASTER" on={c.engineMasterR} onClick={() => { c.engineMasterR = !c.engineMasterR; bump() }} />}
                  <Toggle label="APU" on={c.apuOn} onClick={() => { c.apuOn = !c.apuOn; bump() }} />
                </div>
              </PanelBox>

              <PanelBox title="ENGINE INSTRUMENTS" subtitle="Power / condition" wide>
                <div className="engine-gauge-bank">
                  <Meter label="RPM / N1" value={`${rpmPct}%`} pct={rpmPct} warn={rpmPct < 35 && sim.controls.tcl > .25} />
                  <Meter label={c.kind === 'osprey' ? 'ENG 1' : 'ENGINE'} value={`${Math.round(c.engineL * 100)}%`} pct={c.engineL * 100} danger={c.engineL < .5} />
                  {c.kind === 'osprey' && <Meter label="ENG 2" value={`${Math.round(c.engineR * 100)}%`} pct={c.engineR * 100} danger={c.engineR < .5} />}
                  <Meter label="FUEL" value={`${fuelPct}%`} pct={fuelPct} warn={fuelPct < 25} danger={fuelPct < 10} />
                </div>
                <div className="panel-lamp-row">
                  <Annunciator label={c.kind === 'osprey' ? 'ENG 1' : 'ENGINE'} state={c.engineMasterL && c.engineL > .5 ? 'RUN' : 'OFF'} tone={c.engineMasterL && c.engineL > .5 ? 'green' : 'red'} />
                  {c.kind === 'osprey' && <Annunciator label="ENG 2" state={c.engineMasterR && c.engineR > .5 ? 'RUN' : 'OFF'} tone={c.engineMasterR && c.engineR > .5 ? 'green' : 'red'} />}
                  <Annunciator label="APU" state={c.apuOn ? 'RUN' : 'OFF'} tone={c.apuOn ? 'green' : 'off'} />
                  <Annunciator label="HYD" state={c.failHyd ? 'FAULT' : 'NORM'} tone={c.failHyd ? 'red' : 'green'} />
                </div>
              </PanelBox>
            </section>
          )}

          {p === 'pedestal' && (
            <section className="cockpit-location-panel pedestal-board">
              <PanelBox title={c.kind === 'osprey' ? 'TCL / NACELLE QUADRANT' : 'THROTTLE / VECTOR QUADRANT'} subtitle="Center pedestal">
                <div className="quadrant-readouts">
                  <Meter label={c.kind === 'osprey' ? 'TCL' : 'THROTTLE'} value={`${Math.round(sim.controls.tcl * 100)}%`} pct={sim.controls.tcl * 100} />
                  <Meter label={c.kind === 'osprey' ? 'NACELLE' : 'VECTOR'} value={c.kind === 'osprey' ? `${c.nacelleDeg.toFixed(0)}°` : `${Math.round(c.vectorPos * 100)}%`} pct={c.kind === 'osprey' ? c.nacelleDeg / .9 : c.vectorPos * 100} />
                </div>
                <div className="sys-mode-selector">
                  <button type="button" className={modeLabel === (c.kind === 'osprey' ? 'APL' : 'CTOL') ? 'active' : ''} onClick={() => setMode(0)}>{c.kind === 'osprey' ? 'APL' : 'CTOL'}</button>
                  <button type="button" className={modeLabel === (c.kind === 'osprey' ? 'CONV' : 'STOVL') ? 'active' : ''} onClick={() => setMode(1)}>{c.kind === 'osprey' ? 'CONV' : 'STOVL'}</button>
                  <button type="button" className={modeLabel === (c.kind === 'osprey' ? 'HEL' : 'VL') ? 'active' : ''} onClick={() => setMode(2)}>{c.kind === 'osprey' ? 'HEL' : 'VL'}</button>
                </div>
              </PanelBox>

              <PanelBox title="PEDESTAL SWITCHES" subtitle="Brakes / crossfeed / status">
                <div className="pedestal-switch-grid">
                  <Toggle label="PARK BRAKE" on={c.parkingBrake} onClick={() => { c.parkingBrake = !c.parkingBrake; bump() }} />
                  {c.kind === 'osprey' && <Toggle label="X-FEED" on={c.crossfeedOn} onClick={() => { c.crossfeedOn = !c.crossfeedOn; bump() }} />}
                </div>
                <div className="panel-lamp-row">
                  <Annunciator label="PARK" state={c.parkingBrake ? 'SET' : 'REL'} tone={c.parkingBrake ? 'amber' : 'off'} />
                  <Annunciator label="WOW" state={c.onGround ? 'GROUND' : 'AIR'} tone={c.onGround ? 'green' : 'off'} />
                  <Annunciator label="MODE" state={modeLabel} tone="blue" />
                </div>
              </PanelBox>
            </section>
          )}

          {p === 'gearflap' && (
            <section className="cockpit-location-panel gearflap-board">
              <PanelBox title="LANDING GEAR" subtitle="Lever / down-lock lights">
                <div className="gear-panel-large">
                  <button
                    type="button"
                    className={`sys-switch gear-command-switch ${c.gearCommandDown ? 'active' : ''}`}
                    onClick={() => {
                      const ok = trySetGearDown(c, !c.gearCommandDown)
                      if (!ok) sim.message = 'Gear locked — weight on wheels'
                      bump()
                    }}
                  >
                    <span>GEAR LEVER</span>
                    <strong>{c.gearCommandDown ? 'DOWN' : 'UP'}</strong>
                  </button>
                  <div className="gear-three-green">
                    <Annunciator label="NOSE" state={c.gearNosePos >= .985 ? 'DN' : c.gearNosePos <= .015 ? 'UP' : 'TR'} tone={gearTone(c.gearNosePos)} />
                    <Annunciator label="LEFT" state={c.gearLeftPos >= .985 ? 'DN' : c.gearLeftPos <= .015 ? 'UP' : 'TR'} tone={gearTone(c.gearLeftPos)} />
                    <Annunciator label="RIGHT" state={c.gearRightPos >= .985 ? 'DN' : c.gearRightPos <= .015 ? 'UP' : 'TR'} tone={gearTone(c.gearRightPos)} />
                  </div>
                  <Annunciator label="GEAR" state={c.gearDown ? '3 GREEN' : c.gearCommandDown ? 'UNSAFE' : 'UP'} tone={c.gearDown ? 'green' : c.gearCommandDown ? 'amber' : 'off'} />
                </div>
              </PanelBox>

              <PanelBox title="FLAP LEVER" subtitle="Detented positions">
                <div className="flap-detent-panel">
                  {['UP', '1', '2', 'FULL'].map((label, i) => (
                    <button
                      key={label}
                      type="button"
                      className={Math.abs(c.flaps - flapSteps[i]!) < .08 ? 'active' : ''}
                      onClick={() => setFlaps(i)}
                    >
                      <span>{label}</span>
                      <strong>{Math.round(flapSteps[i]! * 100)}%</strong>
                    </button>
                  ))}
                </div>
                <Meter label="FLAP POSITION" value={`${flapPct}%`} pct={flapPct} />
                <Annunciator label="FLAPS" state={flapPct === 0 ? 'UP' : flapPct === 100 ? 'FULL' : `${flapPct}%`} tone={flapPct > 0 ? 'green' : 'off'} />
              </PanelBox>
            </section>
          )}

          {p === 'afcs' && (
            <section className="cockpit-location-panel afcs-board">
              <PanelBox title="AFCS MODE CONTROL PANEL" subtitle="Selected targets" wide>
                <div className="afcs-selector-row">
                  <Selector
                    label="SELECTED HEADING"
                    value={`${Math.round(sim.apHeadingTargetDeg).toString().padStart(3, '0')}°`}
                    onMinus={() => changeHeading(-5)}
                    onPlus={() => changeHeading(5)}
                    minusLabel="◀"
                    plusLabel="▶"
                  />
                  <Selector
                    label="SELECTED ALTITUDE"
                    value={`${Math.round(sim.apAltitudeTargetM * 3.28084)} FT`}
                    onMinus={() => changeAltitudeFt(-100)}
                    onPlus={() => changeAltitudeFt(100)}
                    minusLabel="▼"
                    plusLabel="▲"
                  />
                </div>
                <div className="afcs-mode-row">
                  <Toggle
                    label="HDG HOLD"
                    on={sim.apHeadingHold}
                    onClick={() => {
                      if (!sim.apHeadingHold) sim.apHeadingTargetDeg = hdg
                      sim.apHeadingHold = !sim.apHeadingHold
                      bump()
                    }}
                  />
                  <Toggle
                    label="ALT HOLD"
                    on={sim.apAltitudeHold}
                    onClick={() => {
                      if (!sim.apAltitudeHold) sim.apAltitudeTargetM = c.y
                      sim.apAltitudeHold = !sim.apAltitudeHold
                      bump()
                    }}
                  />
                </div>
                <div className="panel-lamp-row">
                  <Annunciator label="HDG" state={sim.apHeadingHold ? 'CAPTURE' : 'OFF'} tone={sim.apHeadingHold ? 'green' : 'off'} />
                  <Annunciator label="ALT" state={sim.apAltitudeHold ? 'CAPTURE' : 'OFF'} tone={sim.apAltitudeHold ? 'green' : 'off'} />
                  <Annunciator label="FD" state={sim.apHeadingHold || sim.apAltitudeHold ? 'ACTIVE' : 'OFF'} tone={sim.apHeadingHold || sim.apAltitudeHold ? 'blue' : 'off'} />
                </div>
              </PanelBox>

              <PanelBox title="FLIGHT REFERENCE" subtitle="Current vs selected">
                <div className="panel-instrument-row">
                  <Meter label="HDG" value={`${Math.round(hdg).toString().padStart(3, '0')}°`} pct={hdg / 3.6} />
                  <Meter label="ALT" value={`${Math.round(altFt)} FT`} pct={Math.min(100, altFt / 100)} />
                  <Meter label="SPD" value={`${Math.round(speedKt)} KT`} pct={Math.min(100, speedKt / 2.5)} />
                </div>
              </PanelBox>
            </section>
          )}

          {p === 'ground' && (
            <section className="cockpit-location-panel ground-board">
              <PanelBox title="GROUND SERVICE PANEL" subtitle="Available on deck">
                <div className="ground-service-grid">
                  <Toggle label="PARK BRAKE" on={c.parkingBrake} onClick={() => { c.parkingBrake = !c.parkingBrake; bump() }} />
                  <Toggle label="APU" on={c.apuOn} onClick={() => { c.apuOn = !c.apuOn; bump() }} />
                  <button
                    type="button"
                    className="sys-switch"
                    disabled={!c.onGround || !c.parkingBrake}
                    onClick={() => { c.fuel = 1; bump() }}
                  >
                    <span>REFUEL</span><strong>{c.onGround && c.parkingBrake ? 'READY' : 'LOCKED'}</strong>
                  </button>
                </div>
              </PanelBox>
              <PanelBox title="GROUND STATUS" subtitle="Service interlocks">
                <div className="panel-lamp-row">
                  <Annunciator label="WOW" state={c.onGround ? 'GROUND' : 'AIR'} tone={c.onGround ? 'green' : 'off'} />
                  <Annunciator label="PARK BRK" state={c.parkingBrake ? 'SET' : 'REL'} tone={c.parkingBrake ? 'amber' : 'off'} />
                  <Annunciator label="SERVICE" state={c.onGround && c.parkingBrake ? 'READY' : 'LOCK'} tone={c.onGround && c.parkingBrake ? 'green' : 'off'} />
                </div>
              </PanelBox>
            </section>
          )}

          {p === 'failures' && (
            <section className="cockpit-location-panel failure-board">
              <PanelBox title="FAILURE INJECTION" subtitle="Training panel">
                <div className="failure-switch-grid">
                  <Toggle
                    label={c.kind === 'f35' ? 'ENGINE FAIL' : 'ENG 1 FAIL'}
                    on={c.engineL < .5}
                    warn={c.engineL < .5}
                    onClick={() => { c.engineL = c.engineL < .5 ? 1 : .15; bump() }}
                  />
                  {c.kind === 'osprey' && <Toggle label="ENG 2 FAIL" on={c.engineR < .5} warn={c.engineR < .5} onClick={() => { c.engineR = c.engineR < .5 ? 1 : .15; bump() }} />}
                  <Toggle label="HYD FAIL" on={c.failHyd} warn={c.failHyd} onClick={() => { c.failHyd = !c.failHyd; bump() }} />
                  <Toggle label="ASYMMETRIC" on={c.failAsymmetric} warn={c.failAsymmetric} onClick={() => { c.failAsymmetric = !c.failAsymmetric; bump() }} />
                </div>
              </PanelBox>
              <PanelBox title="MASTER CAUTION PANEL" subtitle="Fault annunciators">
                <div className="panel-lamp-row">
                  <Annunciator label="ENGINE" state={c.engineL < .5 || (c.kind === 'osprey' && c.engineR < .5) ? 'FAULT' : 'NORM'} tone={c.engineL < .5 || (c.kind === 'osprey' && c.engineR < .5) ? 'red' : 'green'} />
                  <Annunciator label="HYD" state={c.failHyd ? 'FAULT' : 'NORM'} tone={c.failHyd ? 'red' : 'green'} />
                  <Annunciator label="ASYM" state={c.failAsymmetric ? 'FAULT' : 'NORM'} tone={c.failAsymmetric ? 'amber' : 'green'} />
                </div>
                <button
                  type="button"
                  className="sys-switch maintenance-reset"
                  onClick={() => {
                    c.engineL = 1
                    c.engineR = 1
                    c.failHyd = false
                    c.failAsymmetric = false
                    bump()
                  }}
                >
                  <span>MAINTENANCE</span><strong>RESET FAULTS</strong>
                </button>
              </PanelBox>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
