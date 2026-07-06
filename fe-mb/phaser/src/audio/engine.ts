/**
 * Beta audio engine — synthesizes ALL sound via WebAudio (no asset files).
 * Deliberately tiny: oscillator/noise recipes for SFX and slow generative
 * drones per scene context. Free-asset packs can replace recipes post-beta
 * without changing call sites.
 *
 * Not a pure system (it IS I/O) — lives outside systems/ by design. Callers:
 * App (context switching, stingers, mute), BoardScene (combat hits).
 * Safe everywhere: no-ops when AudioContext is unavailable (jsdom/tests) or
 * before the first user gesture (autoplay policy).
 */

export type SfxName =
  | 'cardPlay' | 'hitPhysical' | 'hitMagic' | 'heal' | 'death'
  | 'gold' | 'uiClick' | 'victory' | 'defeat' | 'draw' | 'encounter'

export type MusicContext = 'overworld' | 'combat' | 'town' | 'none'

interface EngineState {
  ctx: AudioContext | null
  master: GainNode | null
  musicGain: GainNode | null
  musicNodes: AudioNode[]
  musicContext: MusicContext
  muted: boolean
  volume: number
  unlocked: boolean
}

const st: EngineState = {
  ctx: null, master: null, musicGain: null, musicNodes: [],
  musicContext: 'none', muted: false, volume: 0.7, unlocked: false,
}

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null
  if (!st.ctx) {
    st.ctx = new AudioContext()
    st.master = st.ctx.createGain()
    st.master.gain.value = st.muted ? 0 : st.volume
    st.master.connect(st.ctx.destination)
    st.musicGain = st.ctx.createGain()
    st.musicGain.gain.value = 0.35
    st.musicGain.connect(st.master)
  }
  if (st.ctx.state === 'suspended') void st.ctx.resume()
  return st.ctx
}

/** Call once from a user-gesture handler to satisfy autoplay policy. */
export function unlockAudio(): void {
  if (st.unlocked) return
  const ctx = ensureCtx()
  if (!ctx) return
  st.unlocked = true
  // Restart whatever bed was requested before the unlock.
  if (st.musicContext !== 'none') {
    const want = st.musicContext
    st.musicContext = 'none'
    setMusicContext(want)
  }
}

export function setMuted(muted: boolean): void {
  st.muted = muted
  if (st.master && st.ctx) st.master.gain.setTargetAtTime(muted ? 0 : st.volume, st.ctx.currentTime, 0.05)
}

export function setVolume(volume: number): void {
  st.volume = Math.max(0, Math.min(1, volume))
  if (st.master && st.ctx && !st.muted) st.master.gain.setTargetAtTime(st.volume, st.ctx.currentTime, 0.05)
}

export function isMuted(): boolean { return st.muted }

// ── SFX recipes ────────────────────────────────────────────────────

function tone(
  ctx: AudioContext, dest: AudioNode,
  freq: number, dur: number, type: OscillatorType, gain: number,
  glideTo?: number, when = 0,
): void {
  const t0 = ctx.currentTime + when
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (glideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), t0 + dur)
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g); g.connect(dest)
  osc.start(t0); osc.stop(t0 + dur + 0.02)
}

function noise(ctx: AudioContext, dest: AudioNode, dur: number, gain: number, lowpass = 800): void {
  const t0 = ctx.currentTime
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur))
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  // Deterministic pseudo-noise (Math.random is lint-banned project-wide).
  let seed = 0x9e3779b9
  for (let i = 0; i < len; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    data[i] = ((seed / 0xffffffff) * 2 - 1) * (1 - i / len)
  }
  const src = ctx.createBufferSource()
  src.buffer = buf
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'; filter.frequency.value = lowpass
  const g = ctx.createGain()
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(filter); filter.connect(g); g.connect(dest)
  src.start(t0)
}

export function sfx(name: SfxName): void {
  const ctx = ensureCtx()
  if (!ctx || !st.master || st.muted) return
  const out = st.master
  switch (name) {
    case 'cardPlay':   tone(ctx, out, 660, 0.08, 'triangle', 0.25, 880); break
    case 'draw':       noise(ctx, out, 0.06, 0.18, 2400); break
    case 'hitPhysical': noise(ctx, out, 0.16, 0.5, 500); tone(ctx, out, 110, 0.14, 'square', 0.3, 55); break
    case 'hitMagic':   tone(ctx, out, 1200, 0.2, 'sawtooth', 0.2, 300); noise(ctx, out, 0.12, 0.2, 3000); break
    case 'heal':       tone(ctx, out, 523, 0.25, 'sine', 0.22); tone(ctx, out, 784, 0.3, 'sine', 0.18, undefined, 0.09); break
    case 'death':      tone(ctx, out, 220, 0.6, 'sawtooth', 0.3, 40); break
    case 'gold':       tone(ctx, out, 1568, 0.07, 'triangle', 0.2); tone(ctx, out, 2093, 0.09, 'triangle', 0.16, undefined, 0.06); break
    case 'uiClick':    tone(ctx, out, 880, 0.04, 'triangle', 0.12); break
    case 'encounter':  tone(ctx, out, 196, 0.5, 'sawtooth', 0.28, 185); tone(ctx, out, 98, 0.6, 'square', 0.2); break
    case 'victory':
      [523, 659, 784, 1047].forEach((f, i) => tone(ctx, out, f, 0.28, 'triangle', 0.22, undefined, i * 0.13))
      break
    case 'defeat':
      [392, 311, 233, 155].forEach((f, i) => tone(ctx, out, f, 0.5, 'sawtooth', 0.2, undefined, i * 0.22))
      break
  }
}

// ── Generative ambient beds ────────────────────────────────────────

function stopMusic(): void {
  for (const n of st.musicNodes) {
    try { (n as OscillatorNode).stop?.() } catch { /* already stopped */ }
    try { n.disconnect() } catch { /* detached */ }
  }
  st.musicNodes = []
}

/** Root notes per context — slow detuned drones; combat adds a pulse. */
const BEDS: Record<Exclude<MusicContext, 'none'>, { root: number; fifth: number; pulse: boolean; bright: number }> = {
  overworld: { root: 73.42, fifth: 110.0, pulse: false, bright: 400 },   // D2 drone — the long road
  combat:    { root: 61.74, fifth: 92.5,  pulse: true,  bright: 700 },   // B1 — tension + pulse
  town:      { root: 98.0,  fifth: 146.83, pulse: false, bright: 900 },  // G2 — warmer hearth
}

export function setMusicContext(context: MusicContext): void {
  if (context === st.musicContext) return
  st.musicContext = context
  const ctx = ensureCtx()
  if (!ctx || !st.musicGain) return
  stopMusic()
  if (context === 'none') return
  const bed = BEDS[context]
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = bed.bright
  filter.connect(st.musicGain)
  for (const [freq, detune, g] of [[bed.root, -4, 0.20], [bed.root, 4, 0.20], [bed.fifth, 0, 0.10]] as const) {
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = freq
    osc.detune.value = detune
    const og = ctx.createGain()
    og.gain.value = g
    osc.connect(og); og.connect(filter)
    osc.start()
    st.musicNodes.push(osc, og)
  }
  // Slow swell LFO on the filter keeps the drone breathing.
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.05
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = bed.bright * 0.4
  lfo.connect(lfoGain); lfoGain.connect(filter.frequency)
  lfo.start()
  st.musicNodes.push(lfo, lfoGain, filter)
  if (bed.pulse) {
    const pulse = ctx.createOscillator()
    pulse.type = 'sine'
    pulse.frequency.value = bed.root
    const pg = ctx.createGain()
    pg.gain.value = 0
    const pulseLfo = ctx.createOscillator()
    pulseLfo.type = 'square'
    pulseLfo.frequency.value = 1.5    // ~90 bpm war-drum pulse
    const plg = ctx.createGain()
    plg.gain.value = 0.12
    pulseLfo.connect(plg); plg.connect(pg.gain)
    pulse.connect(pg); pg.connect(st.musicGain)
    pulse.start(); pulseLfo.start()
    st.musicNodes.push(pulse, pg, pulseLfo, plg)
  }
}
