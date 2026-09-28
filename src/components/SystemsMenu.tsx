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

const PANELS: { id: SystemsPanel; label: string; short: string }[] = [
  { id: 'flight', label: 'Flight Controls', short: 'FLT' },
  { id: 'power', label: 'Powerplant', short: 'PWR' },
  { id: 'fuel', label: 'Fuel', short: 'FUEL' },
  { id: 'electrics', label: 'Electrical', short: 'ELEC' },
  { id: 'lights', label: 'Lights / Heat', short: 'LTS' },
  { id: 'config', label: 'Aircraft Config', short: 'CFG' },
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
      <div className="sys-panel sys-panel-v18" onClick={(e) => e.stopPropagation()}>
        <div className="sys-head">
          <div>
            <small>AIRCRAFT SYSTEMS</small>
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
              <section>
                <div className="sys-page-title">CONTROL SETUP</div>
                <div className="sys-grid">
                  {prefs && onSens && (
                    <button type="button" className="sys-switch" onClick={onSens}>
                      <span>SENSITIVITY</span><strong>{prefs.sens.toUpperCase()}</strong>
                    </button>
                  )}
                  {prefs && onPitchMode && (
                    <button type="button" className="sys-switch" onClick={onPitchMode}>
                      <span>PITCH MODE</span>
                      <strong>{prefs.pitchMode === 'realistic' ? 'REAL' : 'CASUAL'}</strong>
                    </button>
                  )}
                  {prefs && onInvertPitch && (
                    <Toggle label="INVERT PITCH" on={prefs.invertPitch} onClick={onInvertPitch} />
                  )}
                  {prefs && onInvertRoll && (
                    <Toggle label="INVERT ROLL" on={prefs.invertRoll} onClick={onInvertRoll} />
                  )}
                  {prefs && onTilt && (
                    <button type="button" className={`sys-switch ${prefs.tiltCyclic ? 'active' : ''}`} onClick={onTilt}>
                      <span>PHONE TILT</span><strong>{tiltLabel(tiltHb, prefs.tiltCyclic)}</strong>
                    </button>
                  )}
                  {prefs?.tiltCyclic && onRecalibrate && (
                    <button type="button" className="sys-switch" disabled={tiltHb !== 'live'} onClick={onRecalibrate}>
                      <span>GYRO ZERO</span><strong>CAL</strong>
                    </button>
                  )}
                </div>
                <div className="sys-status-line">
                  {c.kind === 'osprey'
                    ? `V-22 · NAC ${c.nacelleDeg.toFixed(0)}° · TCL ${Math.round(sim.controls.tcl * 100)}%`
                    : `F-35 · VEC ${Math.round(c.vectorPos * 100)}% · THR ${Math.round(sim.controls.tcl * 100)}%`}
                </div>
              </section>
            )}

            {p === 'power' && (
              <section>
                <div className="sys-page-title">POWERPLANT</div>
                <div className="sys-grid">
                  <Toggle
                    label={c.kind === 'f35' ? 'ENGINE MASTER' : 'ENG 1 MASTER'}
                    on={c.engineMasterL}
                    onClick={() => { c.engineMasterL = !c.engineMasterL; bump() }}
                  />
                  {c.kind === 'osprey' && (
                    <Toggle label="ENG 2 MASTER" on={c.engineMasterR} onClick={() => { c.engineMasterR = !c.engineMasterR; bump() }} />
                  )}
                  <Toggle label="APU" on={c.apuOn} onClick={() => { c.apuOn = !c.apuOn; bump() }} />
                  <Readout label="RPM / N1" value={`${Math.round(c.rotorRpm * 100)}%`} />
                  <Readout label={c.kind === 'f35' ? 'ENGINE' : 'ENGINE 1'} value={`${Math.round(c.engineL * 100)}%`} />
                  {c.kind === 'osprey' && <Readout label="ENGINE 2" value={`${Math.round(c.engineR * 100)}%`} />}
                </div>
                <div className="sys-note">Engine masters and fuel feed now affect available thrust.</div>
              </section>
            )}

            {p === 'fuel' && (
              <section>
                <div className="sys-page-title">FUEL SYSTEM</div>
                <div className="sys-fuel-total">
                  <span>TOTAL FUEL</span><strong>{Math.round(c.fuel * 100)}%</strong>
                  <div className="sys-bar"><div style={{ width: `${c.fuel * 100}%` }} /></div>
                </div>
                <div className="sys-grid">
                  <Toggle label={c.kind === 'f35' ? 'MAIN PUMP' : 'PUMP 1'} on={c.fuelPumpLOn} onClick={() => { c.fuelPumpLOn = !c.fuelPumpLOn; bump() }} />
                  <Toggle label={c.kind === 'f35' ? 'AUX PUMP' : 'PUMP 2'} on={c.fuelPumpROn} onClick={() => { c.fuelPumpROn = !c.fuelPumpROn; bump() }} />
                  {c.kind === 'osprey' && (
                    <Toggle label="CROSSFEED" on={c.crossfeedOn} onClick={() => { c.crossfeedOn = !c.crossfeedOn; bump() }} />
                  )}
                  <button
                    type="button"
                    className="sys-switch"
                    disabled={!c.onGround || !c.parkingBrake}
                    onClick={() => { c.fuel = 1; bump() }}
                  >
                    <span>GROUND SERVICE</span><strong>REFUEL</strong>
                  </button>
                </div>
                <div className="sys-note">Refuel requires weight-on-wheels and parking brake set.</div>
              </section>
            )}

            {p === 'electrics' && (
              <section>
                <div className="sys-page-title">ELECTRICAL</div>
                <div className="sys-grid">
                  <Toggle label="BATTERY" on={c.batteryOn} onClick={() => { c.batteryOn = !c.batteryOn; bump() }} />
                  <Toggle label={c.kind === 'f35' ? 'GENERATOR' : 'GEN 1'} on={c.generatorLOn} onClick={() => { c.generatorLOn = !c.generatorLOn; bump() }} />
                  {c.kind === 'osprey' && (
                    <Toggle label="GEN 2" on={c.generatorROn} onClick={() => { c.generatorROn = !c.generatorROn; bump() }} />
                  )}
                  <Toggle label="APU" on={c.apuOn} onClick={() => { c.apuOn = !c.apuOn; bump() }} />
                  <Readout label="MAIN BUS" value={c.electricsOn ? 'POWERED' : 'DEAD'} />
                </div>
                <div className={`sys-annunciator ${c.electricsOn ? 'ok' : 'danger'}`}>
                  {c.electricsOn ? 'ELEC BUS ONLINE' : 'ELEC BUS OFFLINE'}
                </div>
              </section>
            )}

            {p === 'lights' && (
              <section>
                <div className="sys-page-title">LIGHTS / ENVIRONMENT</div>
                <div className="sys-grid">
                  <Toggle label="NAV LIGHTS" on={c.navLightsOn} onClick={() => { c.navLightsOn = !c.navLightsOn; bump() }} />
                  <Toggle label="LANDING" on={c.landingLightsOn} onClick={() => { c.landingLightsOn = !c.landingLightsOn; bump() }} />
                  <Toggle label="STROBE" on={c.strobeLightsOn} onClick={() => { c.strobeLightsOn = !c.strobeLightsOn; bump() }} />
                  <Toggle label="PITOT HEAT" on={c.pitotHeatOn} onClick={() => { c.pitotHeatOn = !c.pitotHeatOn; bump() }} />
                  <Toggle label="ANTI-ICE" on={c.antiIceOn} onClick={() => { c.antiIceOn = !c.antiIceOn; bump() }} />
                </div>
                {!c.electricsOn && <div className="sys-annunciator danger">NO ELECTRICAL BUS</div>}
              </section>
            )}

            {p === 'config' && (
              <section>
                <div className="sys-page-title">AIRCRAFT CONFIGURATION</div>
                <div className="sys-grid">
                  <button
                    type="button"
                    className={`sys-switch ${c.gearCommandDown ? 'active' : ''}`}
                    onClick={() => {
                      const ok = trySetGearDown(c, !c.gearCommandDown)
                      if (!ok) sim.message = 'Gear locked — weight on wheels'
                      bump()
                    }}
                  >
                    <span>GEAR LEVER</span>
                    <strong>{c.gearDown ? '3 GREEN' : c.gearCommandDown ? 'EXT' : 'UP'}</strong>
                  </button>
                  <Readout label="GEAR N / L / R" value={`${Math.round(c.gearNosePos * 100)} · ${Math.round(c.gearLeftPos * 100)} · ${Math.round(c.gearRightPos * 100)}`} />
                  <StepControl label="FLAPS" value={`${flapPct}%`} onMinus={() => stepFlaps(-1)} onPlus={() => stepFlaps(1)} />
                </div>
                <div className="sys-mode-selector">
                  <button type="button" onClick={() => setMode(0)}>{c.kind === 'osprey' ? 'APL' : 'CTOL'}</button>
                  <button type="button" onClick={() => setMode(1)}>{c.kind === 'osprey' ? 'CONV' : 'STOVL'}</button>
                  <button type="button" onClick={() => setMode(2)}>{c.kind === 'osprey' ? 'HEL' : 'VL'}</button>
                </div>
              </section>
            )}

            {p === 'autopilot' && (
              <section>
                <div className="sys-page-title">AUTOPILOT / FLIGHT DIRECTOR</div>
                <div className="sys-grid">
                  <Toggle label="HEADING HOLD" on={sim.apHeadingHold} onClick={() => { sim.apHeadingHold = !sim.apHeadingHold; bump() }} />
                  <Toggle label="ALTITUDE HOLD" on={sim.apAltitudeHold} onClick={() => { sim.apAltitudeHold = !sim.apAltitudeHold; bump() }} />
                  <Readout label="CURRENT MODE" value={c.kind === 'osprey' ? (c.nacelleDeg > 75 ? 'HEL' : c.nacelleDeg < 20 ? 'APL' : 'CONV') : (c.vectorPos > .8 ? 'VL' : c.vectorPos > .35 ? 'STOVL' : 'CTOL')} />
                </div>
                <div className="sys-note">Current holds are stability aids; selected-target autopilot is the next layer.</div>
              </section>
            )}

            {p === 'ground' && (
              <section>
                <div className="sys-page-title">GROUND OPERATIONS</div>
                <div className="sys-grid">
                  <Toggle label="PARKING BRAKE" on={c.parkingBrake} onClick={() => { c.parkingBrake = !c.parkingBrake; bump() }} />
                  <Toggle label="APU" on={c.apuOn} onClick={() => { c.apuOn = !c.apuOn; bump() }} />
                  <Toggle label="LANDING LIGHTS" on={c.landingLightsOn} onClick={() => { c.landingLightsOn = !c.landingLightsOn; bump() }} />
                  <Readout label="WEIGHT ON WHEELS" value={c.onGround ? 'YES' : 'NO'} />
                </div>
                <div className="sys-note">Ground service functions are locked out once airborne.</div>
              </section>
            )}

            {p === 'failures' && (
              <section>
                <div className="sys-page-title">FAILURE INJECTION</div>
                <div className="sys-grid">
                  <Toggle
                    label={c.kind === 'f35' ? 'ENGINE FAIL' : 'ENGINE 1 FAIL'}
                    on={c.engineL < 0.5}
                    warn={c.engineL < 0.5}
                    onClick={() => { c.engineL = c.engineL < 0.5 ? 1 : 0.15; bump() }}
                  />
                  {c.kind === 'osprey' && (
                    <Toggle label="ENGINE 2 FAIL" on={c.engineR < 0.5} warn={c.engineR < 0.5} onClick={() => { c.engineR = c.engineR < 0.5 ? 1 : 0.15; bump() }} />
                  )}
                  <Toggle label="HYDRAULIC FAIL" on={c.failHyd} warn={c.failHyd} onClick={() => { c.failHyd = !c.failHyd; bump() }} />
                  <Toggle label="ASYMMETRIC" on={c.failAsymmetric} warn={c.failAsymmetric} onClick={() => { c.failAsymmetric = !c.failAsymmetric; bump() }} />
                  <button
                    type="button"
                    className="sys-switch"
                    onClick={() => {
                      c.engineL = 1
                      c.engineR = 1
                      c.failHyd = false
                      c.failAsymmetric = false
                      bump()
                    }}
                  >
                    <span>MAINTENANCE</span><strong>RESET</strong>
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
