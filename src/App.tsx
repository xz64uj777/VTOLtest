import { useEffect, useState } from 'react'
import type { QualityKey } from './game/config'
import type { BirdKind, Experience } from './game/types'
import { FlightView } from './components/FlightView'
import { Hangar } from './components/Hangar'

type StoredSetup = {
  quality?: QualityKey
  experience?: Experience
  bird?: BirdKind
}

const STORAGE_KEY = 'osprey-flight-setup-v12'

function loadSetup(): StoredSetup {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredSetup) : {}
  } catch {
    return {}
  }
}

export default function App() {
  const initial = loadSetup()
  const [phase, setPhase] = useState<'hangar' | 'flight'>('hangar')
  const [quality, setQuality] = useState<QualityKey>(initial.quality ?? 'med')
  const [experience, setExperience] = useState<Experience>(initial.experience ?? 'intermediate')
  const [bird, setBird] = useState<BirdKind>(initial.bird ?? 'osprey')

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ quality, experience, bird }))
    } catch {
      // Private browsing / embedded WebViews may not expose storage.
    }
  }, [quality, experience, bird])

  if (phase === 'hangar') {
    return (
      <div className="app">
        <Hangar
          quality={quality}
          experience={experience}
          bird={bird}
          onQuality={setQuality}
          onExperience={setExperience}
          onBird={setBird}
          onFly={() => setPhase('flight')}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <FlightView
        quality={quality}
        experience={experience}
        bird={bird}
        onHangar={() => setPhase('hangar')}
      />
    </div>
  )
}
