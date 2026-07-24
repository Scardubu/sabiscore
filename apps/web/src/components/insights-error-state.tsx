"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  isRetryableInfrastructureError,
  type AnalysisErrorCategory,
} from "@/lib/full-analysis-contract";

interface InsightsErrorStateProps {
  errorType: AnalysisErrorCategory;
  matchup: string;
}

const CONFIG = {
  cold_start: {
    countdown: 30,
    accent: "amber",
    label: "Engine Warming Up",
    heading: "Full AI insights are on their way",
    showWhyNote: true,
  },
  upstream_timeout: {
    countdown: 20,
    accent: "amber",
    label: "Backend Response Delayed",
    heading: "Analysis is taking longer than expected",
    showWhyNote: false,
  },
  upstream_unavailable: {
    countdown: 30,
    accent: "amber",
    label: "Backend Temporarily Unavailable",
    heading: "Analysis service is reconnecting",
    showWhyNote: false,
  },
  network_error: {
    countdown: 15,
    accent: "amber",
    label: "Network Unavailable",
    heading: "The analysis request could not connect",
    showWhyNote: false,
  },
  backend_internal_error: {
    countdown: 45,
    accent: "rose",
    label: "Service Temporarily Unavailable",
    heading: "We hit a snag",
    showWhyNote: false,
  },
  invalid_response: {
    countdown: 30,
    accent: "rose",
    label: "Invalid Backend Response",
    heading: "The analysis contract could not be verified",
    showWhyNote: false,
  },
  unknown: {
    countdown: 30,
    accent: "rose",
    label: "Unexpected Error",
    heading: "We hit a snag",
    showWhyNote: false,
  },
} as const;

// Auto-reload at most this many times per matchup per tab session; after that
// the countdown stops and only manual retry remains. Prevents an infinite
// full-page reload loop when the insights endpoint stays down while the
// analysis sections below are already rendering live data.
const MAX_AUTO_RELOADS = 0;

export const retryStorageKey = (matchup: string) => `ss-insights-retries:${matchup}`;

function readAttempts(matchup: string): number {
  try {
    return Number(sessionStorage.getItem(retryStorageKey(matchup)) ?? "0") || 0;
  } catch {
    return 0;
  }
}

function bumpAttempts(matchup: string) {
  try {
    sessionStorage.setItem(retryStorageKey(matchup), String(readAttempts(matchup) + 1));
  } catch {
    // storage unavailable — auto-retry cap simply won't persist
  }
}

/**
 * Inline error state for the match insights page.
 *
 * Rendered directly inside the server component so Next.js 15's production
 * error sanitisation doesn't hide actionable information behind a digest hash.
 *
 * Compact card (not a full-viewport hero): the 6-layer analysis and Phase 8
 * sections mount below it and load independently, so this must not push them
 * off screen or keep reloading a page that already shows live results.
 */
export function InsightsErrorState({ errorType, matchup }: InsightsErrorStateProps) {
  const cfg = CONFIG[errorType];
  const isAmber = cfg.accent === "amber";
  const mayAutoRetry = isRetryableInfrastructureError(errorType);

  const [countdown, setCountdown] = useState<number>(cfg.countdown);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRetryExhausted, setAutoRetryExhausted] = useState(false);

  // Read the per-matchup reload count after mount (sessionStorage is
  // client-only; reading in render would break SSR hydration).
  useEffect(() => {
    if (!mayAutoRetry || readAttempts(matchup) >= MAX_AUTO_RELOADS) {
      setAutoRetryExhausted(true);
    }
  }, [matchup, mayAutoRetry]);

  useEffect(() => {
    if (autoRetryExhausted || refreshing) return;
    if (countdown <= 0) {
      bumpAttempts(matchup);
      setRefreshing(true);
      window.location.reload();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearTimeout(t);
  }, [countdown, refreshing, autoRetryExhausted, matchup]);

  // Manual retry never counts against the auto-reload cap.
  const handleRetryNow = () => {
    setRefreshing(true);
    window.location.reload();
  };

  const body =
    errorType === "cold_start"
      ? `The prediction engine is starting up for ${matchup} — this takes 30–60 seconds after idle.`
      : errorType === "upstream_timeout"
      ? `The backend did not complete the ${matchup} analysis within the request budget.`
      : errorType === "upstream_unavailable"
      ? `The analysis backend is temporarily unavailable for ${matchup}.`
      : errorType === "network_error"
      ? `The ${matchup} request could not reach the analysis backend.`
      : errorType === "invalid_response"
      ? `The response for ${matchup} failed contract validation and was not displayed.`
      : errorType === "backend_internal_error"
      ? `The prediction service is temporarily unavailable for ${matchup}. This usually resolves within a few minutes.`
      : `Something unexpected happened while generating insights for ${matchup}. This usually resolves on retry.`;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={
        autoRetryExhausted
          ? `${cfg.label} — auto-retry paused, retry manually`
          : `${cfg.label} — auto-retrying in ${countdown} seconds`
      }
      className={`rounded-2xl border p-5 sm:p-6 ${
        isAmber
          ? "border-amber-500/25 bg-amber-500/[0.04]"
          : "border-rose-500/25 bg-slate-900/40"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* Icon */}
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${
            isAmber
              ? "bg-amber-500/10 border-amber-500/30"
              : "bg-slate-800/50 border-rose-500/30"
          }`}
        >
          {isAmber ? (
            <svg
              className="h-5 w-5 text-amber-400 motion-safe:animate-pulse"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          ) : (
            <svg
              className="h-5 w-5 text-rose-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </div>

        {/* Text + actions */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <p
              className={`text-[11px] font-semibold uppercase tracking-wider ${
                isAmber ? "text-amber-300" : "text-rose-300"
              }`}
            >
              {cfg.label}
            </p>
            <h2 className="text-lg font-bold text-slate-100">{cfg.heading}</h2>
            <p className="text-sm text-slate-400">{body}</p>
            <p className="text-xs text-slate-500">
              The analysis sections below load independently and update on their own — no need to wait here.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={refreshing}
              onClick={handleRetryNow}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-indigo-500/60 bg-indigo-500/20 px-4 py-2 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-500/30 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <svg
                className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              {refreshing ? "Retrying…" : "Retry now"}
            </button>
            <Link
              href="/match"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-800/40 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
            >
              Pick another matchup
            </Link>
            {!autoRetryExhausted && countdown > 0 && !refreshing && (
              <span className={`text-xs ${isAmber ? "text-amber-200/80" : "text-slate-400"}`}>
                Auto-retrying in{" "}
                <span className="font-mono font-bold tabular-nums">{countdown}s</span>
              </span>
            )}
            {autoRetryExhausted && !refreshing && (
              <span className="text-xs text-slate-500">
                Auto-retry paused — use the button when ready.
              </span>
            )}
          </div>

          {cfg.showWhyNote && (
            <p className="text-xs text-slate-500">
              <span className="font-semibold text-slate-400">Why does this happen?</span>{" "}
              We use a free-tier backend that spins down after inactivity to keep costs low — the
              engine needs ~30 seconds to warm up.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
