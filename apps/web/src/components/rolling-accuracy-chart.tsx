"use client";

import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { AlertCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AccuracyPoint {
  date: string;
  accuracy: number;
  baseline?: number;
  n_matches?: number;
}

interface ModelPerformanceResponse {
  league: string | null;
  window: number;
  series: AccuracyPoint[];
  current_accuracy?: number;
  baseline_accuracy?: number;
  error?: string;
}

// ─── Data fetch ───────────────────────────────────────────────────────────────

async function fetchModelPerformance(
  league: string,
  window: number,
): Promise<ModelPerformanceResponse> {
  const params = new URLSearchParams({ window: String(window) });
  if (league) params.set("league", league);
  const res = await fetch(`/api/model-performance?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<ModelPerformanceResponse>;
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function AccuracyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/95 px-3 py-2 shadow-xl backdrop-blur-sm">
      <p className="mb-1.5 text-xs font-semibold text-slate-300">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-xs">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: p.color }}
            aria-hidden="true"
          />
          <span className="text-slate-400">{p.name}:</span>
          <span className="font-bold text-white">{(p.value * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <div className="flex h-48 items-center justify-center animate-pulse" aria-hidden="true">
      <div className="h-40 w-full rounded-lg bg-slate-800/50" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const RollingAccuracyChart = memo(function RollingAccuracyChart({
  league = "",
  window: rollingWindow = 30,
  className,
}: {
  league?: string;
  window?: number;
  className?: string;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["model-performance", league, rollingWindow],
    queryFn: () => fetchModelPerformance(league, rollingWindow),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const series = data?.series ?? [];
  const currentAccuracy = data?.current_accuracy;
  const baselineAccuracy = data?.baseline_accuracy ?? 0.333;

  // Format date labels to short form
  const chartData = series.map((pt) => ({
    ...pt,
    label:
      pt.date
        ? new Date(pt.date).toLocaleDateString([], { month: "short", day: "numeric" })
        : pt.date,
  }));

  return (
    <section
      data-testid="rolling-accuracy-chart"
      className={cn("rounded-2xl border border-white/[0.07] bg-slate-900/70 p-4 shadow-lg", className)}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-sky-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-white">
            Rolling Accuracy
            {league ? ` · ${league}` : " · All Leagues"}
          </h2>
        </div>
        {currentAccuracy !== undefined && (
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-bold",
              currentAccuracy >= baselineAccuracy
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/30 bg-rose-500/10 text-rose-300",
            )}
          >
            {(currentAccuracy * 100).toFixed(1)}%
          </span>
        )}
      </div>

      {/* Chart */}
      {isLoading ? (
        <ChartSkeleton />
      ) : isError ? (
        <div className="flex items-center justify-center gap-2 py-12 text-rose-400" role="alert">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <span className="text-sm">Failed to load performance data</span>
        </div>
      ) : series.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center" data-testid="chart-empty">
          <TrendingUp className="h-7 w-7 text-slate-600" aria-hidden="true" />
          <p className="text-sm text-slate-500">No performance data yet for this window</p>
        </div>
      ) : (
        <div aria-label={`Rolling ${rollingWindow}-day accuracy chart`}>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0.2, 0.8]}
                tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<AccuracyTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, color: "#94a3b8", paddingTop: 8 }}
              />
              <ReferenceLine
                y={baselineAccuracy}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{ value: "Baseline", position: "insideTopRight", fill: "#f59e0b", fontSize: 9 }}
              />
              <Line
                type="monotone"
                dataKey="accuracy"
                name="Model accuracy"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#38bdf8" }}
              />
              {series[0]?.baseline !== undefined && (
                <Line
                  type="monotone"
                  dataKey="baseline"
                  name="Rolling baseline"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="mt-2 text-right text-[10px] text-slate-600">
        {rollingWindow}-day rolling window · Correct outcome accuracy
      </p>
    </section>
  );
});
