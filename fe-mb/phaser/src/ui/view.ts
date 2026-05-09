import { createContext, useContext } from 'react'

/**
 * Top-level scene the React shell is currently displaying.
 *
 * - `title` — title screen (no Phaser canvas mounted)
 * - `combat` — battle scene (Phaser CombatScene active)
 * - `overworld` — world map (Phaser overworld scene, lands Phase 2)
 * - `town` — town menu UI (React DOM, lands Phase 3)
 * - `dungeon` — Slay-the-Spire-style dungeon map (Phase 5)
 */
export type View = 'title' | 'combat' | 'overworld' | 'town' | 'dungeon'

export interface ViewContextValue {
  view: View
  setView: (view: View) => void
}

export const ViewContext = createContext<ViewContextValue | null>(null)

export function useView(): ViewContextValue {
  const ctx = useContext(ViewContext)
  if (!ctx) throw new Error('useView must be called inside <ViewContext.Provider>')
  return ctx
}
