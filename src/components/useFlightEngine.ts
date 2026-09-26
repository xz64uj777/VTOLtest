import { useCallback, useEffect, useRef, useState } from 'react'
import type { QualityKey } from '../game/config'
import { FlightAudio } from '../game/audio'
import {
  bindGyro,
  bindKeyboard,
  createInput,
  gyroIsSustained,
  requestGyroPermission,
  resetGyroTracking,
  sampleControls,
  type GyroBind,
} from '../game/input'
import {
  defaultPrefs,
  GYRO_HOLDOVER_MS,
  GYRO_LIVE_MS,
  TILT_NO_SIGNAL_HINT,
  type FlightPrefs,
  type PitchMode,
  type SensKey,
  type TiltHeartbeat,
} from '../game/prefs'
import { Renderer } from '../game/render'
import {
  createSim,
  cycleCamera,
  hudFrom,
  resetCameraView,
  resetToHangar,
  startFlight,
  stepSim,
} from '../game/sim'
import type { BirdKind, Experience, SystemsPanel } from '../game/types'
import type { LevelReading } from './HUD'
type Props = {
  quality: QualityKey
  experience: Experience
  bird: BirdKind
  onHangar: () => void
}
export function useFlightEngine({ quality, experience, bird, onHangar }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef(createSim(quality, experience, bird))
  const inputRef = useRef(createInput())
  const prefsRef = useRef<FlightPrefs>({ ...defaultPrefs(), experience })
  const rendererRef = useRef(new Renderer())
  const audioRef = useRef(new FlightAudio())
  const gyroRef = useRef<GyroBind | null>(null)
  const pendingCalRef = useRef(false)
  const fallbackTriedRef = useRef(false)
  const tiltOnAtRef = useRef(0)
  const noSignalStickyRef = useRef(false)
  const gyroEverLiveRef = useRef(false)
  const reconnectNeedsSlewRef = useRef(false)
  const [hud, setHud] = useState(() => hudFrom(simRef.current))
  const [message, setMessage] = useState('')
  const [paused, setPaused] = useState(false)
  const [controlsSync, setControlsSync] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [prefs, setPrefs] = useState<FlightPrefs>(() => ({ ...defaultPrefs(), experience }))
  const [calStatus, setCalStatus] = useState<string | null>(null)
  const [tiltHb, setTiltHb] = useState<TiltHeartbeat>('off')
  const [tiltSticky, setTiltSticky] = useState<string | null>(null)
  const [levelReading, setLevelReading] = useState<LevelReading>({
    pitchDeg: 0,
    bankDeg: 0,
    level: true,
    source: 'craft',
  })
  const calFrozenRef = useRef(false)
  const pausedRef = useRef(false)
  const menuOpenRef = useRef(false)
  const showSettingsRef = useRef(false)
  const [tick, setTick] = useState(0)
  const bump = useCallback(() => setTick((t) => t + 1), [])
  const [deckOpen, setDeckOpen] = useState(experience !== 'casual')
  const camTouchRef = useRef<{
    id: number | null
    x: number
    y: number
    moved: boolean
    lastTap: number
  }>({ id: null, x: 0, y: 0, moved: false, lastTap: 0 })
  const patchPrefs = useCallback((partial: Partial<FlightPrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...partial }
      prefsRef.current = next
      return next
    })
  }, [])
  useEffect(() => {
    pausedRef.current = paused
  }, [paused])
  useEffect(() => {
    menuOpenRef.current = menuOpen
  }, [menuOpen])
  useEffect(() => {
    showSettingsRef.current = showSettings
  }, [showSettings])
  useEffect(() => {
    audioRef.current.mute(paused || menuOpen || showSettings)
  }, [paused, menuOpen, showSettings])
  useEffect(() => {
    prefsRef.current = prefs
  }, [prefs])
  useEffect(() => {
    prefsRef.current.experience = experience
    simRef.current.experience = experience
    simRef.current.quality = quality
    setDeckOpen(experience !== 'casual')
  }, [experience, quality])
  useEffect(() => {
    const sim = simRef.current
    sim.bird = bird
    sim.experience = experience
    sim.quality = quality
    startFlight(sim)
    inputRef.current.touchTcl = 0
    inputRef.current.touchNacelle = 0
    inputRef.current.touchVector = 0
    setControlsSync((n) => n + 1)
    const base = { ...defaultPrefs(), experience, tipSeen: false }
    prefsRef.current = {
      ...base,
      sens: prefsRef.current.sens,
      pitchMode: prefsRef.current.pitchMode,
      tiltCyclic: prefsRef.current.tiltCyclic,
      gyroZeroBeta: prefsRef.current.gyroZeroBeta,
      gyroZeroGamma: prefsRef.current.gyroZeroGamma,
      gyroReady: prefsRef.current.gyroReady,
    }
    setPrefs(prefsRef.current)
    const unbind = bindKeyboard(inputRef.current)
    const gyro = bindGyro(inputRef.current)
    gyroRef.current = gyro
    audioRef.current.start()
    let raf = 0
    let last = performance.now()
    let hudAcc = 0
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const sim = simRef.current
      sim.paused = pausedRef.current
      const controls = sampleControls(
        inputRef.current,
        sim.controls,
        sim.paused ? 0 : dt,
        prefsRef.current,
        sim.bird,
      )
      stepSim(sim, controls, dt)
      audioRef.current.update(
        sim.craft.rotorRpm,
        sim.controls.tcl,
        sim.bird === 'f35' ? sim.craft.vectorPos : sim.craft.nacelleDeg,
        sim.bird,
      )
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2)
          const w = canvas.clientWidth
          const h = canvas.clientHeight
          if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
            canvas.width = Math.floor(w * dpr)
            canvas.height = Math.floor(h * dpr)
          }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          rendererRef.current.draw(ctx, sim, w, h, dt)
        }
      }
      hudAcc += dt
      if (hudAcc > 0.1) {
        hudAcc = 0
        setHud(hudFrom(sim))
        setMessage(sim.message)
        const p = prefsRef.current
        const inp = inputRef.current
        const gyroLevel = p.tiltCyclic && p.gyroReady && inp.gyroActive
        const pitchDeg = gyroLevel
          ? inp.gyroBeta - p.gyroZeroBeta
          : (sim.craft.pitch * 180) / Math.PI
        const bankDeg = gyroLevel
          ? inp.gyroGamma - p.gyroZeroGamma
          : (sim.craft.roll * 180) / Math.PI
        setLevelReading({
          pitchDeg,
          bankDeg,
          level: Math.abs(pitchDeg) < 3.5 && Math.abs(bankDeg) < 3.5,
          source: gyroLevel ? 'tilt' : 'craft',
        })
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyC') cycleCamera(simRef.current)
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (e.code === 'Escape' && (menuOpenRef.current || showSettingsRef.current)) {
          setMenuOpen(false)
          setShowSettings(false)
          simRef.current.systemsPanel = 'none'
          return
        }
        setPaused((p) => !p)
      }
      if (e.code === 'KeyH') {
        setMenuOpen((m) => {
          const next = !m
          if (next) setPaused(true)
          return next
        })
      }
      if (e.code === 'Comma' && e.shiftKey) {
        setShowSettings((s) => {
          const next = !s
          if (next) setPaused(true)
          return next
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      unbind()
      gyro.stop()
      gyroRef.current = null
      window.removeEventListener('keydown', onKey)
      audioRef.current.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experience, bird, quality])
  useEffect(() => {
    if (!prefs.tiltCyclic) {
      setTiltHb('off')
      pendingCalRef.current = false
      fallbackTriedRef.current = false
      noSignalStickyRef.current = false
      gyroEverLiveRef.current = false
      reconnectNeedsSlewRef.current = false
      setTiltSticky(null)
      return
    }
    const tick = () => {
      const input = inputRef.current
      const now = performance.now()
      const sustained = gyroIsSustained(input, now)
      const prefsNow = prefsRef.current
      const age = input.gyroLastMs > 0 ? now - input.gyroLastMs : Number.POSITIVE_INFINITY
      const waited = now - tiltOnAtRef.current
      if (sustained) {
        gyroEverLiveRef.current = true
        noSignalStickyRef.current = false
        setTiltSticky(null)
        setTiltHb('live')
        if (pendingCalRef.current) {
          pendingCalRef.current = false
          calFrozenRef.current = true
          reconnectNeedsSlewRef.current = false
          input.gyroBlend = 1
          patchPrefs({
            gyroReady: true,
            gyroZeroBeta: input.gyroBeta,
            gyroZeroGamma: input.gyroGamma,
          })
          setCalStatus('Calibrated')
          window.setTimeout(() => setCalStatus(null), 1400)
        } else if (calFrozenRef.current && !prefsNow.gyroReady) {
          input.gyroBlend = reconnectNeedsSlewRef.current ? 0 : 1
          reconnectNeedsSlewRef.current = false
          patchPrefs({ gyroReady: true })
        }
        return
      }
      const lockedBefore = gyroEverLiveRef.current || calFrozenRef.current
      const inHoldover = lockedBefore && !reconnectNeedsSlewRef.current && age < GYRO_HOLDOVER_MS
      if (inHoldover) {
        setTiltHb('live')
        setTiltSticky(null)
        if (calFrozenRef.current && !prefsNow.gyroReady) {
          patchPrefs({ gyroReady: true })
        }
        if (age >= GYRO_LIVE_MS) {
          gyroRef.current?.tryAbsoluteFallback()
        }
        return
      }
      const trueSilence = lockedBefore
        ? age >= GYRO_HOLDOVER_MS
        : waited >= GYRO_HOLDOVER_MS && age >= GYRO_HOLDOVER_MS
      if (trueSilence || reconnectNeedsSlewRef.current) {
        if (prefsNow.gyroReady) {
          reconnectNeedsSlewRef.current = true
          patchPrefs({ gyroReady: false })
        }
        noSignalStickyRef.current = true
        setTiltHb('no-signal')
        setTiltSticky(TILT_NO_SIGNAL_HINT)
        setCalStatus(null)
        gyroRef.current?.tryAbsoluteFallback()
      } else {
        setTiltHb('pending')
      }
      if (!fallbackTriedRef.current && waited >= GYRO_LIVE_MS) {
        fallbackTriedRef.current = true
        gyroRef.current?.tryAbsoluteFallback()
      }
    }
    tick()
    const id = window.setInterval(tick, 200)
    return () => window.clearInterval(id)
  }, [prefs.tiltCyclic, patchPrefs])
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onStart = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (camTouchRef.current.id !== null) return
      camTouchRef.current = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        moved: false,
        lastTap: camTouchRef.current.lastTap,
      }
      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {
      }
    }
    const onMove = (e: PointerEvent) => {
      const t = camTouchRef.current
      if (t.id !== e.pointerId) return
      const dx = e.clientX - t.x
      const dy = e.clientY - t.y
      if (Math.hypot(dx, dy) > 6) t.moved = true
      t.x = e.clientX
      t.y = e.clientY
      const cam = simRef.current.cam
      cam.yawOff = (cam.yawOff || 0) - dx * 0.0045
      cam.pitchOff = Math.max(-0.55, Math.min(0.45, (cam.pitchOff || 0) + dy * 0.0032))
    }
    const onEnd = (e: PointerEvent) => {
      const t = camTouchRef.current
      if (t.id !== e.pointerId) return
      const now = performance.now()
      if (!t.moved && now - t.lastTap < 320) {
        resetCameraView(simRef.current)
        t.lastTap = 0
      } else if (!t.moved) {
        t.lastTap = now
      }
      t.id = null
      try {
        canvas.releasePointerCapture(e.pointerId)
      } catch {
      }
    }
    canvas.addEventListener('pointerdown', onStart)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onEnd)
    canvas.addEventListener('pointercancel', onEnd)
    return () => {
      canvas.removeEventListener('pointerdown', onStart)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onEnd)
      canvas.removeEventListener('pointercancel', onEnd)
    }
  }, [experience, bird, quality])
  const goHangar = () => {
    audioRef.current.mute(true)
    resetToHangar(simRef.current)
    onHangar()
  }
  const onPanel = (p: SystemsPanel) => {
    simRef.current.systemsPanel = p
    bump()
  }
  const cycleSens = () => {
    const order: SensKey[] = ['low', 'med', 'high']
    const i = order.indexOf(prefs.sens)
    patchPrefs({ sens: order[(i + 1) % order.length]! })
  }
  const togglePitchMode = () => {
    const next: PitchMode = prefs.pitchMode === 'realistic' ? 'casual' : 'realistic'
    patchPrefs({ pitchMode: next })
  }
  const toggleInvertPitch = () => {
    patchPrefs({ invertPitch: !prefs.invertPitch })
  }
  const toggleInvertRoll = () => {
    patchPrefs({ invertRoll: !prefs.invertRoll })
  }
  const toggleTilt = async () => {
    if (prefs.tiltCyclic) {
      pendingCalRef.current = false
      fallbackTriedRef.current = false
      noSignalStickyRef.current = false
      gyroEverLiveRef.current = false
      reconnectNeedsSlewRef.current = false
      calFrozenRef.current = false
      patchPrefs({ tiltCyclic: false, gyroReady: false })
      setTiltHb('off')
      setCalStatus(null)
      setTiltSticky(null)
      return
    }
    const perm = await requestGyroPermission()
    if (perm === 'denied') {
      setCalStatus('Tilt permission denied')
      setTiltHb('off')
      return
    }
    if (perm === 'unsupported') {
      setCalStatus('Tilt unsupported')
      setTiltHb('off')
      return
    }
    resetGyroTracking(inputRef.current)
    fallbackTriedRef.current = false
    pendingCalRef.current = true
    noSignalStickyRef.current = false
    gyroEverLiveRef.current = false
    reconnectNeedsSlewRef.current = false
    tiltOnAtRef.current = performance.now()
    patchPrefs({ tiltCyclic: true, gyroReady: false })
    setTiltHb('pending')
    setTiltSticky(null)
    setCalStatus('Hold still…')
  }
  const recalibrate = () => {
    if (!prefs.tiltCyclic) return
    const input = inputRef.current
    if (!gyroIsSustained(input)) {
      noSignalStickyRef.current = true
      setTiltHb('no-signal')
      setTiltSticky(TILT_NO_SIGNAL_HINT)
      return
    }
    pendingCalRef.current = true
    setCalStatus('Hold still…')
    window.setTimeout(() => {
      if (!pendingCalRef.current) return
      if (!gyroIsSustained(inputRef.current)) {
        pendingCalRef.current = false
        noSignalStickyRef.current = true
        setTiltHb('no-signal')
        setTiltSticky(TILT_NO_SIGNAL_HINT)
        return
      }
      const inp = inputRef.current
      pendingCalRef.current = false
      calFrozenRef.current = true
      inp.gyroBlend = 1
      reconnectNeedsSlewRef.current = false
      patchPrefs({
        gyroReady: true,
        gyroZeroBeta: inp.gyroBeta,
        gyroZeroGamma: inp.gyroGamma,
      })
      setCalStatus('Calibrated')
      window.setTimeout(() => setCalStatus(null), 1400)
    }, 400)
  }
  const initialMode = 0 // cold: NAC APL / VEC CTOL
  const bannerMsg = calStatus || tiltSticky || message
  return {
    canvasRef,
    simRef,
    inputRef,
    hud,
    message,
    paused,
    setPaused,
    controlsSync,
    setControlsSync,
    menuOpen,
    setMenuOpen,
    showSettings,
    setShowSettings,
    prefs,
    calStatus,
    tiltHb,
    tiltSticky,
    levelReading,
    deckOpen,
    setDeckOpen,
    tick,
    bump,
    patchPrefs,
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
    bird,
    experience,
    quality,
  }
}
