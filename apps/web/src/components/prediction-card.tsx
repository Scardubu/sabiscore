"use client";

import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamVsDisplay } from "./team-display";
import { TrendingUp, Target, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { FeatureFlag, useFeatureFlag } from "@/lib/feature-flags";

interface PredictionData {
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  confidence: number;
  predictedOutcome: string;
  edge?: number;
}

interface PredictionCardProps {
  homeTeam: string;
  awayTeam: string;
  league: string;
  prediction?: PredictionData;
  isLoading?: boolean;
  error?: string;
}

/**
 * Loading skeleton for prediction card
 * Provides engaging visual feedback while data loads
 */
function PredictionCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6 backdrop-blur-sm">
      {/* Header skeleton */}
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-6 w-32 bg-slate-700" />
        <Skeleton className="h-5 w-20 rounded-full bg-slate-700" />
      </div>

      {/* Teams skeleton */}
      <div className="mb-6 flex items-center justify-center gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-full bg-slate-700" />
          <Skeleton className="h-5 w-24 bg-slate-700" />
        </div>
        <Skeleton className="h-5 w-8 bg-slate-700" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-full bg-slate-700" />
          <Skeleton className="h-5 w-24 bg-slate-700" />
        </div>
      </div>

      {/* Probability bars skeleton */}
      <div className="mb-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-1">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20 bg-slate-700" />
              <Skeleton className="h-4 w-12 bg-slate-700" />
            </div>
            <Skeleton className="h-3 w-full rounded-full bg-slate-700">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500/30 to-purple-500/30"
                initial={{ width: "0%" }}
                animate={{ width: `${20 + Math.random() * 40}%` }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                }}
              />
            </Skeleton>
          </div>
        ))}
      </div>

      {/* Confidence skeleton */}
      <div className="flex items-center justify-between border-t border-slate-700/50 pt-4">
        <Skeleton className="h-5 w-28 bg-slate-700" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full bg-slate-700" />
          <Skeleton className="h-5 w-16 bg-slate-700" />
        </div>
      </div>
    </div>
  );
}

/**
 * Probability bar with animation
 */
function ProbabilityBar({
  label,
  probability,
  color,
  isHighest,
}: {
  label: string;
  probability: number;
  color: string;
  isHighest: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className={cn("font-medium", isHighest ? "text-white" : "text-slate-400")}>
          {label}
          {isHighest && (
            <CheckCircle className="ml-1 inline-block h-3.5 w-3.5 text-green-400" />
          )}
        </span>
        <span className={cn("font-bold", isHighest ? "text-white" : "text-slate-400")}>
          {typeof probability === 'number' ? (probability * 100).toFixed(1) : '0.0'}%
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
        <motion.div
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${probability * 100}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

/**
 * Get confidence tier based on probability
 */
function getConfidenceTier(confidence: number): {
  label: string;
  color: string;
  icon: typeof TrendingUp;
} {
  if (confidence >= 0.75) {
    return {
      label: "Very High",
      color: "text-green-400",
      icon: TrendingUp,
    };
  }
  if (confidence >= 0.65) {
    return {
      label: "High",
      color: "text-emerald-400",
      icon: Target,
    };
  }
  if (confidence >= 0.55) {
    return {
      label: "Moderate",
      color: "text-yellow-400",
      icon: Target,
    };
  }
  return {
    label: "Low",
    color: "text-orange-400",
    icon: AlertTriangle,
  };
}

/**
 * PredictionCard Component
 * 
 * Displays match prediction with probabilities, confidence, and edge
 * Features smooth loading states and animations
 */
export function PredictionCard({
  homeTeam,
  awayTeam,
  league,
  prediction,
  isLoading = false,
  error,
}: PredictionCardProps) {
  const premiumVisualsEnabled = useFeatureFlag(FeatureFlag.PREMIUM_VISUAL_HIERARCHY);

  if (isLoading) {
    return <PredictionCardSkeleton />;
  }

  if (error) {
    return (
      <div className={cn(
        "overflow-hidden rounded-xl border p-6 backdrop-blur-sm",
        premiumVisualsEnabled
          ? "border-red-500/20 bg-gradient-to-br from-slate-950/90 to-slate-900/70"
          : "border-red-500/30 bg-gradient-to-br from-slate-800/50 to-slate-900/50"
      )}>
        <div className="flex items-center gap-3 text-red-400">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-medium">Prediction Error</span>
        </div>
        <p className="mt-2 text-sm text-slate-400">{error}</p>
      </div>
    );
  }

  if (!prediction) {
    return null;
  }

  const highestProb = Math.max(
    prediction.homeWinProb,
    prediction.drawProb,
    prediction.awayWinProb
  );

  const confidenceTier = getConfidenceTier(prediction.confidence);
  const ConfidenceIcon = confidenceTier.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "overflow-hidden rounded-xl border backdrop-blur-sm transition-all",
        premiumVisualsEnabled
          ? "border-white/10 bg-gradient-to-br from-slate-950/90 to-slate-900/70 hover:border-cyan-400/30 hover:shadow-[0_15px_45px_rgba(0,212,255,0.12)]"
          : "border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/10"
      )}
    >
      {/* Header */}
      <div className={cn(
        "border-b px-6 py-4",
        premiumVisualsEnabled
          ? "border-white/10 bg-slate-900/60"
          : "border-slate-700/50 bg-slate-800/30"
      )}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-400">{league}</span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
              prediction.edge && prediction.edge > 0.05
                ? premiumVisualsEnabled
                  ? "border border-green-400/30 bg-green-500/10 text-green-400"
                  : "bg-green-500/20 text-green-400"
                : premiumVisualsEnabled
                ? "border border-white/10 bg-slate-800/60 text-slate-300"
                : "bg-slate-700/50 text-slate-300"
            )}
          >
            {prediction.edge && prediction.edge > 0.05 ? (
              <>
                <TrendingUp className="h-3 w-3" />
                Value Bet
              </>
            ) : (
              "Standard"
            )}
          </span>
        </div>
      </div>

      <div className="p-6">
        {/* Teams */}
        <div className="mb-6">
          <TeamVsDisplay homeTeam={homeTeam} awayTeam={awayTeam} league={league} size="lg" showCountryFlags={true} />
        </div>

        {/* Prediction indicator */}
        <div className="mb-6 rounded-lg bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-4 text-center">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Predicted Outcome
          </span>
          <p className="mt-1 text-xl font-bold text-white">
            {prediction.predictedOutcome === "home_win"
              ? `${homeTeam} Win`
              : prediction.predictedOutcome === "away_win"
              ? `${awayTeam} Win`
              : "Draw"}
          </p>
        </div>

        {/* Probability bars */}
        <div className="mb-6 space-y-3">
          <ProbabilityBar
            label={`${homeTeam} Win`}
            probability={prediction.homeWinProb}
            color="bg-gradient-to-r from-indigo-500 to-indigo-400"
            isHighest={prediction.homeWinProb === highestProb}
          />
          <ProbabilityBar
            label="Draw"
            probability={prediction.drawProb}
            color="bg-gradient-to-r from-purple-500 to-purple-400"
            isHighest={prediction.drawProb === highestProb}
          />
          <ProbabilityBar
            label={`${awayTeam} Win`}
            probability={prediction.awayWinProb}
            color="bg-gradient-to-r from-emerald-500 to-emerald-400"
            isHighest={prediction.awayWinProb === highestProb}
          />
        </div>

        {/* Confidence meter */}
        <div className={cn(
          "flex items-center justify-between border-t pt-4",
          premiumVisualsEnabled ? "border-white/10" : "border-slate-700/50"
        )}>
          <span className="text-sm text-slate-400">Model Confidence</span>
          <div className="flex items-center gap-2">
            <div className="relative h-10 w-10">
              <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-slate-700"
                />
                <motion.path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray={`${prediction.confidence * 100}, 100`}
                  className={confidenceTier.color}
                  initial={{ strokeDasharray: "0, 100" }}
                  animate={{
                    strokeDasharray: `${prediction.confidence * 100}, 100`,
                  }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <ConfidenceIcon className={cn("h-4 w-4", confidenceTier.color)} />
              </div>
            </div>
            <div className="text-right">
              <p className={cn("text-lg font-bold", confidenceTier.color)}>
                {typeof prediction.confidence === 'number' ? (prediction.confidence * 100).toFixed(0) : '0'}%
              </p>
              <p className="text-xs text-slate-500">{confidenceTier.label}</p>
            </div>
          </div>
        </div>

        {/* Edge indicator (if value bet) */}
        {prediction.edge && prediction.edge > 0.042 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className={cn(
              "mt-4 rounded-lg p-3",
              premiumVisualsEnabled
                ? "border border-green-400/20 bg-green-500/10"
                : "bg-green-500/10"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-400">Edge Detected</span>
              <span className="font-bold text-green-400">
                +{typeof prediction.edge === 'number' ? (prediction.edge * 100).toFixed(1) : '0.0'}%
              </span>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export { PredictionCardSkeleton };
