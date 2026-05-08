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
