import { flightAdvisory } from '../game/advisory'
import type { Experience, Hud } from '../game/types'

type Props = {
  hud: Hud
  experience: Experience
  paused: boolean
}

export function FlightAdvisory({ hud, experience, paused }: Props) {
  if (paused) return null
  const advisory = flightAdvisory(hud, experience)
  if (!advisory) return null

  return (
    <div className={`flight-advisory tone-${advisory.tone}`}>
      <span className="flight-advisory-eyebrow">{advisory.eyebrow}</span>
      <strong>{advisory.title}</strong>
      <span>{advisory.detail}</span>
    </div>
  )
}
