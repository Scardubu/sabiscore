/**
 * Training Adapter
 * 
 * Converts StatsBomb pipeline ModelFeatures to TFJSEnsembleEngine MatchFeatures
 * This bridges the gap between the two different feature schemas.
 * 
 * @module lib/ml/training-adapter
 */

import type { ModelFeatures, TrainingSample, TrainingDataset } from '../data/statsbomb-pipeline';
import type { EnsembleMatchFeatures, EnsembleTrainingDataset } from './tfjs-ensemble-engine';

// ============================================================================
// Type Definitions
// ============================================================================

export interface AdapterOptions {
  /** Default home advantage value (0-1) */
  defaultHomeAdvantage?: number;
  /** Default rest days (normalized 0-1) */
  defaultRestDays?: number;
  /** Default injury impact (0-1) */
  defaultInjuries?: number;
  /** Verbose logging */
  verbose?: boolean;
}

export interface AdaptedSample {
  features: EnsembleMatchFeatures;
  outcome: 'home' | 'draw' | 'away';
  metadata?: {
    competition: string;
    season: string;
    date: string;
    homeTeam: string;
    awayTeam: string;
  };
}

// ============================================================================
// Training Adapter
// ============================================================================

export class TrainingAdapter {
  private options: Required<AdapterOptions>;
  
  constructor(options: AdapterOptions = {}) {
    this.options = {
      defaultHomeAdvantage: options.defaultHomeAdvantage ?? 0.46, // Historical home win rate
      defaultRestDays: options.defaultRestDays ?? 0.5,
      defaultInjuries: options.defaultInjuries ?? 0.1,
      verbose: options.verbose ?? false
    };
  }
  
  /**
   * Convert a single ModelFeatures to EnsembleMatchFeatures
   */
  adaptFeatures(features: ModelFeatures): EnsembleMatchFeatures {
    return {
      // Team form features - expand from simple arrays
      homeForm: this.expandForm(features.homeForm),
      awayForm: this.expandForm(features.awayForm),
      
      // xG features - derive from single values
      homeXG: this.deriveXGHistory(features.homeXG, features.homeForm),
      awayXG: this.deriveXGHistory(features.awayXG, features.awayForm),
      homeXGA: this.deriveXGAHistory(features.awayXG, features.awayForm),
      awayXGA: this.deriveXGAHistory(features.homeXG, features.homeForm),
      
      // Match context - use defaults or derive
      homeAdvantage: this.options.defaultHomeAdvantage,
      restDays: this.options.defaultRestDays,
      injuries: this.options.defaultInjuries,
      h2hHistory: this.deriveH2H(features),
      
      // Spatial features - split combined maps into home/away
      homeShotMap: this.extractHomeSpatial(features.shotMap),
      awayShotMap: this.extractAwaySpatial(features.shotMap),
      homePressureMap: this.extractHomeSpatial(features.pressureMap),
      awayPressureMap: this.extractAwaySpatial(features.pressureMap)
    };
  }
  
  /**
   * Convert a single TrainingSample to AdaptedSample
   */
  adaptSample(sample: TrainingSample): AdaptedSample {
    return {
      features: this.adaptFeatures(sample.features),
      outcome: sample.outcome,
      metadata: sample.metadata
    };
  }
  
  /**
   * Convert entire TrainingDataset to EnsembleTrainingDataset
   */
  adaptDataset(dataset: TrainingDataset): EnsembleTrainingDataset {
    if (this.options.verbose) {
      console.log(`🔄 Adapting ${dataset.samples.length} samples...`);
    }
    
    const adaptedSamples = dataset.samples.map((sample, idx) => {
      if (this.options.verbose && idx % 100 === 0) {
        console.log(`  Adapted ${idx}/${dataset.samples.length}`);
      }
      
      return {
        features: this.adaptFeatures(sample.features),
        outcome: sample.outcome
      };
    });
    
    if (this.options.verbose) {
      console.log(`✅ Adapted ${adaptedSamples.length} samples`);
    }
    
    return { samples: adaptedSamples };
  }
  
  // ============================================================================
  // Feature Transformation Helpers
  // ============================================================================
  
  /**
   * Expand simple form array to 5-element [w, d, l, gf, ga] format
   */
  private expandForm(form: number[]): number[] {
    if (form.length >= 5) {
      return form.slice(0, 5);
    }
    
    // Convert from simple 0-1 values to [w, d, l, gf, ga]
    const wins = form.filter(f => f > 0.6).length;
    const draws = form.filter(f => f >= 0.4 && f <= 0.6).length;
    const losses = form.filter(f => f < 0.4).length;
    const total = Math.max(1, form.length);
    
    return [
      wins / total,        // Win rate
      draws / total,       // Draw rate
      losses / total,      // Loss rate
      this.average(form),  // Avg performance (proxy for goals)
      1 - this.average(form) // Inverse (proxy for goals against)
    ];
  }
  
  /**
   * Derive xG history from single xG value and form
   */
  private deriveXGHistory(xg: number, form: number[]): number[] {
    // Create 10-game xG history with some variance
    const history: number[] = [];
    const baseXG = xg;
    
    for (let i = 0; i < 10; i++) {
      const formFactor = form[i] !== undefined ? form[i] : 0.5;
      const variance = (Math.random() - 0.5) * 0.4;
      const gameXG = Math.max(0, baseXG * (0.8 + formFactor * 0.4) + variance);
      history.push(gameXG);
    }
    
    return history;
  }
  
  /**
   * Derive xGA (expected goals against) history
   */
  private deriveXGAHistory(opponentXG: number, form: number[]): number[] {
    // xGA is inversely related to form
    const history: number[] = [];
    const baseXGA = opponentXG;
    
    for (let i = 0; i < 10; i++) {
      const formFactor = form[i] !== undefined ? (1 - form[i]) : 0.5;
      const variance = (Math.random() - 0.5) * 0.3;
      const gameXGA = Math.max(0, baseXGA * (0.7 + formFactor * 0.6) + variance);
      history.push(gameXGA);
    }
    
    return history;
  }
  
  /**
   * Derive head-to-head history from features
   */
  private deriveH2H(features: ModelFeatures): number[] {
    // Estimate H2H based on relative strength
    const homeStrength = features.homeXG + features.homePossession / 100;
    const awayStrength = features.awayXG + features.awayPossession / 100;
    const total = homeStrength + awayStrength;
    
    if (total === 0) {
      return [0.4, 0.2, 0.4]; // Default balanced H2H
    }
    
    const homeAdvantage = 0.1; // Small home advantage in H2H
    const homeWinRate = (homeStrength / total) + homeAdvantage;
    const awayWinRate = (awayStrength / total) - homeAdvantage;
    const drawRate = 1 - homeWinRate - awayWinRate;
    
    return [
      Math.max(0, Math.min(1, homeWinRate)),
      Math.max(0, Math.min(1, drawRate)),
      Math.max(0, Math.min(1, awayWinRate))
    ];
  }
  
  /**
   * Extract home team spatial data (positive values from combined map)
   */
  private extractHomeSpatial(combinedMap: number[][]): number[][] {
    return combinedMap.map(row => 
      row.map(val => Math.max(0, val))
    );
  }
  
  /**
   * Extract away team spatial data (negative values from combined map, inverted)
   */
  private extractAwaySpatial(combinedMap: number[][]): number[][] {
    return combinedMap.map(row => 
      row.map(val => Math.max(0, -val))
    );
  }
  
  /**
   * Calculate average of array
   */
  private average(arr: number[]): number {
    if (arr.length === 0) return 0.5;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  
  // ============================================================================
  // Validation
  // ============================================================================
  
  /**
   * Validate that adapted features have correct shape
   */
  validateFeatures(features: EnsembleMatchFeatures): boolean {
    const checks = [
      features.homeForm.length >= 5,
      features.awayForm.length >= 5,
      features.homeXG.length >= 10,
      features.awayXG.length >= 10,
      features.homeXGA.length >= 5,
      features.awayXGA.length >= 5,
      features.h2hHistory.length >= 3,
      features.homeShotMap.length === 12,
      features.awayShotMap.length === 12,
      features.homePressureMap.length === 12,
      features.awayPressureMap.length === 12,
      features.homeShotMap.every(row => row.length === 8),
      features.awayShotMap.every(row => row.length === 8),
      typeof features.homeAdvantage === 'number',
      typeof features.restDays === 'number',
      typeof features.injuries === 'number'
    ];
    
    return checks.every(Boolean);
  }
  
  /**
   * Get statistics about the adapted dataset
   */
  getDatasetStats(dataset: EnsembleTrainingDataset): {
    totalSamples: number;
    outcomeDistribution: { home: number; draw: number; away: number };
    avgHomeXG: number;
    avgAwayXG: number;
  } {
    const stats = {
      totalSamples: dataset.samples.length,
      outcomeDistribution: { home: 0, draw: 0, away: 0 },
      avgHomeXG: 0,
      avgAwayXG: 0
    };
    
    for (const sample of dataset.samples) {
      stats.outcomeDistribution[sample.outcome]++;
      stats.avgHomeXG += this.average(sample.features.homeXG);
      stats.avgAwayXG += this.average(sample.features.awayXG);
    }
    
    if (stats.totalSamples > 0) {
      stats.avgHomeXG /= stats.totalSamples;
      stats.avgAwayXG /= stats.totalSamples;
    }
    
    return stats;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick adapter function for single features
 */
export function adaptModelFeatures(
  features: ModelFeatures, 
  options?: AdapterOptions
): EnsembleMatchFeatures {
  const adapter = new TrainingAdapter(options);
  return adapter.adaptFeatures(features);
}

/**
 * Quick adapter function for entire dataset
 */
export function adaptTrainingDataset(
  dataset: TrainingDataset,
  options?: AdapterOptions
): EnsembleTrainingDataset {
  const adapter = new TrainingAdapter(options);
  return adapter.adaptDataset(dataset);
}

// ============================================================================
// Export singleton
// ============================================================================

export const trainingAdapter = new TrainingAdapter();
