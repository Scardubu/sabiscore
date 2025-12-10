/**
 * Kelly Criterion Optimizer with Monte Carlo Simulation
 * 
 * Implements fractional Kelly staking with risk management for value betting.
 * Includes Monte Carlo simulation for risk assessment and CLV tracking.
 * 
 * @module lib/betting/kelly-optimizer
 */

export interface Odds {
  home: number;
  draw: number;
  away: number;
  bookmaker?: string;
  timestamp?: number;
}

export interface CalibratedPrediction {
  homeWin: number;
  draw: number;
  awayWin: number;
  confidence: number;
  brierScore?: number;
}

export interface MonteCarloResult {
  meanReturn: number;
  winRate: number;
  ruinProbability: number;
  p5: number;
  p50: number;
  p95: number;
  paths: number[];
  volatility: number;
  sharpeRatio: number;
}

export interface BettingRecommendation {
  recommendation: 'bet' | 'skip';
  stake: number;
  market: 'home' | 'draw' | 'away';
  edge: number;
  expectedValue: number;
  kellyFraction: number;
  monteCarlo: MonteCarloResult;
  reasoning: string;
  confidenceLevel: 'high' | 'medium' | 'low';
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
}

export type RiskProfile = 'conservative' | 'moderate' | 'aggressive';

// ============================================================================
// Kelly Optimizer
// ============================================================================

export class KellyOptimizer {
  private readonly MIN_EDGE = 0.02; // 2% minimum edge
  private readonly MAX_STAKE_PERCENT = 0.05; // Never stake more than 5% of bankroll
  private readonly MIN_CONFIDENCE = 0.60; // Minimum confidence to bet
  
  /**
   * Calculate optimal stake using Kelly Criterion
   */
  async optimizeStake(
    prediction: CalibratedPrediction,
    odds: Odds,
    bankroll: number,
    riskProfile: RiskProfile = 'moderate'
  ): Promise<BettingRecommendation> {
    
    // Find best market (highest edge)
    const markets = [
      { name: 'home' as const, prob: prediction.homeWin, odds: odds.home },
      { name: 'draw' as const, prob: prediction.draw, odds: odds.draw },
      { name: 'away' as const, prob: prediction.awayWin, odds: odds.away },
    ];
    
    let bestMarket = markets[0];
    let bestEdge = this.calculateEdge(bestMarket.prob, bestMarket.odds);
    
    for (const market of markets) {
      const edge = this.calculateEdge(market.prob, market.odds);
      if (edge > bestEdge) {
        bestEdge = edge;
        bestMarket = market;
      }
    }
    
    // Check minimum requirements
    if (bestEdge < this.MIN_EDGE) {
      return {
        recommendation: 'skip',
        stake: 0,
        market: bestMarket.name,
        edge: bestEdge * 100,
        expectedValue: 0,
        kellyFraction: 0,
        monteCarlo: this.getEmptyMonteCarloResult(),
        reasoning: `Insufficient edge (${(bestEdge * 100).toFixed(2)}% < ${this.MIN_EDGE * 100}% minimum)`,
        confidenceLevel: 'low',
        riskLevel: riskProfile,
      };
    }
    
    if (prediction.confidence < this.MIN_CONFIDENCE) {
      return {
        recommendation: 'skip',
        stake: 0,
        market: bestMarket.name,
        edge: bestEdge * 100,
        expectedValue: 0,
        kellyFraction: 0,
        monteCarlo: this.getEmptyMonteCarloResult(),
        reasoning: `Low model confidence (${(prediction.confidence * 100).toFixed(1)}%)`,
        confidenceLevel: 'low',
        riskLevel: riskProfile,
      };
    }
    
    // Calculate Full Kelly
    const q = 1 - bestMarket.prob;
    const b = bestMarket.odds - 1;
    const fullKelly = (bestMarket.prob * b - q) / b;
    
    // Apply fractional Kelly based on risk profile
    const fractions: Record<RiskProfile, number> = {
      conservative: 0.125,  // 1/8 Kelly
      moderate: 0.25,       // 1/4 Kelly
      aggressive: 0.5,      // 1/2 Kelly
    };
    
    const kellyFraction = fractions[riskProfile];
    const adjustedKelly = Math.max(0, fullKelly * kellyFraction);
    
    // Position sizing with safety caps
    const stake = Math.min(
      adjustedKelly * bankroll,
      bankroll * this.MAX_STAKE_PERCENT,
      bankroll * 0.1 // Absolute max 10%
    );
    
    // Run Monte Carlo simulation
    const monteCarlo = await this.runMonteCarlo(
      bestMarket.prob,
      bestMarket.odds,
      stake,
      10000 // 10k simulations
    );
    
    // Calculate expected value
    const ev = stake * (bestMarket.prob * (bestMarket.odds - 1) - (1 - bestMarket.prob));
    
    // Determine confidence level
    const confidenceLevel = this.getConfidenceLevel(
      prediction.confidence,
      bestEdge,
      monteCarlo.ruinProbability
    );
    
    // Generate reasoning
    const reasoning = this.generateReasoning(
      bestMarket.name,
      bestEdge,
      ev,
      monteCarlo,
      prediction.confidence
    );
    
    return {
      recommendation: stake > 0 ? 'bet' : 'skip',
      stake: Math.round(stake * 100) / 100,
      market: bestMarket.name,
      edge: bestEdge * 100,
      expectedValue: ev,
      kellyFraction: adjustedKelly,
      monteCarlo,
      reasoning,
      confidenceLevel,
      riskLevel: riskProfile,
    };
  }
  
  /**
   * Calculate edge (model probability vs implied probability)
   */
  private calculateEdge(modelProb: number, odds: number): number {
    const impliedProb = 1 / odds;
    return modelProb - impliedProb;
  }
  
  /**
   * Run Monte Carlo simulation
   */
  private async runMonteCarlo(
    winProb: number,
    odds: number,
    stake: number,
    iterations: number
  ): Promise<MonteCarloResult> {
    const outcomes: number[] = [];
    let wins = 0;
    let ruinCount = 0;
    const ruinThreshold = -stake * 10; // Ruin = 10x stake loss
    
    for (let i = 0; i < iterations; i++) {
      const random = Math.random();
      let outcome: number;
      
      if (random < winProb) {
        outcome = stake * (odds - 1); // Profit
        wins++;
      } else {
        outcome = -stake; // Loss
      }
      
      outcomes.push(outcome);
      
      if (outcome <= ruinThreshold) {
        ruinCount++;
      }
    }
    
    // Sort for percentiles
    outcomes.sort((a, b) => a - b);
    
    const meanReturn = outcomes.reduce((a, b) => a + b, 0) / iterations;
    const variance = outcomes.reduce((sum, val) => sum + Math.pow(val - meanReturn, 2), 0) / iterations;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? meanReturn / stdDev : 0;
    
    return {
      meanReturn,
      winRate: wins / iterations,
      ruinProbability: ruinCount / iterations,
      p5: outcomes[Math.floor(iterations * 0.05)],
      p50: outcomes[Math.floor(iterations * 0.5)],
      p95: outcomes[Math.floor(iterations * 0.95)],
      paths: outcomes.slice(0, 100), // Sample for visualization
      volatility: stdDev,
      sharpeRatio,
    };
  }
  
  /**
   * Determine confidence level
   */
  private getConfidenceLevel(
    modelConfidence: number,
    edge: number,
    ruinProb: number
  ): 'high' | 'medium' | 'low' {
    if (modelConfidence > 0.75 && edge > 0.05 && ruinProb < 0.01) {
      return 'high';
    }
    if (modelConfidence > 0.65 && edge > 0.03 && ruinProb < 0.05) {
      return 'medium';
    }
    return 'low';
  }
  
  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    market: 'home' | 'draw' | 'away',
    edge: number,
    ev: number,
    monteCarlo: MonteCarloResult,
    confidence: number
  ): string {
    const parts = [
      `${market.toUpperCase()} bet has ${(edge * 100).toFixed(1)}% edge.`,
      `Expected value: ${ev > 0 ? '+' : ''}${ev.toFixed(2)} units.`,
      `Win probability: ${(monteCarlo.winRate * 100).toFixed(1)}%.`,
      `Model confidence: ${(confidence * 100).toFixed(0)}%.`,
    ];
    
    if (monteCarlo.ruinProbability > 0.05) {
      parts.push(`⚠️ Higher risk (${(monteCarlo.ruinProbability * 100).toFixed(1)}% ruin probability).`);
    }
    
    if (monteCarlo.sharpeRatio > 1.5) {
      parts.push(`✅ Excellent risk-adjusted returns (Sharpe: ${monteCarlo.sharpeRatio.toFixed(2)}).`);
    }
    
    return parts.join(' ');
  }
  
  /**
   * Get empty Monte Carlo result for skip recommendations
   */
  private getEmptyMonteCarloResult(): MonteCarloResult {
    return {
      meanReturn: 0,
      winRate: 0,
      ruinProbability: 0,
      p5: 0,
      p50: 0,
      p95: 0,
      paths: [],
      volatility: 0,
      sharpeRatio: 0,
    };
  }
  
  /**
   * Calculate Closing Line Value (CLV)
   */
  calculateCLV(placedOdds: number, closingOdds: number): {
    clv: number;
    interpretation: 'excellent' | 'positive' | 'neutral' | 'negative';
  } {
    const clv = ((closingOdds / placedOdds) - 1) * 100;
    
    let interpretation: 'excellent' | 'positive' | 'neutral' | 'negative';
    if (clv > 2) {
      interpretation = 'excellent';
    } else if (clv > 0) {
      interpretation = 'positive';
    } else if (clv > -2) {
      interpretation = 'neutral';
    } else {
      interpretation = 'negative';
    }
    
    return { clv, interpretation };
  }
  
  /**
   * Batch optimize multiple matches
   */
  async optimizeBatch(
    matches: Array<{
      prediction: CalibratedPrediction;
      odds: Odds;
      matchId: string;
    }>,
    bankroll: number,
    riskProfile: RiskProfile = 'moderate',
    maxBets: number = 5
  ): Promise<Array<BettingRecommendation & { matchId: string }>> {
    
    const recommendations = await Promise.all(
      matches.map(async (match) => ({
        ...await this.optimizeStake(match.prediction, match.odds, bankroll, riskProfile),
        matchId: match.matchId,
      }))
    );
    
    // Filter to bets only and sort by edge
    const bets = recommendations
      .filter(r => r.recommendation === 'bet')
      .sort((a, b) => b.edge - a.edge)
      .slice(0, maxBets);
    
    return bets;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const kellyOptimizer = new KellyOptimizer();
