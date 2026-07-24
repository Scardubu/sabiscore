"use client";

/**
 * Phase 8 Sprint 2: Phase8AnalyticsSection wrapper
 *
 * Thin client wrapper around Phase8AnalyticsPanel.
 * Reads PHASE8_ANALYTICS feature flag; renders nothing if disabled.
 * Used by server components that cannot import "use client" components directly.
 */

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { FeatureFlag, useFeatureFlag } from "@/lib/feature-flags";

const Phase8AnalyticsPanel = dynamic(
  () =>
    import("./phase8-analytics-panel").then((m) => ({
      default: m.Phase8AnalyticsPanel,
    })),
  { ssr: false, loading: () => <Phase8Skeleton /> }
);

function Phase8Skeleton() {
  return (
    <div className="space-y-3 animate-pulse" aria-hidden="true">
      <div className="h-7 w-48 rounded-lg bg-slate-800/70" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-44 rounded-2xl bg-slate-800/50" />
        ))}
      </div>
    </div>
  );
}

function Phase8Fallback() {
  return (
    <div className="rounded-2xl border border-slate-800/50 bg-slate-900/30 p-6 text-center">
      <p className="text-sm text-slate-500">
        Phase 8 feature analytics unavailable for this match.
      </p>
    </div>
  );
}

interface Phase8AnalyticsSectionProps {
  matchId: string;
  league?: string;
}

export function Phase8AnalyticsSection({
  matchId,
  league = "EPL",
}: Phase8AnalyticsSectionProps) {
  const enabled = useFeatureFlag(FeatureFlag.PHASE8_ANALYTICS);

  if (!enabled) {
    return (
      <aside
        className="rounded-xl border border-slate-800/50 bg-slate-900/30 px-4 py-3 text-xs text-slate-500"
        aria-label="Phase 8 availability"
      >
        Phase 8 enrichment is disabled; no Phase 8 signals influence this analysis.
      </aside>
    );
  }

  return (
    <section aria-label="Phase 8 feature analytics">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-px flex-1 bg-slate-800/60" />
        <span className="text-[11px] uppercase tracking-[0.35em] text-slate-600 font-semibold">
          Phase 8 · Feature Intelligence
        </span>
        <div className="h-px flex-1 bg-slate-800/60" />
      </div>

      <ErrorBoundary fallback={(_error, _reset) => <Phase8Fallback />}>
        <Suspense fallback={<Phase8Skeleton />}>
          <Phase8AnalyticsPanel matchId={matchId} league={league} />
        </Suspense>
      </ErrorBoundary>
    </section>
  );
}
