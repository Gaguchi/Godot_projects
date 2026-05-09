import React, { useState } from 'react'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { DevHud } from './ui/DevHud'
import { ViewContext, type View } from './ui/view'
import { TitleScreen } from './ui/screens/TitleScreen'
import { createErrorBus } from './state/errorBus'
import { createEventBus } from './state/eventBus'
import { createActionLog } from './state/actionLog'

const errorBus = createErrorBus()
const eventBus = createEventBus()
const actionLog = createActionLog()

export const __busRefs = { errorBus, eventBus, actionLog }

export function App(): React.JSX.Element {
  const [view, setView] = useState<View>('title')
  return (
    <ViewContext.Provider value={{ view, setView }}>
      <ErrorBoundary errorBus={errorBus}>
        <div id="app-root">
          {view === 'title' ? (
            <TitleScreen
              onNewGame={() => { /* wired in P1-03 */ }}
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
