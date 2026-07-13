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
  type LucideIcon,
} from "lucide-react";

export interface LoadingFact {
  icon: LucideIcon;
  text: string;
}

/**
 * Rotating status lines shown while an analysis loads.
 * Each line describes a real stage of the SabiScore evidence/prediction
 * pipeline — no invented capabilities, no bookmaker brand claims.
 */
export const LOADING_FACTS: LoadingFact[] = [
  { icon: Trophy, text: "Analyzing historical head-to-head records..." },
  { icon: TrendingUp, text: "Processing recent form data..." },
  { icon: Users, text: "Reviewing squad availability and injuries..." },
  { icon: Target, text: "Computing expected goals (xG) metrics..." },
  { icon: Zap, text: "Comparing model probabilities to market odds..." },
  { icon: BarChart3, text: "Running ensemble prediction models..." },
  { icon: Star, text: "Updating team strength ratings..." },
  { icon: Shield, text: "Checking evidence freshness..." },
  { icon: Activity, text: "Calibrating outcome probabilities..." },
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
