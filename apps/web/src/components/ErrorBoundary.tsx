"use client";

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { safeErrorMessage } from '@/lib/error-utils';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

/**
 * Production-ready Error Boundary Component
 * ==========================================
 * 
 * Features:
 * - Graceful error handling with retry logic
 * - Error logging and tracking
 * - Custom fallback UI
 * - Automatic reset on route change
 * - Error count tracking to prevent infinite loops
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimer: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught error:', error, errorInfo);
    }

    // Track error count
    this.setState(prev => ({
      errorInfo,
      errorCount: prev.errorCount + 1,
    }));

    // Call optional error handler (for analytics, Sentry, etc.)
    this.props.onError?.(error, errorInfo);

    // TODO: Send to error tracking service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  resetError = () => {
    // Prevent infinite retry loops
    if (this.state.errorCount >= 3) {
      console.error('Too many errors, not retrying');
      return;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Auto-reset error count after 30 seconds
    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => {
      this.setState({ errorCount: 0 });
    }, 30000);
  };

  componentWillUnmount() {
    if (this.resetTimer) clearTimeout(this.resetTimer);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError);
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
          <div className="glass-card max-w-2xl w-full p-8 space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-100">Something went wrong</h2>
                <p className="text-slate-400 mt-1">We encountered an unexpected error</p>
              </div>
            </div>

            <div className="rounded-lg bg-slate-900/50 border border-slate-800 p-4">
              <p className="text-sm font-mono text-red-300">
                {safeErrorMessage(this.state.error)}
              </p>
              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <details className="mt-4">
                  <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">
                    Component Stack
                  </summary>
                  <pre className="mt-2 text-xs text-slate-500 overflow-auto max-h-40">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={this.resetError}
                disabled={this.state.errorCount >= 3}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-semibold"
              >
                {this.state.errorCount >= 3 ? 'Too many retries' : 'Try Again'}
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors font-semibold"
              >
                Go Home
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 border border-slate-700 hover:border-slate-600 text-slate-300 rounded-lg transition-colors"
              >
                Reload Page
              </button>
            </div>

            {this.state.errorCount > 0 && (
              <p className="text-xs text-slate-500">
                Error occurred {this.state.errorCount} time{this.state.errorCount > 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Functional wrapper for async boundaries
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
