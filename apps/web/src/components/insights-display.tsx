"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { InsightsResponse } from "@/lib/api";
import type { ChartOptions } from "@/types/chart";
import { DoughnutChart } from "./charts/DoughnutChart";
import { apiClient } from "@/lib/api";
import { safeErrorMessage } from "@/lib/error-utils";
import { ValueBetCard } from "./ValueBetCard";

interface InsightsDisplayProps {
  insights: InsightsResponse;
}

export function InsightsDisplay({ insights }: InsightsDisplayProps) {
  // Use local state to allow client-side refetch/refresh without navigating
  const [current, setCurrent] = useState<InsightsResponse>(insights);
  const { predictions, xg_analysis, value_analysis, risk_assessment } = current;

  const [refreshing, setRefreshing] = useState(false);
  const [isClient, setIsClient] = useState(false);

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

  const chartData = {
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
  };

  const chartOptions: ChartOptions<"doughnut"> = {
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
  };

  const bestBet = value_analysis.best_bet;

  return (
    <div className="space-y-8">
      {/* Match Header */}
      <div className="glass-card p-8 text-center space-y-4">
        <h1 className="text-4xl font-bold text-slate-100">{insights.matchup}</h1>
        <p className="text-slate-400 text-lg">{insights.league}</p>
        
        <div className="flex items-center justify-center gap-6 pt-4">
          <div>
            <button
              onClick={handleRefetch}
              disabled={refreshing}
              className="mr-2 rounded-md border border-slate-700/50 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/70"
            >
              {refreshing ? "Refreshing…" : "Refresh insights"}
            </button>
          </div>
          <div className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
            <p className="text-sm text-slate-400">Prediction</p>
            <p className="text-2xl font-bold text-indigo-400 capitalize">
              {predictions.prediction.replace(/_/g, " ")}
            </p>
          </div>
          
          <div className="px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <p className="text-sm text-slate-400">Confidence</p>
            <p className="text-2xl font-bold text-purple-400">
              {(predictions.confidence * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Probability Chart */}
        <div className="glass-card p-8 space-y-6">
          <h2 className="text-2xl font-bold text-slate-100">Match Probabilities</h2>
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
        <div className="glass-card p-8 space-y-6">
          <h2 className="text-2xl font-bold text-slate-100">Expected Goals (xG)</h2>
          
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
        <div className="glass-card p-8 space-y-6 border-2 border-green-500/20">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-100">
              💰 Best Value Bet
            </h2>
            <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-sm font-semibold text-green-400">
              {bestBet.quality.tier}
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
              bet={{
                bet_type: bestBet.bet_type ?? 'unknown',
                market_odds: bestBet.market_odds ?? 1.0,
                model_prob: bestBet.model_prob ?? 0,
                market_prob: bestBet.market_prob ?? 0,
                expected_value: bestBet.expected_value ?? bestBet.edge ?? 0,
                value_pct: bestBet.value_pct ?? bestBet.edge ?? 0,
                kelly_stake: bestBet.kelly_stake ?? 0,
                confidence_interval: bestBet.confidence_interval ?? [0, 0],
                edge: bestBet.edge ?? bestBet.expected_value ?? 0,
                recommendation: bestBet.recommendation ?? 'Monitor closely',
                quality: bestBet.quality ?? {
                  quality_score: 0,
                  tier: 'VALUE',
                  recommendation: 'Monitor closely',
                  ev_contribution: 0,
                  confidence_contribution: 0,
                  liquidity_contribution: 0,
                },
              }}
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
    </div>
  );
}
