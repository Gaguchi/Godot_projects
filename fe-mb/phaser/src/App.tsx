import React, { useState, useCallback } from 'react'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { DevHud } from './ui/DevHud'
import { ViewContext, type View } from './ui/view'
import { TitleScreen } from './ui/screens/TitleScreen'
import { LoadGameModal, type SaveSlot } from './ui/modals/LoadGameModal'
import { QuitModal } from './ui/modals/QuitModal'
import { BattleEndModal } from './ui/modals/BattleEndModal'
import { useCombatStore } from './state/combatStore'
import { createErrorBus } from './state/errorBus'
import { createEventBus } from './state/eventBus'
import { createActionLog } from './state/actionLog'
import { useMetaStore } from './state/metaStore'

const errorBus = createErrorBus()
const eventBus = createEventBus()
const actionLog = createActionLog()

export const __busRefs = { errorBus, eventBus, actionLog }

export function App(): React.JSX.Element {
  const [view, setView] = useState<View>('title')
  const [loadModalOpen, setLoadModalOpen] = useState(false)
  const [quitModalOpen, setQuitModalOpen] = useState(false)
  const dispatchMeta = useMetaStore((s) => s.dispatch)

  const onNewGame = useCallback(() => {
    dispatchMeta({ type: 'startNewRun' })
    setView('combat')
    // Stub battle seeding lands in P1-09 (CombatScene.create reads from
    // combatStore which is still in initial BOOT state until then).
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

  // P1-04: empty list for now. Real save slots are read from localStorage
  // once the save UX lands in a later milestone. The persistence layer
  // (loadFromString, atomic hydration) already exists in src/persistence/.
  const saveSlots: SaveSlot[] = []

  return (
    <ViewContext.Provider value={{ view, setView }}>
      <ErrorBoundary errorBus={errorBus}>
        <div id="app-root">
          {view === 'title' ? (
            <TitleScreen
              onNewGame={onNewGame}
              onLoadGame={onLoadGame}
              onQuit={onQuit}
            />
          ) : (
            <>
              <div id="game-canvas-container" />
              <div id="react-shell" />
            </>
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
          <BattleEndModal onRestart={onBattleRestart} onReturnToTitle={onReturnToTitle} />
        </div>
      </ErrorBoundary>
    </ViewContext.Provider>
  )
}
