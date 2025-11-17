'use client';

import { useEffect } from 'react';
import { safeErrorMessage } from '@/lib/error-utils';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

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

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wider text-rose-300">Unexpected Error</p>
        <h1 className="text-3xl font-bold text-slate-100">We hit a snag while loading insights</h1>
        <p className="text-slate-400">
          The request timed out or the service is temporarily unavailable. Retry the request or choose
          a different matchup while we steady the feed.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-indigo-500/60 bg-indigo-500/20 px-6 py-3 font-semibold text-indigo-200 transition hover:bg-indigo-500/30"
        >
          Retry insights
        </button>
        <Link
          href="/match"
          className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-6 py-3 font-semibold text-slate-200 transition hover:bg-slate-800"
        >
          Pick another matchup
        </Link>
      </div>
    </div>
  );
}
