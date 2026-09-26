/** Distinct Osprey proprotor slap vs F-35 fighter jet roar via WebAudio. */

import type { BirdKind } from './types'

export class FlightAudio {
  private ctx: AudioContext | null = null
  private oscA: OscillatorNode | null = null
  private oscB: OscillatorNode | null = null
  private oscC: OscillatorNode | null = null
  private oscD: OscillatorNode | null = null
  private oscE: OscillatorNode | null = null
  private gain: GainNode | null = null
  private thumpGain: GainNode | null = null
  private roarGain: GainNode | null = null
  private screamGain: GainNode | null = null
  private abGain: GainNode | null = null
  private masterGain: GainNode | null = null
  private filter: BiquadFilterNode | null = null
  private roarFilter: BiquadFilterNode | null = null
  private screamFilter: BiquadFilterNode | null = null
  private abFilter: BiquadFilterNode | null = null
  private lfo: OscillatorNode | null = null
  private lfoGain: GainNode | null = null
  private noise: AudioBufferSourceNode | null = null
  private noiseGain: GainNode | null = null
  private noiseFilter: BiquadFilterNode | null = null
  private abNoise: AudioBufferSourceNode | null = null
  private abNoiseGain: GainNode | null = null
  private started = false
  private muted = false
  private bird: BirdKind = 'osprey'
  private routedF35 = false

  ensure() {
    if (this.ctx) return
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    this.ctx = new AC()

    this.gain = this.ctx.createGain()
    this.gain.gain.value = 0
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = this.muted ? 0 : 1
    this.gain.connect(this.masterGain)
    this.masterGain.connect(this.ctx.destination)

    this.filter = this.ctx.createBiquadFilter()
    this.filter.connect(this.gain)

    this.oscA = this.ctx.createOscillator()
    this.oscB = this.ctx.createOscillator()
    this.oscC = this.ctx.createOscillator()
    this.oscD = this.ctx.createOscillator()
    this.oscE = this.ctx.createOscillator()
    this.thumpGain = this.ctx.createGain()
    this.roarGain = this.ctx.createGain()
    this.screamGain = this.ctx.createGain()
    this.abGain = this.ctx.createGain()
    this.roarFilter = this.ctx.createBiquadFilter()
    this.screamFilter = this.ctx.createBiquadFilter()
    this.abFilter = this.ctx.createBiquadFilter()

    // Default Osprey routing: A/B -> filter, C -> thump -> filter
    this.oscA.connect(this.filter)
    this.oscB.connect(this.filter)
    this.oscC.connect(this.thumpGain)
    this.thumpGain.connect(this.filter)

    // F-35 deep roar path
    this.oscD.connect(this.roarGain)
    this.oscE.connect(this.roarGain)
    this.roarGain.connect(this.roarFilter)
    this.roarFilter.connect(this.gain)
    this.roarGain.gain.value = 0

    // Scream bus (F-35 mid jet); zeroed for Osprey
    this.screamFilter.connect(this.screamGain)
    this.screamGain.connect(this.gain)
    this.screamGain.gain.value = 0

    // Afterburner / grit bus
    this.abFilter.type = 'bandpass'
    this.abFilter.frequency.value = 220
    this.abFilter.Q.value = 0.6
    this.abGain.gain.value = 0
    this.abGain.connect(this.gain)

    // Brown-ish noise for jet grit / afterburner rumble
    const len = Math.floor(this.ctx.sampleRate * 2)
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.018 * white) / 1.018
      data[i] = last * 4.2
    }
    this.noise = this.ctx.createBufferSource()
    this.noise.buffer = buf
    this.noise.loop = true
    this.noiseGain = this.ctx.createGain()
    this.noiseGain.gain.value = 0
    this.noiseFilter = this.ctx.createBiquadFilter()
    this.noiseFilter.type = 'lowpass'
    this.noiseFilter.frequency.value = 140
    this.noiseFilter.Q.value = 0.6
    this.noise.connect(this.noiseFilter)
    this.noiseFilter.connect(this.noiseGain)
    this.noiseGain.connect(this.gain)

    // Second noise for AB crackle (higher band)
    const buf2 = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const d2 = buf2.getChannelData(0)
    let last2 = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      last2 = (last2 + 0.05 * white) / 1.05
      d2[i] = last2 * 2.8 + white * 0.15
    }
    this.abNoise = this.ctx.createBufferSource()
    this.abNoise.buffer = buf2
    this.abNoise.loop = true
    this.abNoiseGain = this.ctx.createGain()
    this.abNoiseGain.gain.value = 0
    this.abNoise.connect(this.abFilter)
    this.abFilter.connect(this.abNoiseGain)
    this.abNoiseGain.connect(this.gain)

    this.lfo = this.ctx.createOscillator()
    this.lfo.type = 'square'
    this.lfo.frequency.value = 5.2
    this.lfoGain = this.ctx.createGain()
    this.lfoGain.gain.value = 0
    this.lfo.connect(this.lfoGain)
    this.lfoGain.connect(this.gain.gain)

    this.applyBirdTimbre('osprey')
  }

  private routeOsprey() {
    if (!this.oscA || !this.oscB || !this.filter) return
    try {
      this.oscA.disconnect()
      this.oscB.disconnect()
    } catch {
      /* ok */
    }
    this.oscA.connect(this.filter)
    this.oscB.connect(this.filter)
    this.routedF35 = false
  }

  private routeF35() {
    if (!this.oscA || !this.oscB || !this.filter || !this.screamFilter) return
    try {
      this.oscA.disconnect()
      this.oscB.disconnect()
    } catch {
      /* ok */
    }
    // Mid scream mostly through bandpass; some body through main LP
    this.oscA.connect(this.screamFilter)
    this.oscB.connect(this.screamFilter)
    this.oscB.connect(this.filter)
    this.routedF35 = true
  }

  private applyBirdTimbre(bird: BirdKind) {
    if (
      !this.oscA ||
      !this.oscB ||
      !this.oscC ||
      !this.oscD ||
      !this.oscE ||
      !this.thumpGain ||
      !this.roarGain ||
      !this.screamGain ||
      !this.abGain ||
      !this.filter ||
      !this.roarFilter ||
      !this.screamFilter ||
      !this.lfo ||
      !this.lfoGain ||
      !this.noiseGain ||
      !this.abNoiseGain
    )
      return
    this.bird = bird
    if (bird === 'osprey') {
      if (this.routedF35) this.routeOsprey()
      this.oscA.type = 'sawtooth'
      this.oscB.type = 'square'
      this.oscC.type = 'sine'
      this.oscD.type = 'sine'
      this.oscE.type = 'sine'
      this.oscA.frequency.value = 42
      this.oscB.frequency.value = 62
      this.oscC.frequency.value = 24
      this.oscD.frequency.value = 30
      this.oscE.frequency.value = 40
      this.thumpGain.gain.value = 0.58
      this.roarGain.gain.value = 0
      this.screamGain.gain.value = 0
      this.abGain.gain.value = 0
      this.noiseGain.gain.value = 0
      this.abNoiseGain.gain.value = 0
      this.filter.type = 'lowpass'
      this.filter.frequency.value = 260
      this.filter.Q.value = 0.85
      this.roarFilter.type = 'lowpass'
      this.roarFilter.frequency.value = 200
      this.screamFilter.type = 'bandpass'
      this.screamFilter.frequency.value = 800
      this.lfo.type = 'square'
      this.lfo.frequency.value = 5.2
      this.lfoGain.gain.value = 0 // v10: no square LFO grit
    } else {
      if (!this.routedF35) this.routeF35()
      // Fighter jet: chest-rumble roar, restrained scream (not toy/model-plane whine)
      this.oscA.type = 'sawtooth'
      this.oscB.type = 'triangle'
      this.oscC.type = 'sine'
      this.oscD.type = 'sawtooth'
      this.oscE.type = 'square'
      this.oscA.frequency.value = 180
      this.oscB.frequency.value = 260
      this.oscC.frequency.value = 55
      this.oscD.frequency.value = 68
      this.oscE.frequency.value = 95
      this.thumpGain.gain.value = 0
      this.roarGain.gain.value = 0.62
      this.screamGain.gain.value = 0.1
      this.abGain.gain.value = 0
      this.noiseGain.gain.value = 0.04 // v10: quieter grit
      this.abNoiseGain.gain.value = 0
      this.filter.type = 'lowpass'
      this.filter.frequency.value = 520
      this.filter.Q.value = 0.45
      this.roarFilter.type = 'lowpass'
      this.roarFilter.frequency.value = 130
      this.roarFilter.Q.value = 0.7
      this.screamFilter.type = 'bandpass'
      this.screamFilter.frequency.value = 650
      this.screamFilter.Q.value = 0.7
      this.lfo.type = 'sine'
      this.lfo.frequency.value = 0.35
      this.lfoGain.gain.value = 0 // v10: kill modulation grit
    }
  }

  start() {
    this.ensure()
    if (
      !this.ctx ||
      !this.oscA ||
      !this.oscB ||
      !this.oscC ||
      !this.oscD ||
      !this.oscE ||
      !this.lfo ||
      !this.noise ||
      !this.abNoise ||
      this.started
    )
      return
    try {
      void this.ctx.resume()
      this.oscA.start()
      this.oscB.start()
      this.oscC.start()
      this.oscD.start()
      this.oscE.start()
      this.lfo.start()
      this.noise.start()
      this.abNoise.start()
      this.started = true
    } catch {
      /* already started */
    }
  }

  mute(on: boolean) {
    this.muted = on
    if (!this.ctx || !this.masterGain) return
    const t = this.ctx.currentTime
    this.masterGain.gain.cancelScheduledValues(t)
    this.masterGain.gain.setValueAtTime(on ? 0 : 1, t)
  }

  /**
   * @param rpm rotor/fan cue 0..1
   * @param tcl power
   * @param modeBlend Osprey: nacelleDeg 0..90; F-35: vectorPos 0..1 (VL=1)
   * @param bird osprey | f35
   */
  update(rpm: number, tcl: number, modeBlend: number, bird: BirdKind = 'osprey') {
    if (
      !this.ctx ||
      !this.oscA ||
      !this.oscB ||
      !this.oscC ||
      !this.oscD ||
      !this.oscE ||
      !this.gain ||
      !this.thumpGain ||
      !this.roarGain ||
      !this.screamGain ||
      !this.abGain ||
      !this.filter ||
      !this.roarFilter ||
      !this.screamFilter ||
      !this.noiseGain ||
      !this.noiseFilter ||
      !this.abNoiseGain ||
      !this.abFilter ||
      !this.started
    )
      return
    if (bird !== this.bird) this.applyBirdTimbre(bird)

    const t = this.ctx.currentTime
    // v9: sanitize inputs — freeze modulation when extreme; never NaN into AudioParam
    const rpmSafe = Number.isFinite(rpm) ? clamp(rpm, 0, 1.25) : 0
    const tclSafe = Number.isFinite(tcl) ? clamp(tcl, 0, 1.25) : 0
    const blendSafe = Number.isFinite(modeBlend) ? modeBlend : 0
    const soft = rpmSafe > 1.05 || tclSafe > 1.05 // soften when values go extreme

    const setHz = (param: AudioParam, hz: number, tau = 0.08) => {
      const v = clamp(Number.isFinite(hz) ? hz : 60, 20, 4000)
      param.setTargetAtTime(v, t, tau)
    }
    const setG = (param: AudioParam, g: number, tau = 0.1) => {
      const v = clamp(Number.isFinite(g) ? g : 0, 0, 0.75)
      param.setTargetAtTime(v, t, tau)
    }
    const setQ = (param: AudioParam, q: number, tau = 0.1) => {
      const v = clamp(Number.isFinite(q) ? q : 0.5, 0.1, 8)
      param.setTargetAtTime(v, t, tau)
    }

    if (bird === 'osprey') {
      const hel = Math.sin((clamp(blendSafe, 0, 90) * Math.PI) / 180)
      const base = 36 + rpmSafe * 56
      const aplLift = (1 - hel) * 22
      setHz(this.oscA.frequency, base + aplLift)
      setHz(this.oscB.frequency, base * 1.48 + aplLift * 0.65)
      setHz(this.oscC.frequency, base * 0.52, 0.1)
      setG(this.thumpGain.gain, 0.48 + rpmSafe * 0.18, 0.12)
      setG(this.roarGain.gain, 0)
      setG(this.screamGain.gain, 0)
      setG(this.abGain.gain, 0)
      setG(this.noiseGain.gain, 0)
      setG(this.abNoiseGain.gain, 0)
      setHz(this.filter.frequency, clamp(190 + rpmSafe * 105 + (1 - hel) * 48, 80, 720), 0.1)
      // v10: lower master; LFO depth forced 0 (was high-alt static grit)
      const vol = Math.min(soft ? 0.07 : 0.085, 0.018 + rpmSafe * 0.045 + tclSafe * 0.02)
      setG(this.gain.gain, vol, 0.08)
      if (this.lfoGain) setG(this.lfoGain.gain, 0, 0.05)
    } else {
      // F-35 jet roar — v10: kill LFO + cut noise/scream grit (no high-alt static)
      const vl = clamp01(blendSafe)
      const ctol = 1 - vl
      const stovl = vl > 0.15 && vl < 0.85 ? 1 : 0

      const roarHz = 58 + rpmSafe * 42 + ctol * 28 + tclSafe * 22
      setHz(this.oscD.frequency, clamp(roarHz, 52, 145))
      setHz(this.oscE.frequency, clamp(roarHz * 1.38, 70, 190))
      setHz(this.roarFilter.frequency, clamp(95 + ctol * 55 + rpmSafe * 30 + tclSafe * 20, 60, 320), 0.1)
      setG(this.roarGain.gain, clamp(0.36 + ctol * 0.24 + tclSafe * 0.15 + stovl * 0.04, 0, 0.72))

      const scream = 160 + rpmSafe * 80 + ctol * 55 + tclSafe * 30
      setHz(this.oscA.frequency, clamp(scream, 140, 360), 0.08)
      setHz(this.oscB.frequency, clamp(scream * 1.4, 180, 440), 0.08)
      setHz(this.screamFilter.frequency, clamp(420 + ctol * 160 + rpmSafe * 80, 200, 1100), 0.1)
      setQ(this.screamFilter.Q, 0.45 + ctol * 0.15)
      setG(this.screamGain.gain, 0.03 + ctol * 0.05 + tclSafe * 0.035)

      setHz(this.oscC.frequency, 48 + rpmSafe * 55 + vl * 30)
      setG(this.thumpGain.gain, vl * (0.1 + rpmSafe * 0.08), 0.12)

      const ab = clamp01((tclSafe - 0.58) / 0.42) * clamp01((0.32 - vl) / 0.32)
      setHz(this.noiseFilter.frequency, clamp(90 + ctol * 40 + ab * 50, 60, 280), 0.12)
      setG(this.noiseGain.gain, 0.02 + ctol * 0.03 + ab * 0.035 + tclSafe * 0.012)
      setHz(this.abFilter.frequency, clamp(160 + ab * 100 + ctol * 50, 80, 480), 0.12)
      setG(this.abNoiseGain.gain, ab * (0.02 + tclSafe * 0.015), 0.12)
      setG(this.abGain.gain, ab * 0.03, 0.12)

      setHz(this.filter.frequency, clamp(320 + rpmSafe * 160 + ctol * 180, 180, 1100), 0.1)
      setQ(this.filter.Q, 0.35 + ctol * 0.15)

      const vol = Math.min(soft ? 0.08 : 0.1, 0.025 + rpmSafe * 0.03 + tclSafe * 0.032 + ctol * 0.015)
      setG(this.gain.gain, vol, 0.09)
      if (this.lfoGain) setG(this.lfoGain.gain, 0, 0.05)
    }
  }

  stop() {
    this.mute(true)
    if (!this.gain || !this.ctx) return
    const t = this.ctx.currentTime
    this.gain.gain.cancelScheduledValues(t)
    this.gain.gain.setValueAtTime(0, t)
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
