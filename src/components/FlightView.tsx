import type { QualityKey } from '../game/config'
import { cycleCamera, resetCameraView, startFlight } from '../game/sim'
import type { BirdKind, Experience } from '../game/types'
import { DeckPanel } from './DeckPanel'
import { FlightAdvisory } from './FlightAdvisory'
import { HUD } from './HUD'
import { SystemsMenu } from './SystemsMenu'
import { VirtualControls } from './VirtualControls'
import { useFlightEngine } from './useFlightEngine'
import type { TiltHeartbeat } from '../game/prefs'

type Props = {
  quality: QualityKey
  experience: Experience
  bird: BirdKind
  onHangar: () => void
}

function tiltLabel(hb: TiltHeartbeat, on: boolean): string {
  if (!on) return 'Tilt · OFF'
  if (hb === 'live') return 'Tilt · live'
  if (hb === 'no-signal') return 'Tilt · no signal'
  return 'Tilt · …'
}

export function FlightView({ quality, experience, bird, onHangar }: Props) {
  const {
    canvasRef,
    simRef,
    inputRef,
    hud,
    paused,
    setPaused,
    controlsSync,
    setControlsSync,
    menuOpen,
    setMenuOpen,
    showSettings,
    setShowSettings,
    prefs,
    tiltHb,
    tiltSticky,
    levelReading,
    deckOpen,
    setDeckOpen,
    tick,
    bump,
    goHangar,
    onPanel,
    cycleSens,
    togglePitchMode,
    toggleInvertPitch,
    toggleInvertRoll,
    toggleTilt,
    recalibrate,
    initialMode,
    bannerMsg,
  } = useFlightEngine({ quality, experience, bird, onHangar })

  return (
    <div className={`flight flight-${bird}`}>
      <div className="flight-brand" aria-hidden><span>OSPREY FLIGHT</span><small>v12</small></div>
      <canvas ref={canvasRef} className="flight-canvas" />
      <HUD hud={hud} message={bannerMsg} paused={paused} level={levelReading} />
      <FlightAdvisory hud={hud} experience={experience} paused={paused} />

      <div className="flight-top">
        <button
          type="button"
          className="deck-btn"
          onClick={() => {
            setMenuOpen(true)
            setPaused(true)
          }}
        >
          Menu
        </button>
        <button
          type="button"
          className={`deck-btn ${showSettings ? 'active' : ''}`}
          onClick={() => {
            setShowSettings((s) => {
              const next = !s
              if (next) setPaused(true)
              return next
            })
          }}
        >
          Settings
        </button>
        <button
          type="button"
          className={`deck-btn ${prefs.tiltCyclic ? 'active' : ''}`}
          onClick={toggleTilt}
          title="Phone tilt → cyclic"
        >
          {tiltLabel(tiltHb, prefs.tiltCyclic)}
        </button>
        {prefs.tiltCyclic && (
          <button
            type="button"
            className="deck-btn"
            disabled={tiltHb !== 'live'}
            onClick={recalibrate}
          >
            Cal
          </button>
        )}
        <button
          type="button"
          className="deck-btn"
          onClick={(e) => {
            const now = performance.now()
            const last = (e.currentTarget as HTMLButtonElement & { _lastTap?: number })._lastTap ?? 0
            if (now - last < 320) {
              resetCameraView(simRef.current)
              ;(e.currentTarget as HTMLButtonElement & { _lastTap?: number })._lastTap = 0
            } else {
              cycleCamera(simRef.current)
              bump()
              ;(e.currentTarget as HTMLButtonElement & { _lastTap?: number })._lastTap = now
            }
          }}
          title="Tap: next view · Double-tap: reset"
        >
          Cam
        </button>
        <button type="button" className="deck-btn" onClick={() => setPaused((p) => !p)}>
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>

      {showSettings && (
        <div className="settings-sheet" onClick={(e) => e.stopPropagation()}>
          <h3>Settings</h3>
          <div className="settings-row">
            <span>Sensitivity</span>
            <button type="button" onClick={cycleSens}>
              Sens · {prefs.sens}
            </button>
          </div>
          <div className="settings-row">
            <span>Pitch</span>
            <button type="button" onClick={togglePitchMode}>
              {prefs.pitchMode === 'realistic' ? 'Realistic' : 'Casual'}
            </button>
          </div>
          <p className="settings-hint">
            Casual (default): stick-up / W → nose UP. Realistic: heli nose-down.
          </p>
          <div className="settings-row">
            <span>Tilt cyclic</span>
            <button
              type="button"
              className={prefs.tiltCyclic ? 'active' : ''}
              onClick={toggleTilt}
            >
              {tiltLabel(tiltHb, prefs.tiltCyclic)}
            </button>
          </div>
          {prefs.tiltCyclic && (
            <div className="settings-row">
              <span>Gyro zero</span>
              <button type="button" disabled={tiltHb !== 'live'} onClick={recalibrate}>
                Recalibrate
              </button>
            </div>
          )}
          <p className="settings-hint">
            Recalibrate only when <strong>Tilt · live</strong> and phone is wings-level (see Level cue).
            Zero freezes after Cal — no mid-flight auto-recal. Closing Settings does not resume —
            tap Resume. Tilt ON hides left CYC stick. Laptops have no gyro — use a phone for Tilt.
          </p>
          {tiltSticky && <p className="settings-hint tilt-sticky-hint">{tiltSticky}</p>}
          <div className="settings-row">
            <span>Leave sortie</span>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Return to Hangar? Sortie will restart.')) goHangar()
              }}
            >
              Hangar…
            </button>
          </div>
          <p className="settings-hint">Hangar ends the sortie — Pause/Resume stays on the flight bar.</p>
          <button type="button" className="settings-close" onClick={() => setShowSettings(false)}>
            Close
          </button>
        </div>
      )}

      {simRef.current.crashed && (
        <div className="crash-banner">
          <p>{simRef.current.message || 'Hard landing'}</p>
          <button
            type="button"
            onClick={() => {
              startFlight(simRef.current)
              inputRef.current.touchTcl = 0
              inputRef.current.touchNacelle = 0
              inputRef.current.touchVector = 0
              setControlsSync((n) => n + 1)
              bump()
            }}
          >
            Reset
          </button>
          <button type="button" onClick={goHangar}>
            Hangar
          </button>
        </div>
      )}

      <DeckPanel
        sim={simRef.current}
        hud={hud}
        visible={deckOpen}
        onToggle={() => setDeckOpen((v) => !v)}
        bump={bump}
      />

      <VirtualControls
        input={inputRef.current}
        bird={bird}
        tiltCyclic={prefs.tiltCyclic}
        initialTcl={0}
        initialMode={initialMode}
        syncKey={controlsSync}
      />

      <SystemsMenu
        sim={simRef.current}
        open={menuOpen}
        onClose={() => {
          setMenuOpen(false)
          simRef.current.systemsPanel = 'none'
        }}
        onPanel={onPanel}
        bump={bump}
        prefs={prefs}
        tiltHb={tiltHb}
        onTilt={toggleTilt}
        onRecalibrate={recalibrate}
        onSens={cycleSens}
        onPitchMode={togglePitchMode}
        onInvertPitch={toggleInvertPitch}
        onInvertRoll={toggleInvertRoll}
      />
      <span className="sr-only">{tick}</span>
    </div>
  )
}
