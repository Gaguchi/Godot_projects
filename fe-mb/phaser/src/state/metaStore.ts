import { create } from 'zustand'

export type MetaAction =
  | { type: 'startNewRun' }
  | { type: 'recordRunCompleted'; payload: { won: boolean } }

interface MetaState {
  gameStarted: boolean
  totalRuns: number
  dispatch: (action: MetaAction) => void
  __reset: () => void
}

const initial = { gameStarted: false, totalRuns: 0 }

export const useMetaStore = create<MetaState>((set) => ({
  ...initial,
  dispatch(action) {
    switch (action.type) {
      case 'startNewRun':
        set(s => ({ gameStarted: true, totalRuns: s.totalRuns + 1 }))
        return
      case 'recordRunCompleted':
        // skeletal — wins/losses tracked in later milestone
        return
    }
  },
  __reset() { set(initial) },
}))
