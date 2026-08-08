"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { edgeQualityColor, edgeQualityLabel } from "@/lib/edge-quality";

interface EdgeQualityBarProps {
  /** 0-1 composite quality score — see @/lib/edge-quality for the formula. */
  score: number;
  className?: string;
}

/**
 * Small quality bar + High/Medium/Low label for `edge_quality_score`.
 * Never labelled "% edge" — it is a confidence/freshness/completeness blend,
 * not a market edge. Show the real market edge (`best_value_bet.edge_pct`)
 * separately, gated on `has_value`, when one exists.
 */
export const EdgeQualityBar = memo(function EdgeQualityBar({
  score,
  className,
}: EdgeQualityBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, score)) * 100);
  const label = edgeQualityLabel(score);
  const color = edgeQualityColor(score);
  return (
    <div
      className={cn("flex flex-col gap-0.5", className)}
      title={`Edge quality: ${label} (${pct}%)`}
      aria-label={`Edge quality ${label}, ${pct} percent`}
    >
      <div className="h-1 w-12 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[9px] uppercase tracking-wider text-slate-600">{label}</p>
    </div>
  );
});

export default EdgeQualityBar;
