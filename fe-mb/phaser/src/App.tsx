import React, { useState, useCallback, useEffect } from 'react'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { DevHud } from './ui/DevHud'
import { ViewContext, type View } from './ui/view'
import { TitleScreen } from './ui/screens/TitleScreen'
import { OverworldScene } from './ui/screens/OverworldScene'
import { TownScene } from './ui/screens/TownScene'
import { DungeonScene } from './ui/screens/DungeonScene'
import { LoadGameModal, type SaveSlot } from './ui/modals/LoadGameModal'
import { QuitModal } from './ui/modals/QuitModal'
import { BattleEndModal } from './ui/modals/BattleEndModal'
import { QuestLog } from './ui/overlays/QuestLog'
import { CombatHud } from './ui/scenes/combat/CombatHud'
import { useCombatStore } from './state/combatStore'
import { useRunStore } from './state/runStore'
import { asNodeId } from './domain/ids'
import { createErrorBus } from './state/errorBus'
import { createEventBus } from './state/eventBus'
import { createActionLog } from './state/actionLog'
import { useMetaStore } from './state/metaStore'

const errorBus = createErrorBus()
const eventBus = createEventBus()
const actionLog = createActionLog()

export const __busRefs = { errorBus, eventBus, actionLog }

// Dev-only debug surface so E2E + manual testing can read store state and
// dispatch events from the browser console. Tree-shaken in production.
if (import.meta.env.DEV) {
  ;(window as unknown as { __debug?: Record<string, unknown> }).__debug = {
    combatStore: useCombatStore,
    runStore: useRunStore,
    metaStore: useMetaStore,
    busRefs: { errorBus, eventBus, actionLog },
  }
}

export function App(): React.JSX.Element {
  // Dev-only fast-path: ?view=combat URL param skips title and jumps straight
  // into a stub battle. Used by E2E tests that exercise combat interactions.
  const initialView: View = (() => {
    if (!import.meta.env.DEV) return 'title'
    const params = new URLSearchParams(window.location.search)
    const v = params.get('view')
    if (v === 'combat' || v === 'overworld' || v === 'town' || v === 'dungeon') return v
    return 'title'
  })()
  const [view, setView] = useState<View>(initialView)
  const [loadModalOpen, setLoadModalOpen] = useState(false)
  const [quitModalOpen, setQuitModalOpen] = useState(false)
  const [questLogOpen, setQuestLogOpen] = useState(false)
  const dispatchMeta = useMetaStore((s) => s.dispatch)

  // Q key opens quest log when in overworld/town/dungeon
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key.toLowerCase() === 'q' && (view === 'overworld' || view === 'town' || view === 'dungeon')) {
        setQuestLogOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view])

  // F-26: Permadeath sync. When combat phase becomes VICTORY/DEFEAT, walk
  // the units and record fallen party members in runStore.deathLog. On
  // VICTORY, also remove them from runStore.party so subsequent battles
  // are seeded without them.
  useEffect(() => {
    const unsub = useCombatStore.subscribe((s) => {
      if (s.state.phase !== 'VICTORY' && s.state.phase !== 'DEFEAT') return
      const fallenPartyIds: string[] = []
      for (const u of Object.values(s.state.units)) {
        if (u.hp.current > 0) continue
        if ((u.classId as unknown as string).includes('bandit')) continue
        fallenPartyIds.push(u.id as unknown as string)
      }
      if (fallenPartyIds.length === 0) return
      const turn = s.state.turn.number
      for (const id of fallenPartyIds) {
        useRunStore.getState().dispatch({
          type: 'fallenUnit',
          payload: { unitId: id as never, cause: 'battle', turn },
        })
      }
      // On VICTORY, sweep dead party from runStore.party so they don't reseed
      if (s.state.phase === 'VICTORY') {
        useRunStore.setState((rs) => {
          const newUnits: typeof rs.party.units = { ...rs.party.units }
          for (const id of fallenPartyIds) delete newUnits[id]
          const newOrder = rs.party.partyOrder.filter(
            (uid) => !fallenPartyIds.includes(uid as unknown as string),
          )
          return { party: { units: newUnits, partyOrder: newOrder } }
        })
      }
    })
    return () => { unsub() }
  }, [])

  const onNewGame = useCallback(() => {
    dispatchMeta({ type: 'startNewRun' })
    setView('overworld')
  }, [dispatchMeta])

  const onLoadGame = useCallback(() => {
    setLoadModalOpen(true)
  }, [])

  const onQuit = useCallback(() => {
    // window.close() only works for windows opened via window.open(); in a
    // normal browser tab it silently fails. Try it; if the tab is still here
    // a moment later, show the fallback "thanks for playing" overlay.
    try { window.close() } catch { /* ignore */ }
    setQuitModalOpen(true)
  }, [])

  const onBattleRestart = useCallback(() => {
    useCombatStore.getState().reset()
    // Trigger view re-flip so CombatScene's create() runs again and reseeds
    setView('title')
    setTimeout(() => setView('combat'), 50)
  }, [])

  const onReturnToTitle = useCallback(() => {
    useCombatStore.getState().reset()
    setView('title')
  }, [])

  const onContinueToOverworld = useCallback(() => {
    // Travel encounter resolved successfully — consume pending path and arrive
    const run = useRunStore.getState()
    const pending = run.pendingTravelPath
    if (pending && pending.remainingNodeIds.length > 0) {
      const nextNode = pending.remainingNodeIds[0]!
      run.dispatch({ type: 'arriveAtNode', payload: { nodeId: asNodeId(nextNode as unknown as string) } })
      run.dispatch({ type: 'startTravelPath', payload: { path: { ...pending, remainingNodeIds: [] } } })
    }
    useCombatStore.getState().reset()
    setView('overworld')
  }, [])

  // P1-04: empty list for now. Real save slots are read from localStorage
  // once the save UX lands in a later milestone. The persistence layer
  // (loadFromString, atomic hydration) already exists in src/persistence/.
  const saveSlots: SaveSlot[] = []

  return (
    <ViewContext.Provider value={{ view, setView }}>
      <ErrorBoundary errorBus={errorBus}>
        <div id="app-root">
          {view === 'title' && (
            <TitleScreen
              onNewGame={onNewGame}
              onLoadGame={onLoadGame}
              onQuit={onQuit}
            />
          )}
          {view === 'overworld' && (
            <OverworldScene
              onTravelToCombat={() => setView('combat')}
              onEnterTown={() => setView('town')}
              onEnterDungeon={() => setView('dungeon')}
              onWin={() => setView('title')}
            />
          )}
          {view === 'combat' && (
            <>
              <div id="game-canvas-container" />
              <div id="react-shell" />
              <CombatHud />
            </>
          )}
          {view === 'town' && (
            <TownScene onLeave={() => setView('overworld')} />
          )}
          {view === 'dungeon' && (
            <DungeonScene
              onClearAndExit={() => setView('overworld')}
              onCombatRoom={() => setView('combat')}
              onLeave={() => setView('overworld')}
            />
          )}
          <DevHud errorBus={errorBus} eventBus={eventBus} actionLog={actionLog} />
          <LoadGameModal
            open={loadModalOpen}
            slots={saveSlots}
            onClose={() => setLoadModalOpen(false)}
            onSelect={(_slotId) => {
              // Real load lands later. For foundation: just close the modal.
              setLoadModalOpen(false)
            }}
          />
          <QuitModal open={quitModalOpen} onClose={() => setQuitModalOpen(false)} />
          <BattleEndModal
            onRestart={onBattleRestart}
            onReturnToTitle={onReturnToTitle}
            onContinueToOverworld={onContinueToOverworld}
          />
          <QuestLog open={questLogOpen} onClose={() => setQuestLogOpen(false)} />
          {/* Quest log key hint */}
          {(view === 'overworld' || view === 'town' || view === 'dungeon') && !questLogOpen && (
            <div style={{ position: 'fixed', bottom: 8, left: 8, fontSize: 10, color: '#5a4a30', fontFamily: 'monospace', zIndex: 100 }}>
              [Q] Quest Log
            </div>
          )}
        </div>
      </ErrorBoundary>
    </ViewContext.Provider>
  )
}
