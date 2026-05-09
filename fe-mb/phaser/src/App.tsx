import React from 'react'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { DevHud } from './ui/DevHud'
import { createErrorBus } from './state/errorBus'
import { createEventBus } from './state/eventBus'
import { createActionLog } from './state/actionLog'

const errorBus = createErrorBus()
const eventBus = createEventBus()
const actionLog = createActionLog()

export const __busRefs = { errorBus, eventBus, actionLog }

export function App(): React.JSX.Element {
  return (
    <ErrorBoundary errorBus={errorBus}>
      <div id="app-root">
        <div id="game-canvas-container" />
        <div id="react-shell" />
        <DevHud errorBus={errorBus} eventBus={eventBus} actionLog={actionLog} />
      </div>
    </ErrorBoundary>
  )
}
