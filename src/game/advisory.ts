import type { Experience, Hud } from './types'

export type AdvisoryTone = 'info' | 'good' | 'warn' | 'danger'

export type FlightAdvisory = {
  eyebrow: string
  title: string
  detail: string
  tone: AdvisoryTone
}

export function flightAdvisory(hud: Hud, experience: Experience): FlightAdvisory | null {
  const power = Math.round(hud.tcl * 100)
  const descent = hud.vs < 0

  if (!hud.onGround && hud.alt < 35 && hud.vs < -5.5) {
    return {
      eyebrow: 'FLIGHT DIRECTOR',
      title: 'SINK RATE',
      detail: 'Add power and arrest the descent before touchdown.',
      tone: 'danger',
    }
  }

  if (!hud.onGround && hud.gearDown && hud.speed > 125) {
    return {
      eyebrow: 'CONFIGURATION',
      title: 'GEAR STILL DOWN',
      detail: 'Retract when safely airborne, or slow if you are setting up to land.',
      tone: 'warn',
    }
  }

  if (experience === 'advanced') return null

  if (hud.onGround) {
    if (hud.bird === 'osprey') {
      if (power < 8) {
        return {
          eyebrow: 'STARTUP',
          title: 'COLD ON THE PAD',
          detail: 'Choose hover with NAC toward HEL, or keep APL for an airplane-style departure.',
          tone: 'info',
        }
      }
      if (hud.nacelleDeg >= 70 && power < 62) {
        return {
          eyebrow: 'HOVER DEPARTURE',
          title: 'BUILD LIFT',
          detail: 'Hold level and raise TCL toward the hover band around 70%.',
          tone: 'info',
        }
      }
      if (hud.nacelleDeg < 20 && hud.speed < 38) {
        return {
          eyebrow: 'ROLLING DEPARTURE',
          title: 'ACCELERATE',
          detail: 'Keep the nose settled, build speed, then ease into the climb.',
          tone: 'good',
        }
      }
    } else {
      if (power < 8) {
        return {
          eyebrow: 'STARTUP',
          title: 'CTOL READY',
          detail: 'Release PARK, advance THR, and hold the runway centerline.',
          tone: 'info',
        }
      }
      if (hud.mode === 'CTOL' && hud.speed < 68) {
        return {
          eyebrow: 'TAKEOFF ROLL',
          title: 'BUILD AIRSPEED',
          detail: 'Stay straight with yaw. Rotation starts around 70–90 kt.',
          tone: 'good',
        }
      }
      if (hud.mode === 'CTOL' && hud.speed < 95) {
        return {
          eyebrow: 'TAKEOFF',
          title: 'ROTATE',
          detail: 'Casual stick-up raises the nose. Establish the climb before cleaning up.',
          tone: 'good',
        }
      }
    }
  }

  if (hud.bird === 'osprey' && hud.mode === 'CONV') {
    return {
      eyebrow: 'CONVERSION',
      title: hud.speed < 55 ? 'KEEP THE ENERGY' : 'WING COMING ALIVE',
      detail: hud.speed < 55
        ? 'Carry power while moving the nacelles. Avoid converting too fast at low airspeed.'
        : 'Airspeed is supporting the wing. Continue conversion smoothly.',
      tone: hud.speed < 55 ? 'warn' : 'good',
    }
  }

  if (hud.bird === 'f35' && (hud.mode === 'STOVL' || hud.mode === 'VL')) {
    return {
      eyebrow: hud.mode,
      title: descent && hud.alt < 75 ? 'WATCH THE DESCENT' : 'VECTOR CONTROL ACTIVE',
      detail: 'Use small inputs. Power controls sink strongly as vector approaches vertical.',
      tone: descent && hud.alt < 75 ? 'warn' : 'info',
    }
  }

  if (!hud.onGround && Math.abs(hud.vs) < 1.2 && hud.alt > 30) {
    return {
      eyebrow: 'FLIGHT DIRECTOR',
      title: 'STABLE',
      detail: 'Energy and vertical speed are settled. Small inputs will keep it clean.',
      tone: 'good',
    }
  }

  return null
}
