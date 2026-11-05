import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Catches render-time crashes so one bad screen can't blank the whole app.
 * Offers a reload and, when the device store looks recoverable, a reset.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep a breadcrumb for debugging without a crash-reporting service.
    console.error('Bloom crashed:', error, info.componentStack)
  }

  private handleReload = () => {
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="safe-shell mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="w-full rounded-calm border border-line bg-raised p-6 shadow-calm">
          <h1 className="font-display text-xl font-semibold text-ink">Something went sideways</h1>
          <p className="mt-2 text-sm text-muted">
            Bloom hit an unexpected error. Your data is safe on this device — reloading usually
            fixes it.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-calm-sm bg-surface p-3 text-left text-xs text-muted">
            {error.message}
          </pre>
          <button
            type="button"
            onClick={this.handleReload}
            className="silicone-primary mt-5 rounded-full px-5 py-2 text-sm font-semibold"
          >
            Reload Bloom
          </button>
        </div>
      </div>
    )
  }
}
