import { create } from 'zustand'

export type MetaAction =
  | { type: 'startNewRun' }
  | { type: 'recordRunCompleted'; payload: { won: boolean } }
  | { type: 'markTutorialSeen' }

interface MetaState {
  gameStarted: boolean
  totalRuns: number
  runsWon: number
  runsLost: number
  /** First-run tutorial battle shown (persists across runs). */
  tutorialSeen: boolean
  dispatch: (action: MetaAction) => void
  __reset: () => void
}

const initial = { gameStarted: false, totalRuns: 0, runsWon: 0, runsLost: 0, tutorialSeen: false }

export const useMetaStore = create<MetaState>((set) => ({
  ...initial,
  dispatch(action) {
    switch (action.type) {
      case 'startNewRun':
        set(s => ({ gameStarted: true, totalRuns: s.totalRuns + 1 }))
        return
      case 'recordRunCompleted':
        set(s => action.payload.won
          ? { runsWon: s.runsWon + 1 }
          : { runsLost: s.runsLost + 1 })
        return
      case 'markTutorialSeen':
        set({ tutorialSeen: true })
        return
    }
  },
  __reset() { set(initial) },
}))
