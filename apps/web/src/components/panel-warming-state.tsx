"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface PanelWarmingStateProps {
  /** Label for the panel (e.g. "Intelligence", "Phase 8 analytics"). */
  label: string;
  /** Callback to re-trigger the underlying React Query. */
  onRetry: () => void;
  /** Seconds between auto-retry attempts. Defaults to 12s. */
  intervalSeconds?: number;
}

/**
 * Compact warm-up state for in-page panels (FullAnalysisDashboard, Phase 8).
 *
 * Differs from {@link InsightsErrorState}:
 * - Auto-retries via React Query refetch instead of a full page reload
 * - Compact card layout matching the panel's existing error footprint
 * - Renders an aria-live countdown so screen-readers hear progress
 */
export function PanelWarmingState({
  label,
  onRetry,
  intervalSeconds = 12,
}: PanelWarmingStateProps) {
  const [countdown, setCountdown] = useState<number>(intervalSeconds);
  const [retrying, setRetrying] = useState(false);
  const onRetryRef = useRef(onRetry);

  useEffect(() => {
    onRetryRef.current = onRetry;
  }, [onRetry]);

  const triggerRetry = useCallback(() => {
    setRetrying(true);
    onRetryRef.current();
    setCountdown(intervalSeconds);
    setTimeout(() => setRetrying(false), 1500);
  }, [intervalSeconds]);

  useEffect(() => {
    if (countdown <= 0) {
      triggerRetry();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, triggerRetry]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${label} warming up, auto-retrying in ${countdown} seconds`}
      className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 flex items-start gap-3"
    >
      <svg
        className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400 animate-pulse"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-medium text-amber-200">
          {label} warming up
        </p>
        <p className="text-xs text-slate-400 leading-snug">
          The prediction engine is starting up after a period of inactivity.
          This typically takes 30–60 seconds.
        </p>
        <div className="flex items-center gap-3 pt-1">
          <span className="text-xs text-amber-300/90">
            Auto-retry in{" "}
            <span className="font-mono font-semibold tabular-nums">
              {countdown}s
            </span>
          </span>
          <button
            type="button"
            onClick={triggerRetry}
            disabled={retrying}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
          >
            <svg
              className={`h-3 w-3 ${retrying ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
            {retrying ? "Retrying…" : "Retry now"}
          </button>
        </div>
      </div>
    </div>
  );
}
