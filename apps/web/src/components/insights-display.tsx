"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { InsightsResponse } from "@/lib/api";
import type { ChartOptions } from "@/types/chart";
import { normalizeValueBet } from "@/types/value-bet";
import { DoughnutChart } from "./charts/DoughnutChart";
import { apiClient } from "@/lib/api";
import { safeErrorMessage } from "@/lib/error-utils";
import { ValueBetCard } from "./ValueBetCard";
import { GamblingDisclaimer } from "./ui/ResponsibleGamblingTooltip";
import { TeamVsDisplay } from "./team-display";
import {
  hashMatchup,
  loadStoredPoll,
  loadSwipeChoices,
  INTERSTITIAL_SWIPE_QUESTIONS,
  type InterstitialPollState,
  type InterstitialSwipeChoices,
} from "@/lib/interstitial-storage";
import { FeatureFlag, useFeatureFlag } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

interface InsightsDisplayProps {
  insights: InsightsResponse;
}

export function InsightsDisplay({ insights }: InsightsDisplayProps) {
  // Use local state to allow client-side refetch/refresh without navigating
  const [current, setCurrent] = useState<InsightsResponse>(insights);
  const { predictions, xg_analysis, value_analysis, risk_assessment } = current;

  const [refreshing, setRefreshing] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const premiumVisualsEnabled = useFeatureFlag(FeatureFlag.PREMIUM_VISUAL_HIERARCHY);
  const [fanPulse, setFanPulse] = useState<{
    poll?: InterstitialPollState;
    swipes?: InterstitialSwipeChoices | null;
  } | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Use React Query for caching/deduping/refetch behavior - client-only
  const { data, refetch } = useQuery<InsightsResponse>({
    queryKey: ["insights", insights.matchup, insights.league],
    queryFn: () => apiClient.generateInsights(insights.matchup, insights.league),
    initialData: insights,
    staleTime: 60 * 1000,
    retry: 2,
    enabled: isClient, // Only run after client hydration
  });

  useEffect(() => {
    if (data) setCurrent(data);
  }, [data]);

  useEffect(() => {
    const homeTeam = current.metadata?.home_team;
    const awayTeam = current.metadata?.away_team;
    if (!homeTeam || !awayTeam) {
      setFanPulse(null);
      return;
    }

    const matchupKey = hashMatchup(homeTeam, awayTeam);
    const poll = loadStoredPoll(matchupKey) ?? undefined;
    const swipes = loadSwipeChoices(matchupKey) ?? undefined;
    if (poll || swipes) {
      setFanPulse({ poll, swipes });
    } else {
      setFanPulse(null);
    }
  }, [current.metadata?.home_team, current.metadata?.away_team]);

  const handleRefetch = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await refetch();
      // Safely check res.data exists before using it
      if (res.data && typeof res.data === 'object') {
        setCurrent(res.data as InsightsResponse);
        toast.success("Insights refreshed");
      } else if (res.error) {
        throw res.error;
      }
    } catch (err) {
      const message = safeErrorMessage(err);
      toast.error(`Failed to refresh: ${message}`);
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // Apply widths for any elements that use `data-width` to avoid inline styles.
  // This reads the numeric percent from the attribute and sets the element's
  // style.width accordingly so CSS transition (defined in globals.css) animates it.
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-width]'));
    els.forEach((el) => {
      const v = el.getAttribute("data-width");
      const num = Number(v);
      if (!Number.isFinite(num)) return;
      // clamp 0..100
      const pct = Math.max(0, Math.min(100, num));
      el.style.width = `${pct}%`;
    });
    // No cleanup required; width will be overwritten on subsequent updates.
  }, [current]);

  // Memoize chart data to prevent unnecessary re-renders
  const chartData = useMemo(() => ({
    labels: ["Home Win", "Draw", "Away Win"],
    datasets: [
      {
        data: [
          predictions.home_win_prob,
          predictions.draw_prob,
          predictions.away_win_prob,
        ],
        backgroundColor: [
          "rgba(99, 102, 241, 0.8)",
          "rgba(139, 92, 246, 0.8)",
          "rgba(34, 197, 94, 0.8)",
        ],
        borderColor: [
          "rgba(99, 102, 241, 1)",
          "rgba(139, 92, 246, 1)",
          "rgba(34, 197, 94, 1)",
        ],
        borderWidth: 2,
      },
    ],
  }), [predictions.home_win_prob, predictions.draw_prob, predictions.away_win_prob]);

  // Memoize chart options - these are static and don't need to change
  const chartOptions: ChartOptions<"doughnut"> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: "rgba(226, 232, 240, 0.8)",
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (context: { label?: string; parsed?: number | number[] }) => {
            const label = context.label || "";
            const parsed = context.parsed ?? 0;
            const value = (Array.isArray(parsed) ? parsed[0] : parsed) as number;
            return `${label}: ${(value * 100).toFixed(1)}%`;
          },
        },
      },
    },
  }), []);

  // Memoize normalized best bet to prevent recalculation on each render
  const bestBet = useMemo(() => 
    value_analysis.best_bet ? normalizeValueBet(value_analysis.best_bet) : null,
    [value_analysis.best_bet]
  );

  // Memoize outcome key helper
  const modelOutcomeKey = useCallback((value: string | undefined | null) => {
    if (!value) return null;
    if (value.startsWith("home")) return "home";
    if (value.startsWith("away")) return "away";
    if (value.includes("draw")) return "draw";
    return null;
  }, []);

  // Memoize poll calculations for performance
  const pollData = useMemo(() => {
    const totals = fanPulse?.poll
      ? Object.values(fanPulse.poll.votes ?? {}).reduce((acc, vote) => acc + vote, 0)
      : 0;
    const choiceKey = fanPulse?.poll?.choice ?? null;
    const votes = fanPulse?.poll?.votes ?? null;
    const share = choiceKey && totals > 0 && votes
      ? (votes[choiceKey] ?? 0) / totals
      : null;
    const teamLabel = choiceKey === "home"
      ? current.metadata.home_team
      : choiceKey === "away"
      ? current.metadata.away_team
      : choiceKey === "draw"
      ? "Draw"
      : null;
    const recordedAt = fanPulse?.poll?.timestamp
      ? new Date(fanPulse.poll.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : null;
    return { totals, choiceKey, votes, share, teamLabel, recordedAt };
  }, [fanPulse?.poll, current.metadata.home_team, current.metadata.away_team]);

  const { choiceKey: pollChoiceKey, share: pollShare, teamLabel: pollTeamLabel, recordedAt: pollRecordedAt } = pollData;
  // Memoize model alignment check
  const modelAlignment = useMemo(() => {
    const modelKey = modelOutcomeKey(predictions?.prediction);
    if (!modelKey || !pollChoiceKey) return null;
    return modelKey === pollChoiceKey;
  }, [modelOutcomeKey, predictions?.prediction, pollChoiceKey]);

  const swipeSummaries = useMemo(() => {
    if (!fanPulse?.swipes) return [] as Array<{ id: string; question: string; answer: string }>;
    return INTERSTITIAL_SWIPE_QUESTIONS.map((q) => {
      const direction = fanPulse.swipes?.[q.id];
      if (!direction) return null;
      const answer = direction === "left" ? q.left : direction === "right" ? q.right : ("center" in q ? q.center : "Draw");
      return { id: q.id, question: q.question, answer };
    }).filter(Boolean) as Array<{ id: string; question: string; answer: string }>;
  }, [fanPulse?.swipes]);

  const hasFanPulse = Boolean((fanPulse?.poll && pollTeamLabel) || swipeSummaries.length);

  return (
    <div className="space-y-8">
      {/* Match Header */}
      <div className={cn(
        "glass-card relative overflow-hidden p-8 text-center space-y-4",
        premiumVisualsEnabled && "border-white/10 bg-slate-950/70 shadow-[0_15px_45px_rgba(8,14,35,0.55)]"
      )}>
        {premiumVisualsEnabled && (
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(circle at top, rgba(0,212,255,0.2), transparent 50%), radial-gradient(circle at 20% 80%, rgba(123,47,247,0.12), transparent 40%)",
            }}
            aria-hidden="true"
          />
        )}
        <div className="relative">
          <div className="flex flex-col items-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {premiumVisualsEnabled && (
                <span className="rounded-full border border-white/10 bg-slate-900/60 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-300">
                  Premium insights
                </span>
              )}
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                Live data
              </span>
            </div>
            <TeamVsDisplay 
              homeTeam={insights.metadata.home_team}
              awayTeam={insights.metadata.away_team}
              league={insights.league}
              size="xl"
              showCountryFlags={false}
            />
          </div>
        </div>
        
        <div className="relative flex items-center justify-center gap-6 pt-4">
          <div>
            <button
              onClick={handleRefetch}
              disabled={refreshing}
              className={cn(
                "mr-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all",
                premiumVisualsEnabled
                  ? "border-white/10 bg-slate-900/60 text-slate-200 hover:border-cyan-400/30 hover:bg-cyan-400/10 disabled:opacity-50"
                  : "border-slate-700/50 bg-slate-800/60 text-slate-200 hover:bg-slate-800/70 disabled:opacity-50"
              )}
            >
              {refreshing ? (
                <span className="flex items-center gap-2">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-400/30 border-t-slate-200"></div>
                  Refreshing…
                </span>
              ) : (
                "Refresh insights"
              )}
            </button>
          </div>
          <div className={cn(
            "px-4 py-2 rounded-xl border",
            premiumVisualsEnabled
              ? "bg-cyan-500/10 border-cyan-500/20"
              : "bg-indigo-500/10 border-indigo-500/20"
          )}>
            <p className="text-sm text-slate-400">Prediction</p>
            <p className={cn(
              "text-2xl font-bold capitalize",
              premiumVisualsEnabled ? "text-cyan-400" : "text-indigo-400"
            )}>
              {predictions.prediction.replace(/_/g, " ")}
            </p>
          </div>
          
          <div className="px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-xl">
            <p className="text-sm text-slate-400">Confidence</p>
            <p className="text-2xl font-bold text-purple-400">
              {(predictions.confidence * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        {hasFanPulse && (
          <div className="mt-6 rounded-xl border border-slate-800/60 bg-slate-900/40 p-4 text-left">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-500">
              <span>Saved Fan Pulse</span>
              {pollRecordedAt && <span>Last vote · {pollRecordedAt}</span>}
            </div>

            {fanPulse?.poll && pollTeamLabel && (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <div>
                  <p className="text-slate-400">You picked</p>
                  <p className="text-base font-semibold text-slate-100">{pollTeamLabel}</p>
                </div>
                {pollShare !== null && (
                  <div className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-300">
                    {Math.round(pollShare * 100)}% of quick poll
                  </div>
                )}
                {typeof modelAlignment === "boolean" && (
                  <div
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      modelAlignment
                        ? "border-green-500/40 bg-green-500/10 text-green-300"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    }`}
                  >
                    {modelAlignment ? "Model agrees" : "Model sees another edge"}
                  </div>
                )}
              </div>
            )}

            {swipeSummaries.length > 0 && (
              <div className="mt-4 grid gap-2 text-xs text-slate-400">
                {swipeSummaries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between rounded-lg border border-slate-800/70 bg-slate-900/50 px-3 py-2">
                    <span className="pr-4 text-slate-500">{entry.question}</span>
                    <span className="font-semibold text-slate-100">{entry.answer}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Probability Chart */}
        <div className={cn(
          "glass-card p-8 space-y-6",
          premiumVisualsEnabled && "border-white/10 bg-slate-950/70 shadow-[0_15px_45px_rgba(8,14,35,0.55)]"
        )}>
          <h2 className={cn(
            "text-2xl font-bold",
            premiumVisualsEnabled ? "text-cyan-400" : "text-slate-100"
          )}>Match Probabilities</h2>
          <div className="h-80">
            <DoughnutChart data={chartData} options={chartOptions} />
          </div>
          
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-800/50">
            <div className="text-center">
              <p className="text-sm text-slate-400 mb-1">Home Win</p>
              <p className="text-2xl font-bold text-indigo-400">
                {(predictions.home_win_prob * 100).toFixed(1)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-400 mb-1">Draw</p>
              <p className="text-2xl font-bold text-purple-400">
                {(predictions.draw_prob * 100).toFixed(1)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-400 mb-1">Away Win</p>
              <p className="text-2xl font-bold text-green-400">
                {(predictions.away_win_prob * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Expected Goals */}
        <div className={cn(
          "glass-card p-8 space-y-6",
          premiumVisualsEnabled && "border-white/10 bg-slate-950/70 shadow-[0_15px_45px_rgba(8,14,35,0.55)]"
        )}>
          <h2 className={cn(
            "text-2xl font-bold",
            premiumVisualsEnabled ? "text-cyan-400" : "text-slate-100"
          )}>Expected Goals (xG)</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
              <span className="text-slate-300 font-medium">
                {insights.metadata.home_team}
              </span>
              <span className="text-3xl font-bold text-indigo-400">
                {xg_analysis.home_xg.toFixed(2)}
              </span>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
              <span className="text-slate-300 font-medium">
                {insights.metadata.away_team}
              </span>
              <span className="text-3xl font-bold text-green-400">
                {xg_analysis.away_xg.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800/50">
            <div className="text-center">
              <p className="text-sm text-slate-400 mb-1">Total xG</p>
              <p className="text-xl font-bold text-slate-100">
                {xg_analysis.total_xg.toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-400 mb-1">xG Difference</p>
              <p className="text-xl font-bold text-purple-400">
                {Math.abs(xg_analysis.xg_difference).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Value Bets */}
      {bestBet && (
        <div className={cn(
          "glass-card p-8 space-y-6 border-2",
          premiumVisualsEnabled
            ? "border-emerald-500/30 bg-slate-950/70 shadow-[0_15px_45px_rgba(16,185,129,0.25)]"
            : "border-green-500/20"
        )}>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-100">
              💰 Best Value Bet
            </h2>
            <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-sm font-semibold text-green-400">
              {bestBet.quality?.tier ?? 'VALUE'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <p className="text-sm text-slate-400">Market</p>
              <p className="text-xl font-bold text-slate-100 capitalize">
                {bestBet.bet_type.replace(/_/g, " ")}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-slate-400">Expected Value</p>
              <p className="text-2xl font-bold text-green-400">
                +{(bestBet.expected_value * 100).toFixed(1)}%
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-slate-400">Kelly Stake (⅛)</p>
              <p className="text-2xl font-bold text-indigo-400">
                {(bestBet.kelly_stake * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Market Odds</span>
              <span className="text-slate-100 font-semibold">
                {bestBet.market_odds.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Model Probability</span>
              <span className="text-slate-100 font-semibold">
                {(bestBet.model_prob * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Edge</span>
              <span className="text-green-400 font-semibold">
                +{(bestBet.edge * 100).toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
            <p className="text-sm text-indigo-300 font-medium">
              {bestBet.recommendation}
            </p>
          </div>

          {/* Also render a ValueBetCard component (maps server value to UI model) */}
          <div className="mt-4">
            <ValueBetCard
              bet={bestBet}
              context={{
                matchId: current.matchup ?? insights.matchup,
                homeTeam: insights.metadata?.home_team ?? 'Home',
                awayTeam: insights.metadata?.away_team ?? 'Away',
                bookmaker: 'Preferred Book',
                clvExpected: bestBet.quality?.ev_contribution ?? null,
              }}
            />
          </div>
        </div>
      )}

      {/* Risk Assessment */}
      <div className="glass-card p-8 space-y-6">
        <h2 className="text-2xl font-bold text-slate-100">Risk Assessment</h2>
        
        <div className="flex items-center gap-4">
          <div className={`px-4 py-2 rounded-lg font-semibold ${
            risk_assessment.risk_level === "low"
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : risk_assessment.risk_level === "medium"
              ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}>
            {risk_assessment.risk_level.toUpperCase()} RISK
          </div>
          
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Confidence Score</span>
              <span className="text-sm font-bold text-slate-100">
                {(risk_assessment.confidence_score * 100).toFixed(0)}%
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                data-width={`${risk_assessment.confidence_score * 100}`}
              />
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-800/50 rounded-lg">
          <p className="text-slate-300 leading-relaxed">
            {risk_assessment.recommendation}
          </p>
        </div>
      </div>

      {/* AI Narrative */}
      <div className="glass-card p-8 space-y-4">
        <h2 className="text-2xl font-bold text-slate-100">AI Analysis</h2>
        <p className="text-slate-300 leading-relaxed">{insights.narrative}</p>
        
        <div className="pt-4 border-t border-slate-800/50 text-xs text-slate-500">
          Generated at {new Date(insights.generated_at).toLocaleString()}
        </div>
      </div>

      {/* Responsible Gambling Disclaimer */}
      <GamblingDisclaimer />
    </div>
  );
}
