/**
 * ui/town/TownScreen.tsx — the town (ARCHITECTURE §4): one job per screen (owner 2026-10-25). `ui.townTab` says
 * which: the square, whose buildings are the choices, or one building's own screen. Every visit opens on the square
 * (the map's "Enter town" sets it); the buildings lead back to it, and only the square leads back to the road.
 */
import React from 'react'
import { Inn } from './Inn'
import { Market } from './Market'
import { Square } from './Square'
import { Tavern } from './Tavern'
import { useTown } from './shared'

export function TownScreen(): React.JSX.Element | null {
  const v = useTown()
  if (v === null) return null
  switch (v.tab) {
    case 'inn': return <Inn v={v} />
    case 'tavern': return <Tavern v={v} />
    case 'shop': return <Market v={v} />
    case 'square': return <Square v={v} />
  }
}
