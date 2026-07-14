import {
  Trophy,
  TrendingUp,
  Users,
  Target,
  Zap,
  BarChart3,
  Star,
  Shield,
  Activity,
  Database,
  type LucideIcon,
} from "lucide-react";

export interface LoadingFact {
  icon: LucideIcon;
  text: string;
}

/**
 * Rotating status lines shown while an analysis loads.
 * First 5 mirror the 5-step pipeline visible on the homepage.
 * Remaining 4 are technical tips — no bookmaker brand claims.
 */
export const LOADING_FACTS: LoadingFact[] = [
  { icon: Database, text: "Collecting evidence from 5 independent providers..." },
  { icon: Shield, text: "Reconciling fixture identity across providers..." },
  { icon: BarChart3, text: "Calibrating ensemble model probabilities per league..." },
  { icon: TrendingUp, text: "De-vigging bookmaker odds to find fair market price..." },
  { icon: Zap, text: "Applying evidence gates and sizing the verdict..." },
  { icon: Trophy, text: "Analyzing historical head-to-head records..." },
  { icon: Target, text: "Computing expected goals (xG) metrics..." },
  { icon: Users, text: "Reviewing squad availability and injuries..." },
  { icon: Star, text: "Updating team strength ratings..." },
  { icon: Activity, text: "Checking evidence freshness and calibration coverage..." },
];

/**
 * Neutral, educational facts shown during longer waits.
 * Analytical definitions only — no profit claims, no promotional
 * betting copy (CLAUDE.md prohibited-language rule).
 */
export const FUN_FACTS = [
  "The first ever international football match was played between Scotland and England in 1872.",
  "xG (Expected Goals) measures the quality of chances created, not just shots taken.",
  "The Kelly Criterion is a bankroll-proportional method for sizing stakes relative to estimated edge.",
  "PPDA (Passes Per Defensive Action) measures pressing intensity.",
  "Home advantage is worth approximately 0.4 goals per match on average.",
  "Weather conditions can significantly impact over/under totals.",
  "xA (Expected Assists) measures the quality of key passes.",
  "Deep completions track passes into the penalty area.",
  "De-vigging removes the bookmaker margin to reveal fair market probabilities.",
  "Ranked Probability Score (RPS) rewards forecasts that are close in ordering, not just exactly right.",
];
