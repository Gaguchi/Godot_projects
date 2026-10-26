/**
 * Seeded RNG — Mulberry32 + labelled sub-streams. THE only source of
 * randomness in the engine (eslint bans Math.random). `RngState` is plain
 * data so it lives inside GameState and round-trips through saves; replaying
 * the action log from a save reproduces every roll.
 */
export interface RngState {
  seed: number
  counter: number
  label?: string
}

export interface RNG {
  state(): RngState
  next(): number
  nextInt(min: number, max: number): number
  pick<T>(arr: readonly T[]): T
  shuffle<T>(arr: readonly T[]): T[]
}

// Mulberry32 — small, fast, well-distributed PRNG suitable for game use.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Hash combiner for derive(label).
function hashLabel(parentSeed: number, label: string): number {
  let h = parentSeed >>> 0
  for (let i = 0; i < label.length; i++) {
    h = Math.imul(h ^ label.charCodeAt(i), 0x01000193) >>> 0
  }
  return h
}

export function createRng(initial: RngState): RNG {
  const state: RngState = { ...initial }
  const gen = mulberry32(state.seed)
  // Fast-forward the generator to the saved counter position so save/resume
  // produces a continuation of the original sequence, not a fresh stream from
  // a shifted seed. See foundations v2 spec §9 (rngState replay determinism).
  for (let i = 0; i < state.counter; i++) gen()
  return {
    state: () => ({ ...state }),
    next: () => {
      state.counter++
      return gen()
    },
    nextInt: (min, max) => {
      state.counter++
      const r = gen()
      return Math.floor(r * (max - min + 1)) + min
    },
    pick: <T,>(arr: readonly T[]) => {
      if (arr.length === 0) throw new Error('rng.pick: empty array')
      state.counter++
      return arr[Math.floor(gen() * arr.length)]!
    },
    shuffle: <T,>(arr: readonly T[]) => {
      const out = [...arr]
      for (let i = out.length - 1; i > 0; i--) {
        state.counter++
        const j = Math.floor(gen() * (i + 1))
        ;[out[i], out[j]] = [out[j]!, out[i]!]
      }
      return out
    },
  }
}

export function deriveRng(parent: RNG, label: string): RNG {
  const parentState = parent.state()
  return createRng({
    seed: hashLabel(parentState.seed, label),
    counter: 0,
    label,
  })
}
