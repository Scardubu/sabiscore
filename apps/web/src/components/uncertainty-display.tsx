"use client";

import { memo } from "react";
import type { UncertaintyBreakdown } from "@/lib/api";
import { cn } from "@/lib/utils";

interface UncertaintyDisplayProps {
  uncertainty?: UncertaintyBreakdown | null;
  premiumVisuals?: boolean;
}

const toPct = (value: number, digits = 1) =>
  `${(Math.max(0, value) * 100).toFixed(digits)}%`;

const barWidth = (value: number, max: number) =>
  `${Math.min(100, (Math.max(0, value) / Math.max(max, 1e-9)) * 100).toFixed(1)}%`;

interface MetricBarProps {
  label: string;
  value: number;
  formatted: string;
  max: number;
  color: "cyan" | "violet" | "amber" | "rose" | "teal";
  tooltip: string;
  sublabel?: string;
}

const COLOR_MAP: Record<MetricBarProps["color"], { track: string; fill: string; text: string }> = {
  cyan:   { track: "bg-cyan-500/20",   fill: "bg-cyan-500",   text: "text-cyan-300"   },
  violet: { track: "bg-violet-500/20", fill: "bg-violet-500", text: "text-violet-300" },
  amber:  { track: "bg-amber-500/20",  fill: "bg-amber-500",  text: "text-amber-300"  },
  rose:   { track: "bg-rose-500/20",   fill: "bg-rose-500",   text: "text-rose-300"   },
  teal:   { track: "bg-teal-500/20",   fill: "bg-teal-500",   text: "text-teal-300"   },
};

const MetricBar = ({ label, value, formatted, max, color, tooltip, sublabel }: MetricBarProps) => {
  const c = COLOR_MAP[color];
  return (
    <div title={tooltip} className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className={cn("font-semibold tabular-nums", c.text)}>{formatted}</span>
      </div>
      <div className="relative h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
        <div
          className={cn("h-full rounded-full motion-safe:transition-all motion-safe:duration-700", c.fill)}
          style={{ width: barWidth(value, max) }}
          role="progressbar"
          aria-valuenow={Math.round(value * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {sublabel && <p className="text-[10px] text-slate-600">{sublabel}</p>}
    </div>
  );
};

function UncertaintyDisplayInner({ uncertainty, premiumVisuals = false }: UncertaintyDisplayProps) {
  if (!uncertainty) return null;

  const ep = Math.max(0, uncertainty.epistemic_unc);
  const al = Math.max(0, uncertainty.aleatoric_unc);
  const α0 = Math.max(0, uncertainty.concentration);
  const lower = uncertainty.credible_interval?.lower ?? 0;
  const upper = uncertainty.credible_interval?.upper ?? 1;
  const ciSpan = Math.max(0, upper - lower);

  // Proportional stacked bar — scale both components so total never exceeds 100%
  const stackScale = (ep + al) > 1 ? 1 / (ep + al) : 1;
  const epStackPct = +(ep * stackScale * 100).toFixed(1);
  const alStackPct = +(Math.min(100 - epStackPct, al * stackScale * 100)).toFixed(1);

  // Resolve confidence tier: prefer backend field, fall back to local heuristic
  const tier = uncertainty.confidence_tier ?? (ep > 0.15 ? "LOW_EVIDENCE" : "OK");
  const isLowEvidence = tier === "LOW_EVIDENCE";

  // Signal quality: high when epistemic is low AND CI span is narrow
  const signalScore = Math.max(0, 1 - ep * 4 - ciSpan);
  const signalLabel = signalScore >= 0.7 ? "High Signal" : signalScore >= 0.4 ? "Moderate" : "Uncertain";
  const signalClass =
    signalScore >= 0.7
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : signalScore >= 0.4
      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
      : "border-rose-500/30 bg-rose-500/10 text-rose-300";

  const epColor: MetricBarProps["color"] =
    ep > 0.20 ? "rose" : ep > 0.10 ? "amber" : "cyan";

  return (
    <section
      aria-label="Model uncertainty breakdown"
      className={cn(
        "glass-card p-8 space-y-6 border",
        premiumVisuals
          ? "border-cyan-500/20 bg-slate-950/70 shadow-[0_15px_45px_rgba(6,182,212,0.12)]"
          : "border-cyan-500/20"
      )}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={cn(
          "text-2xl font-bold flex items-center gap-2.5",
          premiumVisuals ? "text-cyan-400" : "text-slate-100"
        )}>
          <svg className="w-6 h-6 text-cyan-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M9 17v-2m3 2v-4m3 4V7m2 10a2 2 0 002 2h1a2 2 0 002-2V5a2 2 0 00-2-2h-1a2 2 0 00-2 2m-6 12a2 2 0 002 2h1a2 2 0 002-2m-6 0a2 2 0 01-2 2H9a2 2 0 01-2-2m0 0V9a2 2 0 012-2h1a2 2 0 012 2v8" />
          </svg>
          Uncertainty Breakdown
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-xs px-2.5 py-1 rounded-full border font-semibold", signalClass)}>
            {signalLabel}
          </span>
          <span className={cn(
            "text-xs px-2.5 py-1 rounded-full border font-semibold",
            isLowEvidence
              ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          )}>
            {isLowEvidence ? "⚠ Low Evidence" : "✓ Stable"}
          </span>
        </div>
      </div>

      {/* Metric bars */}
      <div className="space-y-5">
        <MetricBar
          label="Epistemic (model uncertainty)"
          value={ep}
          formatted={toPct(ep)}
          max={0.40}
          color={epColor}
          tooltip="Unknown-unknowns — reducible with more data. High values trigger abstention."
          sublabel={ep > 0.15 ? "Abstention triggered above this threshold" : undefined}
        />
        <MetricBar
          label="Aleatoric (inherent noise)"
          value={al}
          formatted={toPct(al)}
          max={1.10}
          color="violet"
          tooltip="Irreducible randomness in football outcomes. Cannot be reduced by more data."
        />
        <MetricBar
          label="CI Span (95% interval width)"
          value={ciSpan}
          formatted={toPct(ciSpan)}
          max={0.60}
          color={ciSpan > 0.30 ? "amber" : "teal"}
          tooltip="Width of the 95% credible interval for the top predicted class. Narrower = more precise."
        />
      </div>

      {/* Evidence cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-slate-900/50 p-4 border border-slate-800/60 space-y-1">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Dirichlet α₀</p>
          <p className="text-2xl font-bold text-cyan-300 tabular-nums">{α0.toFixed(2)}</p>
          <p className="text-xs text-slate-600">Higher = stronger evidence</p>
        </div>
        <div className="rounded-xl bg-slate-900/50 p-4 border border-slate-800/60 space-y-1">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">95% CI</p>
          <p className="text-lg font-bold text-cyan-300 tabular-nums">
            {toPct(lower)} – {toPct(upper)}
          </p>
          <p className="text-xs text-slate-600">Top-class probability range</p>
        </div>
      </div>

      {/* Total uncertainty summary bar */}
      <div className="rounded-xl bg-slate-900/50 p-4 border border-slate-800/60">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>Total uncertainty (epistemic + aleatoric)</span>
          <span className="font-semibold text-slate-200 tabular-nums">{toPct(Math.min(ep + al, 1))}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden flex">
          <div
            className="h-full bg-cyan-500 motion-safe:transition-all motion-safe:duration-700"
            style={{ width: `${epStackPct}%` }}
          />
          <div
            className="h-full bg-violet-500 motion-safe:transition-all motion-safe:duration-700"
            style={{ width: `${alStackPct}%` }}
          />
        </div>
        <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" />Epistemic</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />Aleatoric</span>
        </div>
      </div>
    </section>
  );
}

export const UncertaintyDisplay = memo(UncertaintyDisplayInner);
