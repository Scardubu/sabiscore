/**
 * Complete Prediction Flow Example
 * 
 * Demonstrates full integration of ML predictions, betting optimization,
 * odds aggregation, and monitoring in a single React component.
 * 
 * Usage: Import and use in your match prediction page
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PredictionCard } from '@/components/prediction-card';
import { KellyStakeCard } from '@/components/betting/kelly-stake-card';
import { OddsComparison } from '@/components/betting/odds-comparison';
import { TFJSEnsembleEngine } from '@/lib/ml/tfjs-ensemble-engine';
import { TrainingAdapter } from '@/lib/ml/training-adapter';
import { kellyOptimizer } from '@/lib/betting/kelly-optimizer';
import { freeOddsAggregator } from '@/lib/betting/free-odds-aggregator';
import { freeMonitoring } from '@/lib/monitoring/free-analytics';
import type { ModelFeatures } from '@/lib/data/statsbomb-pipeline';
import type { PredictionOutput } from '@/lib/ml/tfjs-ensemble-engine';
import type { AggregatedOdds } from '@/lib/betting/free-odds-aggregator';
import type { BettingRecommendation, MonteCarloResult } from '@/lib/betting/kelly-optimizer';

interface CompletePredictionFlowProps {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  features: ModelFeatures; // From StatsBomb pipeline
  bankroll?: number;
  riskProfile?: 'conservative' | 'moderate' | 'aggressive';
}

export function CompletePredictionFlow({
  matchId,
  homeTeam,
  awayTeam,
  league,
  features,
  bankroll = 10000, // ₦10,000 default
  riskProfile = 'conservative',
}: CompletePredictionFlowProps) {
  const [prediction, setPrediction] = useState<PredictionOutput | null>(null);
  const [odds, setOdds] = useState<AggregatedOdds | null>(null);
  const [recommendation, setRecommendation] = useState<BettingRecommendation | null>(null);
  const [monteCarlo, setMonteCarlo] = useState<MonteCarloResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    runCompletePredictionFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);
  
  async function runCompletePredictionFlow() {
    try {
      setLoading(true);
      setError(null);
      
      // Step 1: Initialize ML engine
      const engine = new TFJSEnsembleEngine();
      await engine.initialize();

      const adapter = new TrainingAdapter();
      
      // Step 2: Adapt features to ensemble format
      const adaptedFeatures = adapter.adaptFeatures(features);
      
      // Step 3: Run prediction
      const predictionResult = await engine.predict(adaptedFeatures);
      setPrediction(predictionResult);
      
      // Step 4: Fetch aggregated odds
      const oddsResult = await freeOddsAggregator.getOdds(
        homeTeam,
        awayTeam,
        league
      );
      setOdds(oddsResult);

      const bestOdds = {
        home: oddsResult.bestHome.home,
        draw: oddsResult.bestDraw.draw,
        away: oddsResult.bestAway.away,
      };
      
      // Step 5: Optimize stake with Kelly criterion
      const kellyResult = await kellyOptimizer.optimizeStake(
        predictionResult,
        bestOdds,
        bankroll,
        riskProfile
      );
      
      // Map to full BettingRecommendation interface
      const fullRecommendation: BettingRecommendation = {
        recommendation: kellyResult.recommendation,
        stake: kellyResult.stake,
        market: kellyResult.market,
        edge: kellyResult.edge,
        expectedValue: kellyResult.expectedValue,
        kellyFraction: kellyResult.kellyFraction,
        monteCarlo: kellyResult.monteCarlo,
        reasoning: kellyResult.reasoning,
        confidenceLevel: kellyResult.confidenceLevel,
        riskLevel: kellyResult.riskLevel,
        disagreementAnalysis: kellyResult.disagreementAnalysis,
        stakeAdjustment: kellyResult.stakeAdjustment,
      };
      setRecommendation(fullRecommendation);
      
      // Step 6: Set Monte Carlo result from Kelly optimizer
      if (kellyResult.monteCarlo) {
        setMonteCarlo(kellyResult.monteCarlo);
      }
      
      // Step 7: Track prediction for monitoring
      await freeMonitoring.trackPrediction({
        id: `pred-${matchId}`,
        matchup: `${homeTeam} vs ${awayTeam}`,
        homeTeam,
        awayTeam,
        league,
        timestamp: Date.now(),
        prediction: {
          homeWin: predictionResult.homeWin,
          draw: predictionResult.draw,
          awayWin: predictionResult.awayWin,
          confidence: predictionResult.confidence,
        },
        odds: bestOdds,
        betPlaced: kellyResult.recommendation === 'bet',
      });
      
    } catch (err) {
      console.error('Prediction flow failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }
  
  function getPredictedOutcome(prediction: PredictionOutput): 'home' | 'draw' | 'away' {
    const max = Math.max(prediction.homeWin, prediction.draw, prediction.awayWin);
    if (max === prediction.homeWin) return 'home';
    if (max === prediction.draw) return 'draw';
    return 'away';
  }
  
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 h-64" />
        <div className="animate-pulse rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 h-48" />
        <div className="animate-pulse rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 h-48" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
        <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
          Prediction Failed
        </h3>
        <p className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
        <button
          onClick={runCompletePredictionFlow}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
        >
          Retry
        </button>
      </div>
    );
  }
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Match Header */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
          {homeTeam} vs {awayTeam}
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {league}
        </p>
      </div>
      
      {/* Prediction Card */}
      {prediction && (
        <PredictionCard
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          league={league}
          prediction={{
            homeWinProb: prediction.homeWin,
            drawProb: prediction.draw,
            awayWinProb: prediction.awayWin,
            confidence: prediction.confidence,
            predictedOutcome: getPredictedOutcome(prediction),
            edge: recommendation?.edge,
          }}
        />
      )}
      
      {/* Odds Comparison */}
      {odds && (
        <OddsComparison odds={odds} />
      )}
      
      {/* Kelly Stake Recommendation */}
      {recommendation && monteCarlo && (
        <KellyStakeCard
          recommendation={recommendation}
          monteCarlo={monteCarlo}
          currency="NGN"
          currencySymbol="₦"
        />
      )}
      
      {/* Additional Info */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
          How It Works
        </h3>
        <ul className="space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
          <li className="flex items-start gap-2">
            <span className="text-emerald-600 dark:text-emerald-400">1.</span>
            <span>
              <strong>ML Prediction:</strong> 3-model ensemble (Dense NN, LSTM, CNN) 
              with isotonic calibration predicts match outcome probabilities
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-600 dark:text-emerald-400">2.</span>
            <span>
              <strong>Odds Aggregation:</strong> Best odds selected from 3 free sources 
              (odds-api, football-data, oddsportal) with reliability weighting
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-600 dark:text-emerald-400">3.</span>
            <span>
              <strong>Kelly Optimization:</strong> Optimal stake calculated using Kelly 
              criterion with fractional sizing ({riskProfile} profile: {
                riskProfile === 'conservative' ? '1/8' :
                riskProfile === 'moderate' ? '1/4' : '1/2'
              } Kelly)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-600 dark:text-emerald-400">4.</span>
            <span>
              <strong>Monte Carlo:</strong> 10,000 simulations quantify risk with 
              percentiles, Sharpe ratio, and ruin probability
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-600 dark:text-emerald-400">5.</span>
            <span>
              <strong>Monitoring:</strong> Prediction tracked for accuracy analysis, 
              drift detection, and ROI measurement
            </span>
          </li>
        </ul>
      </div>
      
      {/* Disclaimer */}
      <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-6">
        <p className="text-xs text-yellow-700 dark:text-yellow-300">
          <strong>⚠️ Disclaimer:</strong> All predictions are for educational and 
          entertainment purposes only. Past performance does not guarantee future results. 
          Only bet what you can afford to lose. Gambling can be addictive - seek help if needed.
        </p>
      </div>
    </motion.div>
  );
}

/**
 * Example usage in a Next.js page:
 * 
 * ```tsx
 * 'use client';
 * 
 * import { CompletePredictionFlow } from '@/components/examples/complete-prediction-flow';
 * import { StatsBombPipeline } from '@/lib/data/statsbomb-pipeline';
 * 
 * export default function MatchPredictionPage({ params }: { params: { matchId: string } }) {
 *   const [features, setFeatures] = useState(null);
 *   
 *   useEffect(() => {
 *     async function loadFeatures() {
 *       const pipeline = new StatsBombPipeline();
 *       const matchFeatures = await pipeline.extractMatchFeatures(params.matchId);
 *       setFeatures(matchFeatures);
 *     }
 *     loadFeatures();
 *   }, [params.matchId]);
 *   
 *   if (!features) return <LoadingSpinner />;
 *   
 *   return (
 *     <CompletePredictionFlow
 *       matchId={params.matchId}
 *       homeTeam="Arsenal"
 *       awayTeam="Chelsea"
 *       league="Premier League"
 *       features={features}
 *       bankroll={10000}
 *       riskProfile="moderate"
 *     />
 *   );
 * }
 * ```
 */
