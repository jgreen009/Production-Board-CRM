import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback: (retry: () => void) => ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

// Batch D hardening: Suspense alone does not catch a rejected lazy() import
// (e.g. the Fabric chunk failing to load over a flaky connection or a stale
// deploy) — that throws during render and, with no boundary, unmounts the
// whole tree above it. This is the one general-purpose boundary in the app,
// scoped around the Mockup Studio's canvas so a chunk-load failure degrades
// to an inline message instead of crashing the entire order form.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught an error', error, info)
  }

  retry = () => this.setState({ hasError: false })

  render() {
    if (this.state.hasError) return this.props.fallback(this.retry)
    return this.props.children
  }
}
