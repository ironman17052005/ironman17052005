import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * Without this, one bad render anywhere shows a blank white page and the person
 * has no idea what happened or what to do. A prototype handed to real friends
 * needs a way out that is not "close the tab".
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('imdown crashed:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="min-h-full grid place-items-center p-6">
        <div className="max-w-sm w-full bg-card border border-line rounded-2xl p-5 space-y-3 text-center">
          <div className="text-xl font-black">that broke</div>
          <p className="text-mute text-sm">
            Something went wrong rendering the app. Reloading usually fixes it.
          </p>
          <pre className="text-[11px] text-mute bg-card2 rounded-xl p-2 text-left overflow-x-auto">{error.message}</pre>
          <div className="flex gap-2">
            <button onClick={() => window.location.reload()} className="tap flex-1 bg-brand text-black font-bold rounded-xl py-2.5">
              Reload
            </button>
            <button
              onClick={() => {
                // Corrupt saved state is the likeliest cause in demo mode.
                try { localStorage.removeItem('imdown.demo.v2') } catch { /* private mode */ }
                window.location.href = window.location.pathname
              }}
              className="tap flex-1 bg-card2 border border-line rounded-xl py-2.5 text-sm text-mute"
            >
              Start fresh
            </button>
          </div>
        </div>
      </div>
    )
  }
}
