"use client";

import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
} from "chart.js";
import type { InsightsResponse } from "@/lib/api";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale);

interface InsightsDisplayProps {
  insights: InsightsResponse;
}

export function InsightsDisplay({ insights }: InsightsDisplayProps) {
  const { predictions, xg_analysis, value_analysis, risk_assessment, monte_carlo } = insights;

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

  const chartOptions = {
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
          label: (context: any) => {
            const label = context.label || "";
            const value = ((context.parsed || 0) * 100).toFixed(1);
            return `${label}: ${value}%`;
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
            <Doughnut data={chartData} options={chartOptions} />
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
                style={{ width: `${risk_assessment.confidence_score * 100}%` }}
              ></div>
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
