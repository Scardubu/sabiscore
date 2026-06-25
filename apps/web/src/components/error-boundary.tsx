"use client";

import { Component, ReactNode } from "react";
import { motion } from "framer-motion";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary Component
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing.
 * 
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError);
      }

      // Default fallback UI
      return <DefaultErrorFallback error={this.state.error} reset={this.resetError} />;
    }

    return this.props.children;
  }
}

/**
 * Default Error Fallback UI
 */
function DefaultErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex min-h-[400px] items-center justify-center p-8"
    >
      <div className="w-full max-w-lg space-y-6 rounded-[28px] border border-red-500/20 bg-slate-950/80 p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-8 w-8 text-red-400"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">Something went wrong</h2>
          <p className="text-sm text-slate-400">
            An unexpected error occurred while rendering this component.
          </p>
        </div>

        {error.message && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-left">
            <p className="text-xs font-mono text-red-300">{error.message}</p>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4"
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
            Try Again
          </button>
          
          <button
            onClick={() => window.location.href = "/"}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Go Home
          </button>
        </div>

        <p className="text-xs text-slate-500">
          If this problem persists, please contact support
        </p>
      </div>
    </motion.div>
  );
}

/**
 * Prediction Error Fallback
 * Specialized error UI for prediction flow errors
 */
export function PredictionErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  const isNetworkError = error.message.includes("fetch") || error.message.includes("network");
  const isTimeoutError = error.message.includes("timeout");
  const isModelError = error.message.includes("model") || error.message.includes("prediction");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-6 rounded-[28px] border border-yellow-500/20 bg-slate-950/80 p-8 text-center"
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-8 w-8 text-yellow-400"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white">Prediction Failed</h2>
        <p className="text-sm text-slate-400">
          {isNetworkError && "Network connection issue. Please check your internet connection."}
          {isTimeoutError && "The prediction took too long. The model may be initializing."}
          {isModelError && "Model inference error. This usually resolves after the first prediction."}
          {!isNetworkError && !isTimeoutError && !isModelError && "Unable to generate prediction at this time."}
        </p>
      </div>

      {error.message && (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-left">
          <p className="text-xs font-mono text-yellow-300">{error.message}</p>
        </div>
      )}

      <div className="space-y-3">
        <button
          onClick={reset}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 sm:w-auto"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
          >
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
          Retry Prediction
        </button>

        {isTimeoutError && (
          <p className="text-xs text-slate-500">
            First predictions may take 10-15 seconds while the model initializes
          </p>
        )}
      </div>
    </motion.div>
  );
}

/**
 * API Error Fallback
 * Specialized error UI for API errors
 */
export function APIErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-6 rounded-[28px] border border-red-500/20 bg-slate-950/80 p-8 text-center"
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-8 w-8 text-red-400"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white">API Error</h2>
        <p className="text-sm text-slate-400">
          Failed to communicate with the API. Please try again.
        </p>
      </div>

      {error.message && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-left">
          <p className="text-xs font-mono text-red-300">{error.message}</p>
        </div>
      )}

      <button
        onClick={reset}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-4 w-4"
        >
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
        Retry Request
      </button>
    </motion.div>
  );
}
