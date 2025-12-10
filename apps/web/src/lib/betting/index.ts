/**
 * Betting Module Exports
 * 
 * @module lib/betting
 */

// Kelly Optimizer
export {
  KellyOptimizer,
  kellyOptimizer,
  
  type Odds,
  type CalibratedPrediction,
  type MonteCarloResult,
  type BettingRecommendation,
  type RiskProfile,
} from './kelly-optimizer';

// Odds Aggregator
export {
  FreeOddsAggregator,
  freeOddsAggregator,
  
  type OddsSource,
  type AggregatedOdds,
  type OddsMovement,
  type CLVMetrics,
} from './free-odds-aggregator';
