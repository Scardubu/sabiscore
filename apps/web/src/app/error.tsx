"use client";

import { useEffect } from 'react';
import Link from 'next/link';
import { safeErrorMessage } from '@/lib/error-utils';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log to monitoring service
    console.error('Application error:', error);
  }, [error]);

  const errorMessage = safeErrorMessage(error);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 px-4">
      <div className="max-w-xl space-y-6 text-center">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wider text-rose-300">
            Error
          </p>
          <h1 className="text-4xl font-bold text-slate-100">
            Something went wrong
          </h1>
          <p className="text-slate-400">
            {errorMessage}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={reset}
            className="rounded-lg border border-indigo-500/60 bg-indigo-500/20 px-6 py-3 font-semibold text-indigo-200 transition hover:bg-indigo-500/30"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-slate-700/60 bg-slate-800/40 px-6 py-3 font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
