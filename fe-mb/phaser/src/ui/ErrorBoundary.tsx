import React from 'react'
import type { ErrorBus } from '../state/errorBus'

interface Props { errorBus: ErrorBus; children: React.ReactNode }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.props.errorBus.emit({ source: 'react', error, context: { info } })
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div role="alert" className="p-8 bg-red-950 text-red-100">
          <h1>Something broke.</h1>
          <pre className="mt-2 whitespace-pre-wrap text-xs">{this.state.error?.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}
