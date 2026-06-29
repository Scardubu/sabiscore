export const VERDICT_SEQUENCE = [
  "PARTIAL",
  "NO_BET",
  "HOLD",
  "SPECULATIVE",
  "ACTIONABLE",
  "HIGH_CONVICTION",
] as const;

export type ProductionVerdict = (typeof VERDICT_SEQUENCE)[number];

export interface VerdictPresentation {
  label: string;
  summary: string;
  badgeClass: string;
  icon: "incomplete" | "skip" | "monitor" | "risk" | "value" | "conviction";
  pulse: boolean;
  tone: "partial" | "pass" | "neutral" | "watch" | "positive";
}

export const VERDICT_PRESENTATION: Record<ProductionVerdict, VerdictPresentation> = {
  PARTIAL: {
    label: "Incomplete Data",
    summary: "Required evidence is missing, stale, or conflicting.",
    badgeClass: "border-slate-500/40 bg-slate-500/10 text-slate-200",
    icon: "incomplete",
    pulse: false,
    tone: "partial",
  },
  NO_BET: {
    label: "Skip This Match",
    summary: "Verified inputs do not support a positive-value position.",
    badgeClass: "border-rose-500/40 bg-rose-500/10 text-rose-200",
    icon: "skip",
    pulse: false,
    tone: "pass",
  },
  HOLD: {
    label: "Monitor Closely",
    summary: "Some value may exist, but a promotion gate has not passed.",
    badgeClass: "border-amber-400/40 bg-amber-400/10 text-amber-100",
    icon: "monitor",
    pulse: false,
    tone: "neutral",
  },
  SPECULATIVE: {
    label: "Risky — Small Stake Only",
    summary: "Positive evidence exists below the actionable threshold.",
    badgeClass: "border-orange-400/40 bg-orange-400/10 text-orange-100",
    icon: "risk",
    pulse: false,
    tone: "watch",
  },
  ACTIONABLE: {
    label: "Good Value",
    summary: "All actionable gates pass at the current verified price.",
    badgeClass: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100",
    icon: "value",
    pulse: false,
    tone: "positive",
  },
  HIGH_CONVICTION: {
    label: "Bet Now",
    summary: "High-conviction evidence and calibrated edge gates pass.",
    badgeClass: "border-lime-300/50 bg-lime-300/15 text-lime-100",
    icon: "conviction",
    pulse: true,
    tone: "positive",
  },
};

export function isProductionVerdict(value: unknown): value is ProductionVerdict {
  return typeof value === "string" && VERDICT_SEQUENCE.includes(value as ProductionVerdict);
}

export function getVerdictPresentation(value: unknown): VerdictPresentation {
  return isProductionVerdict(value)
    ? VERDICT_PRESENTATION[value]
    : VERDICT_PRESENTATION.PARTIAL;
}
