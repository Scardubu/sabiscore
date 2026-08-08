/**
 * edge_quality_score is a 0-1 composite (40% model confidence + 30% market
 * edge + 20% freshness + 10% completeness — see backend
 * `api/endpoints/upcoming_matches.py:_compute_edge_quality_score`). It is a
 * quality/confidence signal, NOT a market edge percentage — never render it
 * as "{score*100}% edge". Use these helpers, or the paired `EdgeQualityBar`
 * component (`@/components/edge-quality-bar`), everywhere the score is shown.
 */

export function edgeQualityColor(score: number): string {
  if (score >= 0.67) return "bg-emerald-500";
  if (score >= 0.33) return "bg-amber-400";
  return "bg-rose-500";
}

export function edgeQualityLabel(score: number): string {
  if (score >= 0.67) return "High";
  if (score >= 0.33) return "Medium";
  return "Low";
}

export interface EdgeQualityPill {
  /** e.g. "High quality" — deliberately never "% edge". */
  label: string;
  title: string;
  className: string;
}

/** Compact-pill variant of the quality signal (vs. EdgeQualityBar's two-line
 * bar+label) for dense card layouts like BigMatchesCarousel. Returns null
 * when no score is available — callers must not render a placeholder pill. */
export function describeEdgeQualityPill(score: number | null | undefined): EdgeQualityPill | null {
  if (score == null) return null;
  const label = edgeQualityLabel(score);
  const pct = Math.round(Math.min(1, Math.max(0, score)) * 100);
  const className =
    score >= 0.67
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : score >= 0.33
      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
      : "border-slate-700/40 text-slate-500";
  return { label: `${label} quality`, title: `Edge quality: ${label} (${pct}%)`, className };
}

/** Real market edge — the ONLY thing that should ever be labelled "% edge" —
 * shown only when a genuine value bet exists. */
export function describeValueBadge(
  hasValue: boolean,
  edgePct: number | null | undefined,
): string | null {
  if (!hasValue || edgePct == null) return null;
  return `Value ${edgePct.toFixed(1)}%`;
}
