import React, { useState } from 'react'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { DevHud } from './ui/DevHud'
import { ViewContext, type View } from './ui/view'
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
            <div id="title-placeholder" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100vh', width: '100vw', background: '#0a0a0f',
              color: '#e0d0a0', fontFamily: 'monospace', fontSize: 32,
            }}>
              FE_MB — Title (P1-02)
            </div>
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
