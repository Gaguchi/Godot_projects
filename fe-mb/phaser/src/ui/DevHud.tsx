import React, { useEffect, useState } from 'react'
import type { ErrorBus, ErrorEntry } from '../state/errorBus'
import type { EventBus } from '../state/eventBus'
import type { DomainEvent } from '../contracts'
import type { ActionLog, ActionLogEntry } from '../state/actionLog'

interface Props {
  errorBus: ErrorBus
  eventBus: EventBus
  actionLog: ActionLog
}

export function DevHud({ errorBus, eventBus, actionLog }: Props): React.JSX.Element | null {
  const isDev = import.meta.env.DEV
  const [errors, setErrors] = useState<ErrorEntry[]>([])
  const [events, setEvents] = useState<DomainEvent[]>([])
  const [actions, setActions] = useState<ActionLogEntry[]>([])
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (!isDev) return
    const unsubE = errorBus.subscribe(() => setErrors(errorBus.recent().slice(-5)))
    const unsubV = eventBus.subscribe(e => setEvents(prev => [...prev.slice(-9), e]))
    const tick = setInterval(() => setActions(actionLog.snapshot().slice(-10)), 500)
    return () => { unsubE(); unsubV(); clearInterval(tick) }
  }, [isDev, errorBus, eventBus, actionLog])

  if (!isDev) return null
  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ position: 'fixed', right: 8, bottom: 8, zIndex: 99999 }}>
      Dev HUD
    </button>
  )

  return (
    <div style={{
      position: 'fixed', right: 8, bottom: 8, width: 360, maxHeight: 320,
      overflow: 'auto', background: 'rgba(10,10,15,0.92)', color: '#cfd', padding: 8,
      fontFamily: 'monospace', fontSize: 11, zIndex: 99999, border: '1px solid #444',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong>Dev HUD</strong>
        <button onClick={() => setOpen(false)}>×</button>
      </div>
      <h4 style={{ margin: '6px 0 2px', color: '#fa6' }}>Errors ({errors.length})</h4>
      {errors.map((e, i) => <div key={i}>{e.source}: {e.error.message}</div>)}
      <h4 style={{ margin: '6px 0 2px', color: '#6af' }}>Events ({events.length})</h4>
      {events.map((e, i) => <div key={i}>{e.type}</div>)}
      <h4 style={{ margin: '6px 0 2px', color: '#6fa' }}>Actions ({actions.length})</h4>
      {actions.map((a, i) => <div key={i}>{a.store}: {a.action.type}</div>)}
    </div>
  )
}
