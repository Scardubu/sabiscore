'use client';

import { useEffect, useState } from 'react';
import { safeErrorMessage } from '@/lib/error-utils';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { RefreshCw, Home, AlertCircle, Clock, Zap } from 'lucide-react';

interface MatchErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function MatchInsightsError({ error, reset }: MatchErrorProps) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const isTimeout = error.message?.toLowerCase().includes('timeout') || 
                    error.message?.toLowerCase().includes('warming') ||
                    error.digest?.includes('TIMEOUT');
  const isServerError = error.message?.toLowerCase().includes('503') || 
                        error.message?.toLowerCase().includes('unavailable');
  const isColdStart = isTimeout && !isServerError;

  useEffect(() => {
    console.error('Match insights route error:', error);
    // Only show toast for non-timeout errors (timeouts have their own UI)
    if (!isTimeout) {
      const message = safeErrorMessage(error);
      toast.error(message);
    }
  }, [error, isTimeout]);

  // Auto-retry countdown for cold start timeouts
  useEffect(() => {
    if (isColdStart && countdown === null) {
      // Start 30-second countdown for cold start scenarios
      setCountdown(30);
    }
  }, [isColdStart, countdown]);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && !isRetrying) {
      // Auto-retry when countdown reaches 0
      setIsRetrying(true);
      reset();
    }
  }, [countdown, reset, isRetrying]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center py-16 px-4">
      <div className={`flex h-20 w-20 items-center justify-center rounded-full border ${
        isColdStart 
          ? 'bg-amber-500/10 border-amber-500/30' 
          : 'bg-slate-800/50 border-rose-500/30'
      }`}>
        {isColdStart ? (
          <Clock className="h-10 w-10 text-amber-400 animate-pulse" />
        ) : (
          <AlertCircle className="h-10 w-10 text-rose-400" />
        )}
      </div>
      
      <div className="space-y-3">
        <p className={`text-sm font-semibold uppercase tracking-wider ${
          isColdStart ? 'text-amber-300' : 'text-rose-300'
        }`}>
          {isColdStart ? 'Engine Warming Up' : isServerError ? 'Service Unavailable' : 'Unexpected Error'}
        </p>
        <h1 className="text-3xl font-bold text-slate-100">
          {isColdStart ? 'Just a moment...' : 'We hit a snag'}
        </h1>
        <p className="text-slate-400 max-w-md mx-auto">
          {isColdStart 
            ? 'Our AI prediction engine is starting up. This happens after periods of inactivity and typically takes 30-60 seconds.'
            : isServerError
            ? 'Our prediction service is temporarily unavailable. This usually resolves within a few minutes.'
            : 'Something unexpected happened while generating your insights. Please try again.'
          }
        </p>
      </div>

      {/* Auto-retry countdown for cold starts */}
      {isColdStart && countdown !== null && countdown > 0 && (
        <div className="flex items-center gap-3 px-6 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Zap className="h-5 w-5 text-amber-400" />
          <span className="text-amber-200">
            Auto-retrying in <span className="font-mono font-bold">{countdown}s</span>
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => {
            setCountdown(null);
            setIsRetrying(true);
            reset();
          }}
          disabled={isRetrying}
          className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/60 bg-indigo-500/20 px-6 py-3 font-semibold text-indigo-200 transition hover:bg-indigo-500/30 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
          {isRetrying ? 'Retrying...' : 'Retry now'}
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/40 px-6 py-3 font-semibold text-slate-200 transition hover:bg-slate-800"
        >
          <Home className="h-4 w-4" />
          Pick another matchup
        </Link>
      </div>
      
      {isColdStart && (
        <div className="mt-4 p-4 rounded-lg bg-slate-800/30 border border-slate-700/50 max-w-md">
          <p className="text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Why does this happen?</span>
            <br />
            We use a free-tier backend that spins down after inactivity to keep costs low. 
            The AI engine needs ~30 seconds to warm up.
          </p>
        </div>
      )}
      
      {!isColdStart && (
        <div className="mt-4 text-xs text-slate-500">
          <p>If this issue persists, please wait a few minutes and try again.</p>
        </div>
      )}
    </div>
  );
}
