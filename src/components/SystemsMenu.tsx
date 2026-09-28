import type { FlightPrefs, TiltHeartbeat } from '../game/prefs'
import { trySetGearDown } from '../game/physics'
import type { Sim, SystemsPanel } from '../game/types'

type Props = {
  sim: Sim
  open: boolean
  onClose: () => void
  onPanel: (p: SystemsPanel) => void
  bump: () => void
  prefs?: FlightPrefs
  tiltHb?: TiltHeartbeat
  onTilt?: () => void
  onRecalibrate?: () => void
  onSens?: () => void
  onPitchMode?: () => void
  onInvertPitch?: () => void
  onInvertRoll?: () => void
}

type Tone = 'off' | 'green' | 'amber' | 'red' | 'blue'

const PANELS: { id: SystemsPanel; label: string; short: string }[] = [
  { id: 'flight', label: 'Flight Controls', short: 'FLT' },
  { id: 'power', label: 'Powerplant', short: 'PWR' },
  { id: 'fuel', label: 'Fuel', short: 'FUEL' },
  { id: 'electrics', label: 'Electrical', short: 'ELEC' },
  { id: 'lights', label: 'Lights / Heat', short: 'LTS' },
  { id: 'config', label: 'Gear / Flaps / Mode', short: 'CFG' },
  { id: 'autopilot', label: 'Autopilot', short: 'AUTO' },
  { id: 'ground', label: 'Ground', short: 'GND' },
  { id: 'failures', label: 'Failures', short: 'FAIL' },
]

function tiltLabel(hb: TiltHeartbeat | undefined, on: boolean): string {
  if (!on) return 'OFF'
  if (hb === 'live') return 'LIVE'
  if (hb === 'no-signal') return 'NO SIG'
  return 'WAIT'
}

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
  children: React.ReactNode
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

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="sys-readout">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function StepControl({
  label,
  value,
  onMinus,
  onPlus,
}: {
  label: string
  value: string
  onMinus: () => void
  onPlus: () => void
}) {
  return (
    <div className="sys-step">
      <span>{label}</span>
      <div>
        <button type="button" onClick={onMinus}>−</button>
        <strong>{value}</strong>
        <button type="button" onClick={onPlus}>+</button>
      </div>
    </div>
  )
}

function gearTone(pos: number): Tone {
  if (pos >= 0.985) return 'green'
  if (pos <= 0.015) return 'off'
  return 'amber'
}

export function SystemsMenu({
  sim,
  open,
  onClose,
  onPanel,
  bump,
  prefs,
  tiltHb,
  onTilt,
  onRecalibrate,
  onSens,
  onPitchMode,
  onInvertPitch,
  onInvertRoll,
}: Props) {
  if (!open) return null

  const p = sim.systemsPanel === 'none' ? 'flight' : sim.systemsPanel
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
  const modeLabel =
    c.kind === 'osprey'
      ? c.nacelleDeg > 75 ? 'HEL' : c.nacelleDeg < 20 ? 'APL' : 'CONV'
      : c.vectorPos > .8 ? 'VL' : c.vectorPos > .35 ? 'STOVL' : 'CTOL'

  const stepFlaps = (dir: -1 | 1) => {
    let nearest = 0
    let best = Number.POSITIVE_INFINITY
    for (let i = 0; i < flapSteps.length; i++) {
      const d = Math.abs(c.flaps - flapSteps[i]!)
      if (d < best) {
        best = d
        nearest = i
      }
    }
    const index = Math.max(0, Math.min(flapSteps.length - 1, nearest + dir))
    sim.controls.flaps = flapSteps[index]!
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

  return (
    <div className="sys-overlay" onClick={onClose}>
      <div className="sys-panel sys-panel-v18 sys-panel-v19" onClick={(e) => e.stopPropagation()}>
        <div className="sys-head">
          <div>
            <small>{c.kind === 'osprey' ? 'V-22 COCKPIT PANELS' : 'F-35 COCKPIT PANELS'}</small>
            <strong>{currentPanel.label}</strong>
          </div>
          <button type="button" className="sys-x" onClick={onClose}>✕</button>
        </div>

        <div className="sys-layout">
          <nav className="sys-tabs sys-tabs-v18" aria-label="Aircraft systems pages">
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
          </nav>

          <div className="sys-body sys-body-v18">
            {p === 'flight' && (
              <section className="aircraft-panel-layout">
                <PanelBox title="FLIGHT CONTROL PANEL" subtitle="Input / trim setup">
                  <div className="sys-grid">
                    {prefs && onSens && (
                      <button type="button" className="sys-switch" onClick={onSens}>
                        <span>CONTROL GAIN</span><strong>{prefs.sens.toUpperCase()}</strong>
                      </button>
                    )}
                    {prefs && onPitchMode && (
                      <button type="button" className="sys-switch" onClick={onPitchMode}>
                        <span>PITCH LOGIC</span>
                        <strong>{prefs.pitchMode === 'realistic' ? 'REAL' : 'CASUAL'}</strong>
                      </button>
                    )}
                    {prefs && onInvertPitch && <Toggle label="PITCH REV" on={prefs.invertPitch} onClick={onInvertPitch} />}
                    {prefs && onInvertRoll && <Toggle label="ROLL REV" on={prefs.invertRoll} onClick={onInvertRoll} />}
                  </div>
                </PanelBox>

                <PanelBox title="MOTION CONTROL" subtitle="Phone cyclic">
                  <div className="panel-inline-grid">
                    {prefs && onTilt && (
                      <button type="button" className={`sys-switch ${prefs.tiltCyclic ? 'active' : ''}`} onClick={onTilt}>
                        <span>TILT CYCLIC</span><strong>{tiltLabel(tiltHb, prefs.tiltCyclic)}</strong>
                      </button>
                    )}
                    {prefs?.tiltCyclic && onRecalibrate && (
                      <button type="button" className="sys-switch" disabled={tiltHb !== 'live'} onClick={onRecalibrate}>
                        <span>GYRO ZERO</span><strong>CAL</strong>
                      </button>
                    )}
                    <Annunciator label="SENSOR" state={tiltHb === 'live' ? 'LIVE' : prefs?.tiltCyclic ? 'WAIT' : 'OFF'} tone={tiltHb === 'live' ? 'green' : prefs?.tiltCyclic ? 'amber' : 'off'} />
                  </div>
                </PanelBox>

                <PanelBox title="FLIGHT MODE" subtitle={c.kind === 'osprey' ? 'Nacelle / TCL' : 'Vector / throttle'} wide>
                  <div className="panel-instrument-row">
                    <Meter label={c.kind === 'osprey' ? 'NACELLE' : 'VECTOR'} value={c.kind === 'osprey' ? `${c.nacelleDeg.toFixed(0)}°` : `${Math.round(c.vectorPos * 100)}%`} pct={c.kind === 'osprey' ? c.nacelleDeg / 0.9 : c.vectorPos * 100} />
                    <Meter label={c.kind === 'osprey' ? 'TCL' : 'THROTTLE'} value={`${Math.round(sim.controls.tcl * 100)}%`} pct={sim.controls.tcl * 100} />
                    <Annunciator label="MODE" state={modeLabel} tone="blue" />
                  </div>
                </PanelBox>
              </section>
            )}

            {p === 'power' && (
              <section className="aircraft-panel-layout">
                <PanelBox title={c.kind === 'osprey' ? 'ENGINE CONTROL PANEL' : 'ENGINE / APU PANEL'} subtitle="Master controls">
                  <div className="sys-grid">
                    <Toggle label={c.kind === 'f35' ? 'ENG MASTER' : 'ENG 1 MASTER'} on={c.engineMasterL} onClick={() => { c.engineMasterL = !c.engineMasterL; bump() }} />
                    {c.kind === 'osprey' && <Toggle label="ENG 2 MASTER" on={c.engineMasterR} onClick={() => { c.engineMasterR = !c.engineMasterR; bump() }} />}
                    <Toggle label="APU" on={c.apuOn} onClick={() => { c.apuOn = !c.apuOn; bump() }} />
                  </div>
                </PanelBox>

                <PanelBox title="ENGINE INSTRUMENTS" subtitle={c.kind === 'osprey' ? 'Twin power indication' : 'Power indication'} wide>
                  <div className="panel-instrument-row">
                    <Meter label="RPM / N1" value={`${rpmPct}%`} pct={rpmPct} warn={rpmPct < 35 && sim.controls.tcl > .25} />
                    <Meter label={c.kind === 'osprey' ? 'ENG 1' : 'ENGINE'} value={`${Math.round(c.engineL * 100)}%`} pct={c.engineL * 100} danger={c.engineL < .5} />
                    {c.kind === 'osprey' && <Meter label="ENG 2" value={`${Math.round(c.engineR * 100)}%`} pct={c.engineR * 100} danger={c.engineR < .5} />}
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

            {p === 'fuel' && (
              <section className="aircraft-panel-layout">
                <PanelBox title="FUEL CONTROL PANEL" subtitle={c.kind === 'osprey' ? 'Pumps / crossfeed' : 'Main / auxiliary feed'}>
                  <div className="sys-grid">
                    <Toggle label={c.kind === 'f35' ? 'MAIN PUMP' : 'PUMP 1'} on={c.fuelPumpLOn} onClick={() => { c.fuelPumpLOn = !c.fuelPumpLOn; bump() }} />
                    <Toggle label={c.kind === 'f35' ? 'AUX PUMP' : 'PUMP 2'} on={c.fuelPumpROn} onClick={() => { c.fuelPumpROn = !c.fuelPumpROn; bump() }} />
                    {c.kind === 'osprey' && <Toggle label="CROSSFEED" on={c.crossfeedOn} onClick={() => { c.crossfeedOn = !c.crossfeedOn; bump() }} />}
                  </div>
                </PanelBox>

                <PanelBox title="FUEL QUANTITY / FEED" subtitle="Live system status" wide>
                  <div className="panel-instrument-row">
                    <Meter label="TOTAL FUEL" value={`${fuelPct}%`} pct={fuelPct} warn={fuelPct < 25} danger={fuelPct < 10} />
                    <Annunciator label={c.kind === 'osprey' ? 'FEED 1' : 'MAIN FEED'} state={fuelFeedL ? 'PRESS' : 'LOW'} tone={fuelFeedL ? 'green' : 'red'} />
                    <Annunciator label={c.kind === 'osprey' ? 'FEED 2' : 'AUX FEED'} state={fuelFeedR ? 'PRESS' : 'LOW'} tone={fuelFeedR ? 'green' : 'amber'} />
                    <Annunciator label="FUEL LOW" state={fuelPct < 15 ? 'ON' : 'OFF'} tone={fuelPct < 15 ? 'amber' : 'off'} />
                  </div>
                </PanelBox>

                <PanelBox title="GROUND FUEL SERVICE" subtitle="WOW + parking brake required">
                  <button
                    type="button"
                    className="sys-switch"
                    disabled={!c.onGround || !c.parkingBrake}
                    onClick={() => { c.fuel = 1; bump() }}
                  >
                    <span>REFUEL</span><strong>{c.onGround && c.parkingBrake ? 'READY' : 'LOCKED'}</strong>
                  </button>
                </PanelBox>
              </section>
            )}

            {p === 'electrics' && (
              <section className="aircraft-panel-layout">
                <PanelBox title="ELECTRICAL CONTROL PANEL" subtitle="Battery / generators / APU">
                  <div className="sys-grid">
                    <Toggle label="BATTERY" on={c.batteryOn} onClick={() => { c.batteryOn = !c.batteryOn; bump() }} />
                    <Toggle label={c.kind === 'f35' ? 'GENERATOR' : 'GEN 1'} on={c.generatorLOn} onClick={() => { c.generatorLOn = !c.generatorLOn; bump() }} />
                    {c.kind === 'osprey' && <Toggle label="GEN 2" on={c.generatorROn} onClick={() => { c.generatorROn = !c.generatorROn; bump() }} />}
                    <Toggle label="APU GEN" on={c.apuOn} onClick={() => { c.apuOn = !c.apuOn; bump() }} />
                  </div>
                </PanelBox>

                <PanelBox title="ELECTRICAL INSTRUMENTS" subtitle="Bus / generator status" wide>
                  <div className="panel-instrument-row">
                    <Meter label="MAIN BUS" value={`${busVolts} V`} pct={c.electricsOn ? 78 : 0} danger={!c.electricsOn} />
                    <Annunciator label={c.kind === 'osprey' ? 'GEN 1' : 'GEN'} state={genLOnline ? 'ONLINE' : 'OFF'} tone={genLOnline ? 'green' : c.generatorLOn ? 'amber' : 'off'} />
                    {c.kind === 'osprey' && <Annunciator label="GEN 2" state={genROnline ? 'ONLINE' : 'OFF'} tone={genROnline ? 'green' : c.generatorROn ? 'amber' : 'off'} />}
                    <Annunciator label="BATTERY" state={c.batteryOn ? 'ON' : 'OFF'} tone={c.batteryOn ? 'green' : 'off'} />
                    <Annunciator label="BUS" state={c.electricsOn ? 'POWER' : 'DEAD'} tone={c.electricsOn ? 'green' : 'red'} />
                  </div>
                </PanelBox>
              </section>
            )}

            {p === 'lights' && (
              <section className="aircraft-panel-layout">
                <PanelBox title="EXTERIOR LIGHTING PANEL" subtitle="Aircraft lights">
                  <div className="sys-grid">
                    <Toggle label="NAV" on={c.navLightsOn} onClick={() => { c.navLightsOn = !c.navLightsOn; bump() }} />
                    <Toggle label="LANDING" on={c.landingLightsOn} onClick={() => { c.landingLightsOn = !c.landingLightsOn; bump() }} />
                    <Toggle label="STROBE" on={c.strobeLightsOn} onClick={() => { c.strobeLightsOn = !c.strobeLightsOn; bump() }} />
                  </div>
                  <div className="panel-lamp-row">
                    <Annunciator label="NAV" state={c.navLightsOn ? 'ON' : 'OFF'} tone={c.navLightsOn ? 'green' : 'off'} />
                    <Annunciator label="LDG" state={c.landingLightsOn ? 'ON' : 'OFF'} tone={c.landingLightsOn ? 'green' : 'off'} />
                    <Annunciator label="STROBE" state={c.strobeLightsOn ? 'ON' : 'OFF'} tone={c.strobeLightsOn ? 'green' : 'off'} />
                  </div>
                </PanelBox>

                <PanelBox title="ANTI-ICE / HEAT PANEL" subtitle="Probe and airframe protection">
                  <div className="sys-grid">
                    <Toggle label="PITOT HEAT" on={c.pitotHeatOn} onClick={() => { c.pitotHeatOn = !c.pitotHeatOn; bump() }} />
                    <Toggle label="ANTI-ICE" on={c.antiIceOn} onClick={() => { c.antiIceOn = !c.antiIceOn; bump() }} />
                  </div>
                  <div className="panel-lamp-row">
                    <Annunciator label="PITOT" state={c.pitotHeatOn ? 'HEAT' : 'OFF'} tone={c.pitotHeatOn ? 'green' : 'off'} />
                    <Annunciator label="ANTI-ICE" state={c.antiIceOn ? 'ON' : 'OFF'} tone={c.antiIceOn ? 'green' : 'off'} />
                    <Annunciator label="ELEC" state={c.electricsOn ? 'BUS' : 'NO BUS'} tone={c.electricsOn ? 'green' : 'red'} />
                  </div>
                </PanelBox>
              </section>
            )}

            {p === 'config' && (
              <section className="aircraft-panel-layout config-panel-layout">
                <PanelBox title="LANDING GEAR PANEL" subtitle="Lever / down-lock indicators">
                  <div className="gear-panel-mini">
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
                    <Annunciator
                      label="GEAR"
                      state={c.gearDown ? '3 GREEN' : (c.gearNosePos > .015 || c.gearLeftPos > .015 || c.gearRightPos > .015) ? 'UNSAFE' : 'UP'}
                      tone={c.gearDown ? 'green' : (c.gearNosePos > .015 || c.gearLeftPos > .015 || c.gearRightPos > .015) ? 'amber' : 'off'}
                    />
                  </div>
                </PanelBox>

                <PanelBox title="FLAP PANEL" subtitle="Detented selector / position">
                  <StepControl label="FLAP LEVER" value={`${flapPct}%`} onMinus={() => stepFlaps(-1)} onPlus={() => stepFlaps(1)} />
                  <Meter label="FLAP POSITION" value={`${flapPct}%`} pct={flapPct} />
                  <Annunciator label="FLAPS" state={flapPct === 0 ? 'UP' : flapPct === 100 ? 'FULL' : `${flapPct}%`} tone={flapPct > 0 ? 'green' : 'off'} />
                </PanelBox>

                <PanelBox title={c.kind === 'osprey' ? 'NACELLE CONVERSION PANEL' : 'STOVL / VECTOR PANEL'} subtitle="Flight-mode selection" wide>
                  <div className="sys-mode-selector">
                    <button type="button" className={modeLabel === (c.kind === 'osprey' ? 'APL' : 'CTOL') ? 'active' : ''} onClick={() => setMode(0)}>{c.kind === 'osprey' ? 'APL' : 'CTOL'}</button>
                    <button type="button" className={modeLabel === (c.kind === 'osprey' ? 'CONV' : 'STOVL') ? 'active' : ''} onClick={() => setMode(1)}>{c.kind === 'osprey' ? 'CONV' : 'STOVL'}</button>
                    <button type="button" className={modeLabel === (c.kind === 'osprey' ? 'HEL' : 'VL') ? 'active' : ''} onClick={() => setMode(2)}>{c.kind === 'osprey' ? 'HEL' : 'VL'}</button>
                  </div>
                  <div className="panel-instrument-row">
                    <Meter label={c.kind === 'osprey' ? 'NAC ANGLE' : 'VECTOR POS'} value={c.kind === 'osprey' ? `${c.nacelleDeg.toFixed(0)}°` : `${Math.round(c.vectorPos * 100)}%`} pct={c.kind === 'osprey' ? c.nacelleDeg / .9 : c.vectorPos * 100} />
                    <Annunciator label="MODE" state={modeLabel} tone="blue" />
                  </div>
                </PanelBox>
              </section>
            )}

            {p === 'autopilot' && (
              <section className="aircraft-panel-layout">
                <PanelBox title="AUTOPILOT MODE PANEL" subtitle="Stability holds">
                  <div className="sys-grid">
                    <Toggle label="HDG HOLD" on={sim.apHeadingHold} onClick={() => { sim.apHeadingHold = !sim.apHeadingHold; bump() }} />
                    <Toggle label="ALT HOLD" on={sim.apAltitudeHold} onClick={() => { sim.apAltitudeHold = !sim.apAltitudeHold; bump() }} />
                  </div>
                  <div className="panel-lamp-row">
                    <Annunciator label="HDG" state={sim.apHeadingHold ? 'HOLD' : 'OFF'} tone={sim.apHeadingHold ? 'green' : 'off'} />
                    <Annunciator label="ALT" state={sim.apAltitudeHold ? 'HOLD' : 'OFF'} tone={sim.apAltitudeHold ? 'green' : 'off'} />
                    <Annunciator label="FD" state={sim.apHeadingHold || sim.apAltitudeHold ? 'ACTIVE' : 'OFF'} tone={sim.apHeadingHold || sim.apAltitudeHold ? 'blue' : 'off'} />
                  </div>
                </PanelBox>

                <PanelBox title="FLIGHT REFERENCE" subtitle="Current aircraft values" wide>
                  <div className="panel-instrument-row">
                    <Readout label="HDG" value={`${Math.round((c.yaw * 180 / Math.PI + 360) % 360).toString().padStart(3, '0')}°`} />
                    <Readout label="ALT" value={`${Math.round(c.y * 3.28084)} FT`} />
                    <Readout label="MODE" value={modeLabel} />
                  </div>
                </PanelBox>
              </section>
            )}

            {p === 'ground' && (
              <section className="aircraft-panel-layout">
                <PanelBox title="GROUND CONTROL PANEL" subtitle="Brakes / service power">
                  <div className="sys-grid">
                    <Toggle label="PARK BRAKE" on={c.parkingBrake} onClick={() => { c.parkingBrake = !c.parkingBrake; bump() }} />
                    <Toggle label="APU" on={c.apuOn} onClick={() => { c.apuOn = !c.apuOn; bump() }} />
                    <Toggle label="LDG LIGHTS" on={c.landingLightsOn} onClick={() => { c.landingLightsOn = !c.landingLightsOn; bump() }} />
                  </div>
                </PanelBox>

                <PanelBox title="GROUND STATUS" subtitle="Weight-on-wheels / servicing">
                  <div className="panel-lamp-row">
                    <Annunciator label="WOW" state={c.onGround ? 'GROUND' : 'AIR'} tone={c.onGround ? 'green' : 'off'} />
                    <Annunciator label="PARK BRK" state={c.parkingBrake ? 'SET' : 'REL'} tone={c.parkingBrake ? 'amber' : 'off'} />
                    <Annunciator label="SERVICE" state={c.onGround && c.parkingBrake ? 'READY' : 'LOCK'} tone={c.onGround && c.parkingBrake ? 'green' : 'off'} />
                  </div>
                </PanelBox>
              </section>
            )}

            {p === 'failures' && (
              <section className="aircraft-panel-layout">
                <PanelBox title="FAILURE INJECTION PANEL" subtitle="Test / training">
                  <div className="sys-grid">
                    <Toggle
                      label={c.kind === 'f35' ? 'ENGINE FAIL' : 'ENG 1 FAIL'}
                      on={c.engineL < 0.5}
                      warn={c.engineL < 0.5}
                      onClick={() => { c.engineL = c.engineL < 0.5 ? 1 : 0.15; bump() }}
                    />
                    {c.kind === 'osprey' && <Toggle label="ENG 2 FAIL" on={c.engineR < 0.5} warn={c.engineR < 0.5} onClick={() => { c.engineR = c.engineR < 0.5 ? 1 : 0.15; bump() }} />}
                    <Toggle label="HYD FAIL" on={c.failHyd} warn={c.failHyd} onClick={() => { c.failHyd = !c.failHyd; bump() }} />
                    <Toggle label="ASYMMETRIC" on={c.failAsymmetric} warn={c.failAsymmetric} onClick={() => { c.failAsymmetric = !c.failAsymmetric; bump() }} />
                  </div>
                </PanelBox>

                <PanelBox title="MASTER CAUTION / STATUS" subtitle="Active faults">
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
    </div>
  )
}
