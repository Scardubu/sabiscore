"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RollingAccuracyChart } from "@/components/rolling-accuracy-chart";
import { ValueBetScanner } from "@/components/value-bet-scanner";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PerfSummary {
  accuracy_30d?: number;
  accuracy_season?: number;
  clv_30d?: number;
  bets_tracked?: number;
  roi_30d?: number;
  error?: string;
}

// ─── Summary stats ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  detail,
  positive,
}: {
  label: string;
  value: string;
  detail?: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-slate-900/70 px-4 py-4 shadow-lg">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold tracking-tight",
          positive === undefined ? "text-white" : positive ? "text-emerald-400" : "text-rose-400",
        )}
        aria-label={`${label}: ${value}`}
      >
        {value}
      </p>
      {detail && <p className="mt-0.5 text-xs text-slate-600">{detail}</p>}
    </div>
  );
}

const LEAGUES = [
  { id: "", name: "All Leagues" },
  { id: "EPL", name: "EPL" },
  { id: "La Liga", name: "La Liga" },
  { id: "Bundesliga", name: "Bundesliga" },
  { id: "Serie A", name: "Serie A" },
  { id: "Ligue 1", name: "Ligue 1" },
  { id: "Eredivisie", name: "Eredivisie" },
  { id: "UCL", name: "UCL" },
];

const WINDOWS = [
  { value: 14, label: "14d" },
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
];

// ─── Main client component ────────────────────────────────────────────────────

export function PerformancePageClient() {
  const [selectedLeague, setSelectedLeague] = useState("");
  const [selectedWindow, setSelectedWindow] = useState(30);

  const { data: summary } = useQuery<PerfSummary>({
    queryKey: ["model-performance-summary"],
    queryFn: async () => {
      const res = await fetch("/api/model-performance/summary", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const acc30d = summary?.accuracy_30d;
  const accSeason = summary?.accuracy_season;
  const clv30d = summary?.clv_30d;
  const roi30d = summary?.roi_30d;
  const betsTracked = summary?.bets_tracked;

  return (
    <div className="space-y-6">
      {/* Summary stat cards */}
      <section aria-label="Performance summary statistics">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="30d Accuracy"
            value={acc30d !== undefined ? `${(acc30d * 100).toFixed(1)}%` : "—"}
            detail="Correct outcome"
            positive={acc30d !== undefined ? acc30d >= 0.5 : undefined}
          />
          <StatCard
            label="Season Accuracy"
            value={accSeason !== undefined ? `${(accSeason * 100).toFixed(1)}%` : "—"}
            detail="Since Aug"
          />
          <StatCard
            label="30d CLV"
            value={clv30d !== undefined ? `${clv30d > 0 ? "+" : ""}${clv30d.toFixed(1)}¢` : "—"}
            detail="Closing line value"
            positive={clv30d !== undefined ? clv30d >= 0 : undefined}
          />
          <StatCard
            label="30d ROI"
            value={roi30d !== undefined ? `${roi30d > 0 ? "+" : ""}${(roi30d * 100).toFixed(1)}%` : "—"}
            detail="Quarter-Kelly staking"
            positive={roi30d !== undefined ? roi30d >= 0 : undefined}
          />
          <StatCard
            label="Bets Tracked"
            value={betsTracked !== undefined ? betsTracked.toLocaleString() : "—"}
            detail="Value bets logged"
          />
        </div>
      </section>

      {/* Chart controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* League selector */}
        <div
          className="flex flex-wrap items-center gap-1 rounded-xl border border-white/[0.06] bg-slate-900/60 p-1"
          role="group"
          aria-label="League filter"
        >
          {LEAGUES.map((l) => (
            <button
              key={l.id}
              data-testid={`league-filter-${l.id || "all"}`}
              onClick={() => setSelectedLeague(l.id)}
              aria-pressed={selectedLeague === l.id}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                selectedLeague === l.id
                  ? "bg-slate-700 text-white"
                  : "text-slate-500 hover:text-slate-300",
              )}
            >
              {l.name}
            </button>
          ))}
        </div>

        {/* Window selector */}
        <div
          className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-slate-900/60 p-1"
          role="group"
          aria-label="Rolling window"
        >
          {WINDOWS.map((w) => (
            <button
              key={w.value}
              data-testid={`window-filter-${w.value}`}
              onClick={() => setSelectedWindow(w.value)}
              aria-pressed={selectedWindow === w.value}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                selectedWindow === w.value
                  ? "bg-slate-700 text-white"
                  : "text-slate-500 hover:text-slate-300",
              )}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rolling accuracy chart */}
      <RollingAccuracyChart
        league={selectedLeague}
        window={selectedWindow}
      />

      {/* Value bet scanner */}
      <ValueBetScanner days={7} />
    </div>
  );
}
