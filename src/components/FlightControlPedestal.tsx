import { trySetGearDown } from '../game/physics'
import type { Sim } from '../game/types'

type Props = {
  sim: Sim
  bump: () => void
}

const FLAP_STEPS = [0, 0.25, 0.5, 1] as const
const FLAP_LABELS = ['UP', '1', '2', 'FULL'] as const

function nearestFlapIndex(v: number): number {
  let best = 0
  let dist = Number.POSITIVE_INFINITY
  for (let i = 0; i < FLAP_STEPS.length; i++) {
    const d = Math.abs(v - FLAP_STEPS[i]!)
    if (d < dist) {
      dist = d
      best = i
    }
  }
  return best
}

function gearLampClass(pos: number): string {
  if (pos >= 0.985) return 'gear-indicator green'
  if (pos <= 0.015) return 'gear-indicator dark'
  return 'gear-indicator amber'
}

export function FlightControlPedestal({ sim, bump }: Props) {
  const c = sim.craft
  const gearTransit =
    !(c.gearNosePos >= 0.985 && c.gearLeftPos >= 0.985 && c.gearRightPos >= 0.985) &&
    !(c.gearNosePos <= 0.015 && c.gearLeftPos <= 0.015 && c.gearRightPos <= 0.015)
  const flapIndex = nearestFlapIndex(c.flaps)

  const setGearFromPointer = (e: React.PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const wantDown = e.clientY >= r.top + r.height / 2
    const ok = trySetGearDown(c, wantDown)
    if (!ok) sim.message = 'GEAR LOCKED — weight on wheels'
    bump()
  }

  const setFlapsFromPointer = (e: React.PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const t = Math.max(0, Math.min(0.999, (e.clientY - r.top) / Math.max(1, r.height)))
    const index = Math.max(0, Math.min(FLAP_STEPS.length - 1, Math.round(t * (FLAP_STEPS.length - 1))))
    const next = FLAP_STEPS[index]!
    sim.controls.flaps = next
    bump()
  }

  return (
    <div className="flight-control-pedestal">
      <div className="gear-control-unit">
        <div className="control-unit-title">LANDING GEAR</div>
        <div className="gear-status-bank" aria-label="Landing gear indicators">
          <div>
            <i className={gearLampClass(c.gearNosePos)} />
            <span>N</span>
          </div>
          <div>
            <i className={gearLampClass(c.gearLeftPos)} />
            <span>L</span>
          </div>
          <div>
            <i className={gearLampClass(c.gearRightPos)} />
            <span>R</span>
          </div>
        </div>
        <div className={`gear-unsafe ${gearTransit ? 'lit' : ''}`}>
          {gearTransit ? 'UNSAFE' : c.gearDown ? '3 GREEN' : 'GEAR UP'}
        </div>
        <button
          type="button"
          className={`gear-lever-track ${c.gearCommandDown ? 'command-down' : 'command-up'}`}
          onPointerDown={setGearFromPointer}
          title="Tap upper half for UP, lower half for DOWN"
        >
          <span className="lever-mark lever-mark-up">UP</span>
          <span className="lever-mark lever-mark-down">DN</span>
          <i className="gear-lever-handle">
            <b />
          </i>
        </button>
      </div>

      <div className="flap-control-unit">
        <div className="control-unit-title">FLAPS</div>
        <button
          type="button"
          className="flap-lever-track"
          onPointerDown={setFlapsFromPointer}
          title="Tap a detent to set flaps"
        >
          {FLAP_LABELS.map((label, i) => (
            <span
              key={label}
              className={`flap-detent ${flapIndex === i ? 'selected' : ''}`}
              style={{ top: `${12 + i * 25}%` }}
            >
              <i />
              <b>{label}</b>
            </span>
          ))}
          <i
            className="flap-lever-handle"
            style={{ top: `${12 + flapIndex * 25}%` }}
          />
        </button>
        <div className="flap-readout">
          {FLAP_LABELS[flapIndex]} · {Math.round(FLAP_STEPS[flapIndex]! * 100)}%
        </div>
      </div>
    </div>
  )
}
