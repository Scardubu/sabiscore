"use client";

import { memo } from "react";
import type { CausalSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

interface CausalInsightsProps {
  summary?: CausalSummary | null;
  premiumVisuals?: boolean;
}

const formatName = (name: string) =>
  name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function StatusPill({ status }: { status: string }) {
  const isReady = status === "ready";
  return (
    <span
      className={cn(
        "text-xs px-2.5 py-1 rounded-full border font-semibold",
        isReady
          ? "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300"
          : "border-slate-700/50 bg-slate-800/60 text-slate-400"
      )}
    >
      {isReady ? "✓ Report ready" : status}
    </span>
  );
}

function DriverChip({ name, index }: { name: string; index: number }) {
  // Opacity decays from 1.0 → 0.55 as rank increases
  const opacity = Math.max(0.55, 1 - index * 0.09);
  return (
    <li
      className="flex items-center gap-2.5 group"
      style={{ opacity }}
    >
      <span
        className="flex-shrink-0 w-5 h-5 rounded-full bg-fuchsia-500/20 text-fuchsia-400
                   flex items-center justify-center text-[10px] font-bold select-none"
        aria-hidden="true"
      >
        {index + 1}
      </span>
      <span className="truncate text-fuchsia-300 text-sm group-hover:text-fuchsia-200 motion-safe:transition-colors">
        {formatName(name)}
      </span>
    </li>
  );
}

function ColliderChip({ name }: { name: string }) {
  return (
    <li className="flex items-center gap-2.5">
      <svg
        className="w-4 h-4 flex-shrink-0 text-amber-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        />
      </svg>
      <span className="truncate text-amber-300 text-sm">{formatName(name)}</span>
    </li>
  );
}

function CausalInsightsInner({ summary, premiumVisuals = false }: CausalInsightsProps) {
  if (!summary) return null;

  const hasDrivers = summary.top_drivers.length > 0;
  const hasWarnings = summary.collider_warnings.length > 0;

  return (
    <section
      aria-label="Causal feature signals"
      className={cn(
        "glass-card p-8 space-y-6 border",
        premiumVisuals
          ? "border-fuchsia-500/20 bg-slate-950/70 shadow-[0_15px_45px_rgba(192,38,211,0.12)]"
          : "border-fuchsia-500/20"
      )}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={cn(
          "text-2xl font-bold flex items-center gap-2.5",
          premiumVisuals ? "text-fuchsia-400" : "text-slate-100"
        )}>
          <svg className="w-6 h-6 text-fuchsia-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Causal Signals
        </h2>
        <StatusPill status={summary.status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Top causal drivers */}
        <div className="rounded-xl bg-slate-900/50 p-5 border border-slate-800/60 space-y-3">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Top Causal Drivers
          </p>
          {hasDrivers ? (
            <ul className="space-y-2.5" aria-label="Top causal feature drivers">
              {summary.top_drivers.slice(0, 6).map((driver, i) => (
                <DriverChip key={driver} name={driver} index={i} />
              ))}
            </ul>
          ) : (
            <p className="text-slate-500 text-sm leading-relaxed">
              {summary.status === "unavailable"
                ? "Run scripts/causal_feature_analysis.py to generate the causal report."
                : "No causal drivers identified."}
            </p>
          )}
        </div>

        {/* Collider warnings */}
        <div className="rounded-xl bg-slate-900/50 p-5 border border-slate-800/60 space-y-3">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Collider Warnings
          </p>
          {hasWarnings ? (
            <ul className="space-y-2.5" aria-label="Collider feature warnings">
              {summary.collider_warnings.map((w) => (
                <ColliderChip key={w} name={w} />
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>No collider warnings detected</span>
            </div>
          )}

          <div className="mt-2 rounded-lg bg-slate-950/40 p-3 border border-slate-800/50">
            <p className="text-xs text-slate-600 leading-relaxed">
              Colliders can introduce spurious correlations when conditioned on.
              Features flagged here should be treated with caution in downstream models.
            </p>
          </div>
        </div>
      </div>

      {/* Footer: analysis mode badge + source */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-900/50 border border-slate-800/50 rounded-full px-3 py-1">
          <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Analysis-only · no feature registry changes (C13)
        </span>
        {summary.source && (
          <p className="text-xs text-slate-600 truncate max-w-xs" title={summary.source}>
            {summary.source}
          </p>
        )}
      </div>
    </section>
  );
}

export const CausalInsights = memo(CausalInsightsInner);
