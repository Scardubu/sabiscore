/**
 * Complete Prediction Integration Component
 * 
 * Full-stack prediction flow combining:
 * - TensorFlow.js ensemble inference
 * - Kelly criterion betting optimization
 * - Multi-source odds aggregation
 * - Monte Carlo risk simulation
 * - Real-time monitoring and tracking
 * 
 * @component
 */

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { ensembleEngine, type EnsembleMatchFeatures } from '@/lib/ml/tfjs-ensemble-engine';
import { kellyOptimizer, type CalibratedPrediction, type BettingRecommendation } from '@/lib/betting/kelly-optimizer';
import { freeOddsAggregator, type AggregatedOdds } from '@/lib/betting/free-odds-aggregator';
import { freeMonitoring } from '@/lib/monitoring/free-analytics';
import { KellyStakeCard } from '@/components/betting/kelly-stake-card';
import { OddsComparison } from '@/components/betting/odds-comparison';

export interface PredictionFlowResult {
  prediction: CalibratedPrediction;
  odds: AggregatedOdds;
  recommendation: BettingRecommendation;
}

export interface PredictionFlowProps {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  features: EnsembleMatchFeatures;
  bankroll?: number;
  riskProfile?: 'conservative' | 'moderate' | 'aggressive';
  onPredictionComplete?: (result: PredictionFlowResult) => void;
}

interface FlowState {
  stage: 'loading' | 'predicting' | 'fetching-odds' | 'optimizing' | 'complete' | 'error';
  progress: number;
  prediction: CalibratedPrediction | null;
  odds: AggregatedOdds | null;
  recommendation: BettingRecommendation | null;
  error: string | null;
}

export function CompletePredictionFlow({
  matchId,
  homeTeam,
  awayTeam,
  league,
  features,
  bankroll = 10000,
  riskProfile = 'conservative',
  onPredictionComplete,
}: PredictionFlowProps) {
  const [state, setState] = useState<FlowState>({
    stage: 'loading',
    progress: 0,
    prediction: null,
    odds: null,
    recommendation: null,
    error: null,
  });

  useEffect(() => {
    runPredictionFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  async function runPredictionFlow() {
    try {
      // Stage 1: Initialize ML Engine
      setState({ stage: 'loading', progress: 10, prediction: null, odds: null, recommendation: null, error: null });
      await ensembleEngine.initialize();

      // Stage 2: Run Prediction
      setState(prev => ({ ...prev, stage: 'predicting', progress: 30 }));
      const prediction = await ensembleEngine.predict(features);

      // Stage 3: Fetch Odds
      setState(prev => ({ ...prev, stage: 'fetching-odds', progress: 50, prediction }));
      const odds = await freeOddsAggregator.getOdds(homeTeam, awayTeam, league);

      // Stage 4: Optimize Betting
      setState(prev => ({ ...prev, stage: 'optimizing', progress: 70, odds }));
      const recommendation = await kellyOptimizer.optimizeStake(
        {
          homeWin: prediction.homeWin,
          draw: prediction.draw,
          awayWin: prediction.awayWin,
          confidence: prediction.confidence,
        },
        { home: odds.home, draw: odds.draw, away: odds.away },
        bankroll,
        riskProfile
      );

      // Stage 5: Track Prediction
      await freeMonitoring.trackPrediction({
        id: `pred-${matchId}-${Date.now()}`,
        matchup: `${homeTeam} vs ${awayTeam}`,
        homeTeam,
        awayTeam,
        league,
        timestamp: Date.now(),
        prediction: {
          homeWin: prediction.homeWin,
          draw: prediction.draw,
          awayWin: prediction.awayWin,
          confidence: prediction.confidence,
        },
        odds: { home: odds.home, draw: odds.draw, away: odds.away },
        betPlaced: recommendation.recommendation === 'bet',
      });

      // Complete
      setState({
        stage: 'complete',
        progress: 100,
        prediction,
        odds,
        recommendation,
        error: null,
      });

      onPredictionComplete?.({ prediction, odds, recommendation });
    } catch (error) {
      console.error('Prediction flow failed:', error);
      setState({
        stage: 'error',
        progress: 0,
        prediction: null,
        odds: null,
        recommendation: null,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  }

  function retry() {
    runPredictionFlow();
  }

  const { stage, progress, prediction, odds, recommendation, error } = state;

  return (
    <div className="space-y-6">
      {/* Loading State */}
      <AnimatePresence mode="wait">
        {(stage === 'loading' || stage === 'predicting' || stage === 'fetching-odds' || stage === 'optimizing') && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8 shadow-lg"
          >
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-emerald-600 dark:text-emerald-400" />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                  {stage === 'loading' && 'Initializing ML Models...'}
                  {stage === 'predicting' && 'Running Ensemble Prediction...'}
                  {stage === 'fetching-odds' && 'Fetching Odds from Multiple Sources...'}
                  {stage === 'optimizing' && 'Optimizing Bet with Kelly Criterion...'}
                </h3>
                <div className="w-64 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
                  {progress}% complete
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Error State */}
        {stage === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 shadow-lg"
          >
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                  Prediction Failed
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                  {error}
                </p>
                <button
                  onClick={retry}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Complete State */}
        {stage === 'complete' && prediction && odds && recommendation && (
          <motion.div
            key="complete"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Match Header */}
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg">
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                {homeTeam} vs {awayTeam}
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {league} • Predicted with {typeof prediction.confidence === 'number' ? (prediction.confidence * 100).toFixed(1) : '0.0'}% confidence
              </p>
            </div>

            {/* Prediction Results */}
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
                Model Prediction
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <ProbabilityCard label="Home Win" value={prediction.homeWin} color="emerald" />
                <ProbabilityCard label="Draw" value={prediction.draw} color="amber" />
                <ProbabilityCard label="Away Win" value={prediction.awayWin} color="blue" />
              </div>
              <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700 text-sm text-neutral-600 dark:text-neutral-400">
                <div className="flex justify-between">
                  <span>Confidence:</span>
                  <span className="font-medium">{typeof prediction.confidence === 'number' ? (prediction.confidence * 100).toFixed(1) : '0.0'}%</span>
                </div>
                {prediction.brierScore && (
                  <div className="flex justify-between mt-1">
                    <span>Brier Score:</span>
                    <span className="font-medium">{typeof prediction.brierScore === 'number' ? prediction.brierScore.toFixed(3) : '0.000'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Odds Comparison */}
            <OddsComparison odds={odds} />

            {/* Betting Recommendation */}
            <KellyStakeCard
              recommendation={recommendation}
              monteCarlo={recommendation.monteCarlo}
              currency="NGN"
              currencySymbol="₦"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProbabilityCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
  };

  return (
    <div className={`rounded-lg p-4 ${colorClasses[color as keyof typeof colorClasses]}`}>
      <div className="text-xs font-medium uppercase mb-2">{label}</div>
      <div className="text-3xl font-bold">{typeof value === 'number' ? (value * 100).toFixed(1) : '0.0'}%</div>
    </div>
  );
}
