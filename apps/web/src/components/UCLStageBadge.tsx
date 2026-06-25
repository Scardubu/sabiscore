"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

// ─── Stage metadata ────────────────────────────────────────────────────────────

const STAGE_META: Record<
  string,
  { label: string; short: string; className: string }
> = {
  group: {
    label: "Group Stage",
    short: "GS",
    className:
      "border-indigo-500/35 bg-indigo-500/10 text-indigo-300",
  },
  r16: {
    label: "Round of 16",
    short: "R16",
    className:
      "border-cyan-500/35 bg-cyan-500/10 text-cyan-300",
  },
  qf: {
    label: "Quarter-Final",
    short: "QF",
    className:
      "border-emerald-500/35 bg-emerald-500/10 text-emerald-300",
  },
  sf: {
    label: "Semi-Final",
    short: "SF",
    className:
      "border-amber-500/35 bg-amber-500/10 text-amber-300",
  },
  final: {
    label: "Final",
    short: "F",
    className:
      "border-yellow-400/40 bg-yellow-400/10 text-yellow-300 font-bold",
  },
};

const FALLBACK_META = {
  label: "UCL",
  short: "UCL",
  className: "border-indigo-500/25 bg-indigo-500/8 text-indigo-400",
};

// ─── Component ─────────────────────────────────────────────────────────────────

interface UCLStageBadgeProps {
  /** Backend competition_stage slug: "group" | "r16" | "qf" | "sf" | "final" */
  stage: string | null | undefined;
  /** Render the full label or the compact abbreviation */
  compact?: boolean;
  className?: string;
}

/**
 * Pill badge surfacing the UCL knockout/group stage.
 * Renders nothing when `stage` is null/undefined (domestic matches).
 * WCAG 2.2 AA: full stage name is provided via aria-label even in compact mode.
 */
export const UCLStageBadge = memo(function UCLStageBadge({
  stage,
  compact = false,
  className,
}: UCLStageBadgeProps) {
  if (!stage) return null;

  const meta = STAGE_META[stage.toLowerCase()] ?? FALLBACK_META;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider",
        meta.className,
        className,
      )}
      aria-label={`Competition stage: ${meta.label}`}
      title={meta.label}
    >
      {compact ? meta.short : meta.label}
    </span>
  );
});

export default UCLStageBadge;
