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

const PANELS: { id: SystemsPanel; label: string }[] = [
  { id: 'flight', label: 'Flight' },
  { id: 'engines', label: 'Engines' },
  { id: 'fuel', label: 'Fuel' },
  { id: 'gear', label: 'Gear / Flaps' },
  { id: 'electrics', label: 'Electrics / APU' },
  { id: 'autopilot', label: 'Autopilot' },
  { id: 'failures', label: 'Failures' },
  { id: 'emer', label: 'EMER' },
]

function tiltLabel(hb: TiltHeartbeat | undefined, on: boolean): string {
  if (!on) return 'Tilt · OFF'
  if (hb === 'live') return 'Tilt · live'
  if (hb === 'no-signal') return 'Tilt · no signal'
  return 'Tilt · …'
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
  const p = sim.systemsPanel
  const c = sim.craft

  return (
    <div className="sys-overlay" onClick={onClose}>
      <div className="sys-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sys-head">
          <strong>Systems</strong>
          <button type="button" className="sys-x" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="sys-tabs">
          {PANELS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={p === tab.id ? 'active' : ''}
              onClick={() => onPanel(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="sys-body">
          {(p === 'none' || p === 'flight') && (
            <div>
              {c.kind === 'f35' ? (
                <>
                  <p>F-35 modes via VEC: VL · STOVL · CTOL (thrust vector + lift-fan).</p>
                  <p>
                    VEC {(c.vectorPos * 100).toFixed(0)}% · THR {(sim.controls.tcl * 100).toFixed(0)}% ·
                    AoA {((c.aoa * 180) / Math.PI).toFixed(0)}° · Flaps {(c.flaps * 100).toFixed(0)}%
                  </p>
                </>
              ) : (
                <>
                  <p>Osprey mode from nacelle: HEL (~90°) · CONV · APL (~0°).</p>
                  <p>
                    NAC {c.nacelleDeg.toFixed(0)}° · TCL {(sim.controls.tcl * 100).toFixed(0)}% · Flaps{' '}
                    {(c.flaps * 100).toFixed(0)}%
                  </p>
                </>
              )}
              <p className="dim">
                Deck: yaw bar LEFT · TCL/THR + NAC/VEC RIGHT · cyclic stick when Tilt OFF. Casual:
                stick-up = nose UP.
              </p>
              {prefs && (
                <div className="sys-row" style={{ flexWrap: 'wrap', marginTop: 10 }}>
                  {onSens && (
                    <button type="button" onClick={onSens}>
                      Sens · {prefs.sens}
                    </button>
                  )}
                  {onPitchMode && (
                    <button type="button" onClick={onPitchMode}>
                      {prefs.pitchMode === 'realistic' ? 'Realistic' : 'Casual'}
                    </button>
                  )}
                  {onInvertPitch && (
                    <button
                      type="button"
                      className={prefs.invertPitch ? 'active' : ''}
                      onClick={onInvertPitch}
                    >
                      Invert pitch {prefs.invertPitch ? 'ON' : 'OFF'}
                    </button>
                  )}
                  {onInvertRoll && (
                    <button
                      type="button"
                      className={prefs.invertRoll ? 'active' : ''}
                      onClick={onInvertRoll}
                    >
                      Invert roll {prefs.invertRoll ? 'ON' : 'OFF'}
                    </button>
                  )}
                  {onTilt && (
                    <button
                      type="button"
                      className={prefs.tiltCyclic ? 'active' : ''}
                      onClick={onTilt}
                    >
                      {tiltLabel(tiltHb, prefs.tiltCyclic)}
                    </button>
                  )}
                  {prefs.tiltCyclic && onRecalibrate && (
                    <button type="button" disabled={tiltHb !== 'live'} onClick={onRecalibrate}>
                      Recalibrate
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {p === 'engines' && (
            <div>
              <p>
                L {(c.engineL * 100).toFixed(0)}% · R {(c.engineR * 100).toFixed(0)}% · RPM{' '}
                {(c.rotorRpm * 100).toFixed(0)}%
              </p>
              <button
                type="button"
                onClick={() => {
                  c.engineL = 1
                  c.engineR = 1
                  bump()
                }}
              >
                Reset engines
              </button>
            </div>
          )}
          {p === 'fuel' && (
            <div>
              <p>Fuel {(c.fuel * 100).toFixed(0)}%</p>
              <div className="sys-bar">
                <div style={{ width: `${c.fuel * 100}%` }} />
              </div>
              <button
                type="button"
                onClick={() => {
                  c.fuel = 1
                  bump()
                }}
              >
                Refuel
              </button>
            </div>
          )}
          {p === 'gear' && (
            <div>
              <p>Gear {c.gearDown ? 'DOWN' : 'UP'} · Flaps {(c.flaps * 100).toFixed(0)}%</p>
              <button
                type="button"
                onClick={() => {
                  const ok = trySetGearDown(c, !c.gearDown)
                  if (!ok) sim.message = 'Gear locked — get airborne to retract'
                  bump()
                }}
              >
                Toggle gear
              </button>
              <p className="dim">Retract blocked on ground / low AGL. Extend always OK.</p>
              <div className="sys-row">
                <button
                  type="button"
                  onClick={() => {
                    sim.controls.flaps = Math.min(1, sim.controls.flaps + 0.25)
                    bump()
                  }}
                >
                  Flaps +
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sim.controls.flaps = Math.max(0, sim.controls.flaps - 0.25)
                    bump()
                  }}
                >
                  Flaps −
                </button>
              </div>
            </div>
          )}
          {p === 'electrics' && (
            <div>
              <p>
                Electrics {c.electricsOn ? 'ON' : 'OFF'} · APU {c.apuOn ? 'ON' : 'OFF'}
              </p>
              <button
                type="button"
                onClick={() => {
                  c.electricsOn = !c.electricsOn
                  bump()
                }}
              >
                Toggle electrics
              </button>
              <button
                type="button"
                onClick={() => {
                  c.apuOn = !c.apuOn
                  bump()
                }}
              >
                Toggle APU
              </button>
            </div>
          )}
          {p === 'autopilot' && (
            <div>
              <p className="dim">Soft holds — Intermediate / Advanced.</p>
              <button
                type="button"
                className={sim.apHeadingHold ? 'active' : ''}
                onClick={() => {
                  sim.apHeadingHold = !sim.apHeadingHold
                  bump()
                }}
              >
                HDG hold {sim.apHeadingHold ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                className={sim.apAltitudeHold ? 'active' : ''}
                onClick={() => {
                  sim.apAltitudeHold = !sim.apAltitudeHold
                  bump()
                }}
              >
                ALT hold {sim.apAltitudeHold ? 'ON' : 'OFF'}
              </button>
            </div>
          )}

          {p === 'emer' && (
            <div>
              <p className="dim">Emergency / checklist — thin v10 start. Phone-friendly.</p>
              <div className="sys-row">
                <button
                  type="button"
                  className={c.gearDown ? 'active' : 'warn'}
                  onClick={() => {
                    trySetGearDown(c, true)
                    bump()
                  }}
                >
                  Emer gear DOWN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sim.controls.flaps = 1
                    c.flaps = 1
                    bump()
                  }}
                >
                  Flaps FULL
                </button>
              </div>
              <div className="sys-row">
                <button
                  type="button"
                  className={c.parkingBrake ? 'active' : ''}
                  onClick={() => {
                    c.parkingBrake = !c.parkingBrake
                    bump()
                  }}
                >
                  PARK {c.parkingBrake ? 'SET' : 'OFF'}
                </button>
                <button
                  type="button"
                  className={c.lightsOn ? 'active' : ''}
                  onClick={() => {
                    c.lightsOn = !c.lightsOn
                    bump()
                  }}
                >
                  LIGHTS {c.lightsOn ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="sys-row">
                <button
                  type="button"
                  onClick={() => {
                    // Force CTOL / APL for emergency runway
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
                  Mode → {c.kind === 'f35' ? 'CTOL' : 'APL'}
                </button>
                <button
                  type="button"
                  className="warn"
                  onClick={() => {
                    sim.controls.tcl = 0
                    bump()
                  }}
                >
                  THR CUT
                </button>
              </div>
              <p className="dim">Checklist: gear DOWN · flaps as needed · PARK after stop · THR CUT if abort.</p>
            </div>
          )}

          {p === 'failures' && (
            <div>
              <p className="dim">Advanced cues — soft asymmetric / hydraulic.</p>
              <button
                type="button"
                className={c.failAsymmetric ? 'warn' : ''}
                onClick={() => {
                  c.failAsymmetric = !c.failAsymmetric
                  bump()
                }}
              >
                Asymmetric {c.failAsymmetric ? 'FAIL' : 'OK'}
              </button>
              <button
                type="button"
                className={c.failHyd ? 'warn' : ''}
                onClick={() => {
                  c.failHyd = !c.failHyd
                  bump()
                }}
              >
                Hydraulics {c.failHyd ? 'SLOW' : 'OK'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
