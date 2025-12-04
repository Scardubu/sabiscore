'use client';

import { useEffect } from 'react';
import { safeErrorMessage } from '@/lib/error-utils';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { RefreshCw, Home, AlertCircle } from 'lucide-react';

interface MatchErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function MatchInsightsError({ error, reset }: MatchErrorProps) {
  useEffect(() => {
    console.error('Match insights route error:', error);
    const message = safeErrorMessage(error);
    toast.error(message);
  }, [error]);

  const isTimeout = error.message?.toLowerCase().includes('timeout');
  const isServerError = error.message?.toLowerCase().includes('5') || error.message?.includes('503');

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center py-16 px-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-800/50 border border-rose-500/30">
        <AlertCircle className="h-10 w-10 text-rose-400" />
      </div>
      
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wider text-rose-300">
          {isTimeout ? 'Request Timeout' : isServerError ? 'Service Unavailable' : 'Unexpected Error'}
        </p>
        <h1 className="text-3xl font-bold text-slate-100">We hit a snag while loading insights</h1>
        <p className="text-slate-400 max-w-md mx-auto">
          {isTimeout 
            ? 'The prediction engine took too long to respond. This can happen during peak usage or cold starts.'
            : isServerError
            ? 'Our prediction service is temporarily unavailable. This usually resolves within a few minutes.'
            : 'Something unexpected happened while generating your insights. Please try again.'
          }
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/60 bg-indigo-500/20 px-6 py-3 font-semibold text-indigo-200 transition hover:bg-indigo-500/30"
        >
          <RefreshCw className="h-4 w-4" />
          Retry insights
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/40 px-6 py-3 font-semibold text-slate-200 transition hover:bg-slate-800"
        >
          <Home className="h-4 w-4" />
          Pick another matchup
        </Link>
      </div>
      
      <div className="mt-4 text-xs text-slate-500">
        <p>If this issue persists, please wait a few minutes and try again.</p>
      </div>
    </div>
  );
}
