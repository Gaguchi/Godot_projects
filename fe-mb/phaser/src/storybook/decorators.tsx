import React, { useEffect } from 'react'
import type { Decorator } from '@storybook/react-vite'
import { useRunStore } from '../state/runStore'
import { useCombatStore } from '../state/combatStore'
import type { Unit } from '../domain/unit'
import type { CombatGrid } from '../domain/combatState'
import { initialCombatState } from '../systems/combatReducer'
import { asUnitId } from '../domain/ids'

/**
 * Seeds runStore with a fresh party + gold + food, then renders the story.
 * Resets to defaults on unmount so stories don't bleed state.
 */
export function withSeededRun(party: Unit[], gold = 80, foodCount = 5): Decorator {
  return (Story) => {
    useEffect(() => {
      const units: Record<string, Unit> = {}
      for (const u of party) units[u.id as unknown as string] = u
      const items = Array.from({ length: foodCount }, (_, i) => ({
        uid: i + 1,
        itemId: 'food_rations' as never,
        gridX: i,
        gridY: 0,
      }))
      useRunStore.setState({
        gold,
        party: { units, partyOrder: party.map((u) => u.id) },
        inventory: { items: items as never },
      } as never)
      return () => {
        // Reset to a clean shell on story unmount
        useRunStore.setState({
          gold: 0,
          party: { units: {}, partyOrder: [] },
          inventory: { items: [] },
          pendingDialogue: null,
        } as never)
      }
    }, [])
    return <Story />
  }
}

/**
 * Seeds combatStore in COMBAT phase with given units.
 */
export function withSeededCombat(units: Unit[], firstActorId?: string): Decorator {
  return (Story) => {
    useEffect(() => {
      const recordUnits: Record<string, Unit> = {}
      for (const u of units) recordUnits[u.id as unknown as string] = u
      const grid: CombatGrid = { width: 14, height: 10, obstacles: new Set() }
      const firstId = firstActorId ?? (units[0]?.id as unknown as string) ?? 'roy'
      useCombatStore.setState({
        state: {
          ...initialCombatState(),
          phase: 'COMBAT',
          subPhase: 'IDLE',
          turn: { number: 1, unitId: asUnitId(firstId), team: 'party' },
          units: recordUnits,
          grid,
          decks: {},
        },
        lastEffectId: 0,
      })
      return () => {
        useCombatStore.setState({ state: initialCombatState(), lastEffectId: 0 })
      }
    }, [])
    return <Story />
  }
}
