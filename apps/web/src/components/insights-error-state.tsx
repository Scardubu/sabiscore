"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface InsightsErrorStateProps {
  errorType: "timeout" | "server" | "unknown";
  matchup: string;
}

const CONFIG = {
  timeout: {
    countdown: 30,
    accent: "amber",
    label: "Engine Warming Up",
    heading: "Just a moment…",
    icon: "clock",
    showWhyNote: true,
  },
  server: {
    countdown: 45,
    accent: "rose",
    label: "Service Temporarily Unavailable",
    heading: "We hit a snag",
    icon: "alert",
    showWhyNote: false,
  },
  unknown: {
    countdown: 30,
    accent: "rose",
    label: "Unexpected Error",
    heading: "We hit a snag",
    icon: "alert",
    showWhyNote: false,
  },
} as const;

/**
 * Inline error state for the match insights page.
 *
 * Rendered directly inside the server component so Next.js 15's production
 * error sanitisation doesn't hide actionable information behind a digest hash.
 *
 * All three error types now include an auto-retry countdown so users are never
 * left waiting indefinitely on a cold-start that was mis-classified.
 */
export function InsightsErrorState({ errorType, matchup }: InsightsErrorStateProps) {
  const cfg = CONFIG[errorType];
  const isAmber = cfg.accent === "amber";

  const [countdown, setCountdown] = useState<number>(cfg.countdown);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (countdown <= 0 && !refreshing) {
      setRefreshing(true);
      window.location.reload();
      return;
    }
    const t = setTimeout(
      () => setCountdown((c) => (c > 0 ? c - 1 : 0)),
      1000,
    );
    return () => clearTimeout(t);
  }, [countdown, refreshing]);

  const handleRetryNow = () => {
    setCountdown(0);
    setRefreshing(true);
    window.location.reload();
  };

  const body =
    errorType === "timeout"
      ? `Our AI prediction engine is starting up for ${matchup}. This happens after periods of inactivity and typically takes 30–60 seconds.`
      : errorType === "server"
      ? `Our prediction service is temporarily unavailable for ${matchup}. This usually resolves within a few minutes.`
      : `Something unexpected happened while generating insights for ${matchup}. This usually resolves on retry.`;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${cfg.label} — auto-retrying in ${countdown} seconds`}
      className="flex flex-col items-center gap-6 py-16 px-4 text-center"
    >
      {/* Icon */}
      <div
        className={`flex h-20 w-20 items-center justify-center rounded-full border ${
          isAmber
            ? "bg-amber-500/10 border-amber-500/30"
            : "bg-slate-800/50 border-rose-500/30"
        }`}
      >
        {isAmber ? (
          <svg
            className="h-10 w-10 text-amber-400 motion-safe:animate-pulse"
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
            className="h-10 w-10 text-rose-400"
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

      {/* Text */}
      <div className="space-y-3">
        <p
          className={`text-sm font-semibold uppercase tracking-wider ${
            isAmber ? "text-amber-300" : "text-rose-300"
          }`}
        >
          {cfg.label}
        </p>
        <h2 className="text-3xl font-bold text-slate-100">{cfg.heading}</h2>
        <p className="text-slate-400 max-w-md mx-auto">{body}</p>
      </div>

      {/* Countdown pill — always visible */}
      {countdown > 0 && !refreshing && (
        <div
          className={`flex items-center gap-3 rounded-xl border px-6 py-3 ${
            isAmber
              ? "border-amber-500/20 bg-amber-500/10"
              : "border-slate-700/40 bg-slate-800/40"
          }`}
        >
          <svg
            className={`h-5 w-5 ${isAmber ? "text-amber-400" : "text-slate-400"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <span className={isAmber ? "text-amber-200" : "text-slate-300"}>
            Auto-retrying in{" "}
            <span className="font-mono font-bold tabular-nums">{countdown}s</span>
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          disabled={refreshing}
          onClick={handleRetryNow}
          className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/60 bg-indigo-500/20 px-6 py-3 font-semibold text-indigo-200 transition hover:bg-indigo-500/30 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <svg
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
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
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/40 px-6 py-3 font-semibold text-slate-200 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Pick another matchup
        </Link>
      </div>

      {/* Cold-start explanation note */}
      {cfg.showWhyNote && (
        <div className="mt-2 max-w-md rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
          <p className="text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Why does this happen?</span>
            <br />
            We use a free-tier backend that spins down after inactivity to keep costs low. The AI
            engine needs ~30 seconds to warm up.
          </p>
        </div>
      )}
    </div>
  );
}
