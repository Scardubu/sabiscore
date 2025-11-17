"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { safeErrorMessage } from '@/lib/error-utils';

interface RollbarWindow extends Window {
  rollbar?: {
    error: (error: Error, context?: Record<string, unknown>) => void;
  };
}

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  useEffect(() => {
    // Log to monitoring service with context
    console.error('Application error:', {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      timestamp: new Date().toISOString(),
      retryCount,
    });

    // TODO: Send to monitoring service (e.g., Sentry, Rollbar)
    if (typeof window !== 'undefined') {
      const rollbarWindow = window as RollbarWindow;
      if (rollbarWindow.rollbar) {
        rollbarWindow.rollbar.error(error, {
          digest: error.digest,
          retryCount,
        });
      }
    }
  }, [error, retryCount]);

  const handleRetry = () => {
    if (retryCount < MAX_RETRIES) {
      setRetryCount(prev => prev + 1);
      reset();
    } else {
      // Redirect to home after max retries
      window.location.href = '/';
    }
  };

  const errorMessage = safeErrorMessage(error);
  const isRateLimitError = errorMessage.toLowerCase().includes('rate limit');
  const isNetworkError = errorMessage.toLowerCase().includes('network') || 
                         errorMessage.toLowerCase().includes('fetch');

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 px-4">
      <div className="max-w-xl space-y-6 text-center">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wider text-rose-300">
            {isRateLimitError ? '⏱️ Rate Limit' : isNetworkError ? '🔌 Network Error' : '⚠️ Error'}
          </p>
          <h1 className="text-4xl font-bold text-slate-100">
            {isRateLimitError ? 'Too Many Requests' : 'Something went wrong'}
          </h1>
          <p className="text-slate-400">
            {errorMessage}
          </p>
          {error.digest && (
            <p className="text-xs text-slate-500 font-mono">
              Error ID: {error.digest}
            </p>
          )}
          {retryCount > 0 && (
            <p className="text-sm text-amber-400">
              Retry attempt {retryCount} of {MAX_RETRIES}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={handleRetry}
            disabled={retryCount >= MAX_RETRIES}
            className="rounded-lg border border-indigo-500/60 bg-indigo-500/20 px-6 py-3 font-semibold text-indigo-200 transition hover:bg-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {retryCount >= MAX_RETRIES ? 'Max retries reached' : 'Try again'}
          </button>
          <Link
            href="/"
            className="rounded-lg border border-slate-700/60 bg-slate-800/40 px-6 py-3 font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            Go home
          </Link>
        </div>

        {isNetworkError && (
          <div className="mt-4 p-4 bg-slate-800/50 rounded-lg text-sm text-slate-300">
            <p className="font-semibold mb-2">💡 Troubleshooting tips:</p>
            <ul className="text-left space-y-1 text-slate-400">
              <li>• Check your internet connection</li>
              <li>• Refresh the page</li>
              <li>• Try again in a few moments</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
