import React, { Component, ReactNode } from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="glass-card p-8 border-red-500/20">
          <div className="text-center">
            <h3 className="text-xl font-semibold text-red-400 mb-2">Something went wrong</h3>
            <p className="text-gray-300 mb-4">
              An unexpected error occurred. Please refresh the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-primary hover:bg-primary-dark rounded-lg transition-colors"
            >
              Refresh Page
            </button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-slate-400">Error Details</summary>
                <pre className="mt-2 p-4 bg-slate-900 rounded text-xs text-red-300 overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
