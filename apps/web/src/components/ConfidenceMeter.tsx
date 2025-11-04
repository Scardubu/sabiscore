"use client";

import React, { useEffect, useRef } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend);

interface PredictionMetrics {
  home_win_probability: number;
  draw_probability: number;
  away_win_probability: number;
  confidence_score: number;
  brier_score?: number;
  calibration_status?: 'excellent' | 'good' | 'fair' | 'poor';
  model_version?: string;
}

interface ConfidenceMeterProps {
  metrics: PredictionMetrics;
  home_team: string;
  away_team: string;
}

/**
 * ConfidenceMeter Component
 * 
 * Doughnut chart visualization with:
 * - Probability distribution (Home/Draw/Away)
 * - Confidence score overlay
 * - Brier score calibration indicator
 * - Model performance badge
 * - Real-time updates from WebSocket
 */
export function ConfidenceMeter({ 
  metrics, 
  home_team, 
  away_team 
}: ConfidenceMeterProps) {
  const chartRef = useRef<ChartJS<'doughnut'>>(null);

  // Prepare chart data
  const chartData = {
    labels: [
      `${home_team} Win`,
      'Draw',
      `${away_team} Win`,
    ],
    datasets: [
      {
        data: [
          metrics.home_win_probability * 100,
          metrics.draw_probability * 100,
          metrics.away_win_probability * 100,
        ],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',  // Green for home
          'rgba(234, 179, 8, 0.8)',   // Yellow for draw
          'rgba(239, 68, 68, 0.8)',   // Red for away
        ],
        borderColor: [
          'rgba(34, 197, 94, 1)',
          'rgba(234, 179, 8, 1)',
          'rgba(239, 68, 68, 1)',
        ],
        borderWidth: 2,
        hoverOffset: 8,
      },
    ],
  };

  const chartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: '70%',
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#fff',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(148, 163, 184, 0.3)',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.parsed || 0;
            return `${label}: ${value.toFixed(1)}%`;
          },
        },
      },
    },
    animation: {
      animateRotate: true,
      animateScale: true,
      duration: 800,
    },
  };

  const getCalibrationColor = (status?: string) => {
    switch (status) {
      case 'excellent':
        return 'text-green-400';
      case 'good':
        return 'text-blue-400';
      case 'fair':
        return 'text-yellow-400';
      case 'poor':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  const getCalibrationIcon = (status?: string) => {
    switch (status) {
      case 'excellent':
      case 'good':
        return <TrendingUp className="h-4 w-4" />;
      case 'poor':
        return <TrendingDown className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  // Determine most likely outcome
  const probabilities = [
    { outcome: 'home', value: metrics.home_win_probability, label: home_team },
    { outcome: 'draw', value: metrics.draw_probability, label: 'Draw' },
    { outcome: 'away', value: metrics.away_win_probability, label: away_team },
  ];
  const mostLikely = probabilities.reduce((max, p) => 
    p.value > max.value ? p : max
  );

  return (
    <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6 backdrop-blur-sm">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Model Confidence</h3>
        {metrics.model_version && (
          <span className="rounded-full bg-slate-700/50 px-3 py-1 text-xs text-slate-400">
            v{metrics.model_version}
          </span>
        )}
      </div>

      {/* Chart with Center Label */}
      <div className="relative mb-6">
        <div className="mx-auto max-w-xs">
          <Doughnut ref={chartRef} data={chartData} options={chartOptions} />
        </div>
        
        {/* Center Label - Confidence Score */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl font-bold text-white">
              {(metrics.confidence_score * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-slate-400">Confidence</div>
          </div>
        </div>
      </div>

      {/* Probability Breakdown */}
      <div className="mb-4 space-y-3">
        {probabilities.map((prob, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div 
                className="h-3 w-3 rounded-full"
                style={{ 
                  backgroundColor: chartData.datasets[0].backgroundColor[index] 
                }}
              />
              <span className="text-sm text-slate-300">{prob.label}</span>
            </div>
            <span className={`text-sm font-semibold ${
              prob.outcome === mostLikely.outcome 
                ? 'text-white' 
                : 'text-slate-400'
            }`}>
              {(prob.value * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      {/* Brier Score & Calibration */}
      {metrics.brier_score !== undefined && (
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">
              Calibration Quality
            </span>
            <div className={`flex items-center gap-1 text-xs ${getCalibrationColor(metrics.calibration_status)}`}>
              {getCalibrationIcon(metrics.calibration_status)}
              <span className="capitalize">
                {metrics.calibration_status || 'Unknown'}
              </span>
            </div>
          </div>
          
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {metrics.brier_score.toFixed(3)}
            </span>
            <span className="text-xs text-slate-400">Brier Score</span>
          </div>
          
          <p className="mt-2 text-xs text-slate-500">
            Lower is better. Score &lt; 0.15 indicates excellent calibration.
          </p>

          {/* Calibration Progress Bar */}
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full transition-all duration-500 ${
                metrics.brier_score < 0.15 
                  ? 'bg-green-500' 
                  : metrics.brier_score < 0.20 
                  ? 'bg-blue-500' 
                  : metrics.brier_score < 0.25 
                  ? 'bg-yellow-500' 
                  : 'bg-red-500'
              }`}
              style={{ 
                width: `${Math.max(5, Math.min(100, (1 - metrics.brier_score) * 100))}%` 
              }}
            />
          </div>
        </div>
      )}

      {/* Most Likely Outcome */}
      <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 rounded-full bg-green-500/20 p-2">
            <TrendingUp className="h-4 w-4 text-green-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-green-400">Most Likely</p>
            <p className="text-sm font-bold text-white">
              {mostLikely.label} ({(mostLikely.value * 100).toFixed(1)}%)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
