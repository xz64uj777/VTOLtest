import { useCallback, useEffect, useRef } from 'react'
import type { InputState } from '../game/input'
import { resetSpringSticks } from '../game/input'
import { STICK_DEADZONE } from '../game/prefs'
import type { BirdKind } from '../game/types'

type Props = {
  input: InputState
  bird: BirdKind
  /** When true, hide left cyclic stick — gyro drives cyclic. */
  tiltCyclic?: boolean
  initialTcl?: number
  initialMode?: number
  /** Bump on Hangar→Fly / Reset so knobs re-sync to cold defaults. */
  syncKey?: number
}

export function VirtualControls({
  input,
  bird,
  tiltCyclic = false,
  initialTcl = 0,
  initialMode = 0,
  syncKey = 0,
}: Props) {
  const cyclicRef = useRef<HTMLDivElement>(null)
  const yawRef = useRef<HTMLDivElement>(null)
  const tclRef = useRef<HTMLDivElement>(null)
  const modeRef = useRef<HTMLDivElement>(null)
  const cyclicId = useRef<number | null>(null)
  const yawId = useRef<number | null>(null)
  const tclId = useRef<number | null>(null)
  const modeId = useRef<number | null>(null)

  const resetKnob = (el: HTMLDivElement | null) => {
    const knob = el?.querySelector('.stick-knob') as HTMLDivElement | null
    if (knob) knob.style.transform = 'translate(-50%, -50%)'
  }

  const resetYawKnob = () => {
    const knob = yawRef.current?.querySelector('.yaw-knob') as HTMLDivElement | null
    if (knob) knob.style.left = '50%'
  }

  const endCyclic = useCallback(() => {
    cyclicId.current = null
    input.stickX = 0
    input.stickY = 0
    resetKnob(cyclicRef.current)
  }, [input])

  const endYaw = useCallback(() => {
    yawId.current = null
    input.yawStick = 0
    resetYawKnob()
  }, [input])

  // If tilt turns on mid-flight, clear any held cyclic
  useEffect(() => {
    if (tiltCyclic) endCyclic()
  }, [tiltCyclic, endCyclic])

  useEffect(() => {
    const forceSpringEnd = () => {
      endCyclic()
      endYaw()
      tclId.current = null
      modeId.current = null
      resetSpringSticks(input)
    }
    const onVis = () => {
      if (document.visibilityState === 'hidden') forceSpringEnd()
    }
    window.addEventListener('blur', forceSpringEnd)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('blur', forceSpringEnd)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [endCyclic, endYaw, input])

  useEffect(() => {
    const el = tclRef.current
    if (!el) return
    const knob = el.querySelector('.slider-knob') as HTMLDivElement | null
    if (knob) knob.style.top = `${(1 - initialTcl) * 100}%`
    input.touchTcl = initialTcl
  }, [initialTcl, input, syncKey])

  useEffect(() => {
    const el = modeRef.current
    if (!el) return
    const knob = el.querySelector('.slider-knob') as HTMLDivElement | null
    if (knob) knob.style.top = `${(1 - initialMode) * 100}%`
    if (bird === 'osprey') {
      input.touchNacelle = initialMode
      input.touchVector = null
    } else {
      input.touchVector = initialMode
      input.touchNacelle = null
    }
  }, [initialMode, input, bird, syncKey])

  const moveCyclic = (el: HTMLDivElement, cx: number, cy: number) => {
    const r = el.getBoundingClientRect()
    const ox = r.left + r.width / 2
    const oy = r.top + r.height / 2
    const max = r.width * 0.42
    let dx = cx - ox
    let dy = cy - oy
    const mag = Math.hypot(dx, dy) || 1
    if (mag > max) {
      dx = (dx / mag) * max
      dy = (dy / mag) * max
    }
    const nx = dx / max
    const ny = dy / max
    if (Math.hypot(nx, ny) < STICK_DEADZONE) {
      input.stickX = 0
      input.stickY = 0
      const knob = el.querySelector('.stick-knob') as HTMLDivElement | null
      if (knob) knob.style.transform = 'translate(-50%, -50%)'
      return
    }
    // Screen up (ny negative) → stickY + → Casual pitchSign → nose UP
    input.stickX = nx
    input.stickY = -ny
    const knob = el.querySelector('.stick-knob') as HTMLDivElement | null
    if (knob) knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
  }

  const moveYawBar = (el: HTMLDivElement, cx: number) => {
    const r = el.getBoundingClientRect()
    const ox = r.left + r.width / 2
    const max = r.width * 0.42
    let dx = cx - ox
    if (Math.abs(dx) > max) dx = Math.sign(dx) * max
    const nx = dx / max
    if (Math.abs(nx) < STICK_DEADZONE) {
      input.yawStick = 0
      resetYawKnob()
      return
    }
    input.yawStick = nx
    const knob = el.querySelector('.yaw-knob') as HTMLDivElement | null
    if (knob) knob.style.left = `${50 + nx * 42}%`
  }

  const onCyclicStart = (e: React.PointerEvent) => {
    e.preventDefault()
    const el = cyclicRef.current
    if (!el) return
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    cyclicId.current = e.pointerId
    moveCyclic(el, e.clientX, e.clientY)
  }
  const onCyclicMove = (e: React.PointerEvent) => {
    if (cyclicId.current !== e.pointerId) return
    const el = cyclicRef.current
    if (!el) return
    moveCyclic(el, e.clientX, e.clientY)
  }
  const onCyclicEnd = (e: React.PointerEvent) => {
    if (cyclicId.current !== null && cyclicId.current !== e.pointerId) return
    endCyclic()
  }

  const onYawStart = (e: React.PointerEvent) => {
    e.preventDefault()
    const el = yawRef.current
    if (!el) return
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    yawId.current = e.pointerId
    moveYawBar(el, e.clientX)
  }
  const onYawMove = (e: React.PointerEvent) => {
    if (yawId.current !== e.pointerId) return
    const el = yawRef.current
    if (!el) return
    moveYawBar(el, e.clientX)
  }
  const onYawEnd = (e: React.PointerEvent) => {
    if (yawId.current !== null && yawId.current !== e.pointerId) return
    endYaw()
  }

  const sliderMove = (el: HTMLDivElement, clientY: number, set: (v: number) => void) => {
    const r = el.getBoundingClientRect()
    const t = 1 - (clientY - r.top) / r.height
    const v = Math.max(0, Math.min(1, t))
    set(v)
    const knob = el.querySelector('.slider-knob') as HTMLDivElement | null
    if (knob) knob.style.top = `${(1 - v) * 100}%`
  }

  const onTclStart = (e: React.PointerEvent) => {
    e.preventDefault()
    const el = tclRef.current
    if (!el) return
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    tclId.current = e.pointerId
    sliderMove(el, e.clientY, (v) => {
      input.touchTcl = v
    })
  }
  const onTclMove = (e: React.PointerEvent) => {
    if (tclId.current !== e.pointerId) return
    const el = tclRef.current
    if (!el) return
    sliderMove(el, e.clientY, (v) => {
      input.touchTcl = v
    })
  }
  const onTclEnd = (e: React.PointerEvent) => {
    if (tclId.current !== null && tclId.current !== e.pointerId) return
    tclId.current = null
  }

  const onModeStart = (e: React.PointerEvent) => {
    e.preventDefault()
    const el = modeRef.current
    if (!el) return
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    modeId.current = e.pointerId
    sliderMove(el, e.clientY, (v) => {
      if (bird === 'osprey') input.touchNacelle = v
      else input.touchVector = v
    })
  }
  const onModeMove = (e: React.PointerEvent) => {
    if (modeId.current !== e.pointerId) return
    const el = modeRef.current
    if (!el) return
    sliderMove(el, e.clientY, (v) => {
      if (bird === 'osprey') input.touchNacelle = v
      else input.touchVector = v
    })
  }
  const onModeEnd = (e: React.PointerEvent) => {
    if (modeId.current !== null && modeId.current !== e.pointerId) return
    modeId.current = null
  }

  const powerLabel = bird === 'f35' ? 'THR' : 'TCL'
  const modeLabel = bird === 'f35' ? 'VEC' : 'NAC'
  const modeHi = bird === 'f35' ? 'VL' : 'HEL'
  const modeLo = bird === 'f35' ? 'CTOL' : 'APL'

  const yawBar = (
    <div
      ref={yawRef}
      className="yaw-bar"
      aria-label="Yaw"
      onPointerDown={onYawStart}
      onPointerMove={onYawMove}
      onPointerUp={onYawEnd}
      onPointerCancel={onYawEnd}
      onLostPointerCapture={() => endYaw()}
    >
      <div className="yaw-label">YAW</div>
      <div className="yaw-lo">L</div>
      <div className="yaw-hi">R</div>
      <div className="yaw-track" />
      <div className="yaw-knob" />
    </div>
  )

  return (
    <div className={`virt ${tiltCyclic ? 'virt-tilt' : 'virt-cyclic'}`}>
      {/* LEFT: yaw (+ cyclic stick when tilt off) */}
      <div className="virt-left">
        {!tiltCyclic && (
          <div
            ref={cyclicRef}
            className="stick"
            onPointerDown={onCyclicStart}
            onPointerMove={onCyclicMove}
            onPointerUp={onCyclicEnd}
            onPointerCancel={onCyclicEnd}
            onLostPointerCapture={() => endCyclic()}
          >
            <div className="stick-label">CYC</div>
            <div className="stick-knob" />
          </div>
        )}
        {yawBar}
      </div>

      {/* RIGHT: throttle + rotation (NAC / VEC) */}
      <div className="virt-right virt-sliders">
        <div
          ref={tclRef}
          className="slider tcl-slider"
          onPointerDown={onTclStart}
          onPointerMove={onTclMove}
          onPointerUp={onTclEnd}
          onPointerCancel={onTclEnd}
        >
          <div className="slider-label">{powerLabel}</div>
          <div className="slider-track" />
          <div className="slider-knob" />
        </div>
        <div
          ref={modeRef}
          className={`slider nac-slider ${bird === 'f35' ? 'vec-slider' : ''}`}
          onPointerDown={onModeStart}
          onPointerMove={onModeMove}
          onPointerUp={onModeEnd}
          onPointerCancel={onModeEnd}
        >
          <div className="slider-label">{modeLabel}</div>
          <div className="slider-hi">{modeHi}</div>
          <div className="slider-lo">{modeLo}</div>
          <div className="slider-track" />
          <div className={`slider-knob ${bird === 'f35' ? 'vec-knob' : 'nac-knob'}`} />
        </div>
      </div>
    </div>
  )
}
