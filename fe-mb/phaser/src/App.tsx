import React, { useState, useCallback } from 'react'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { DevHud } from './ui/DevHud'
import { ViewContext, type View } from './ui/view'
import { TitleScreen } from './ui/screens/TitleScreen'
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
  const dispatchMeta = useMetaStore((s) => s.dispatch)

  const onNewGame = useCallback(() => {
    dispatchMeta({ type: 'startNewRun' })
    setView('combat')
    // Stub battle seeding lands in P1-09 (CombatScene.create reads from
    // combatStore which is still in initial BOOT state until then).
  }, [dispatchMeta])

  return (
    <ViewContext.Provider value={{ view, setView }}>
      <ErrorBoundary errorBus={errorBus}>
        <div id="app-root">
          {view === 'title' ? (
            <TitleScreen
              onNewGame={onNewGame}
              onLoadGame={() => { /* wired in P1-04 */ }}
              onQuit={() => { /* wired in P1-05 */ }}
            />
          ) : (
            <>
              <div id="game-canvas-container" />
              <div id="react-shell" />
            </>
          )}
          <DevHud errorBus={errorBus} eventBus={eventBus} actionLog={actionLog} />
        </div>
      </ErrorBoundary>
    </ViewContext.Provider>
  )
}
