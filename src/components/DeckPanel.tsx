import { InstrumentCluster } from './InstrumentCluster'
import type { Hud, Sim } from '../game/types'

type Props = {
  sim: Sim
  hud: Hud
  visible: boolean
  onToggle: () => void
  bump: () => void
}



/** Full game-style cockpit deck: primary instruments, systems, and flight controls. */
export function DeckPanel({ sim, hud, visible, onToggle, bump }: Props) {
  const c = sim.craft


  if (!visible) {
    return (
      <button type="button" className="deck-panel-tab" onClick={onToggle} title="Show cockpit">
        DECK
      </button>
    )
  }


  return (
    <div className="deck-panel" onClick={(e) => e.stopPropagation()}>
      <div className="deck-panel-head">
        <span className="deck-panel-title">COCKPIT · FLIGHT INSTRUMENTS</span>
        <button type="button" className="deck-panel-hide" onClick={onToggle} title="Hide deck">
          ▾
        </button>
      </div>

      <InstrumentCluster sim={sim} hud={hud} />

      <div className="deck-switches">
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
