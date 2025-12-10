/**
 * Free Training Pipeline Orchestrator
 * 
 * Connects StatsBomb free data pipeline with TensorFlow.js ensemble training.
 * This is the main entry point for training models using zero-cost data sources.
 * 
 * @module lib/ml/train-tfjs-free
 */

import { StatsBombPipeline, type BuildDatasetOptions } from '../data/statsbomb-pipeline';
import { TFJSEnsembleEngine, type TrainingMetrics, type TrainingOptions } from './tfjs-ensemble-engine';
import { TrainingAdapter } from './training-adapter';

// ============================================================================
// Type Definitions
// ============================================================================

export interface FreeTrainingConfig {
  /** StatsBomb competition IDs to use */
  competitions: number[];
  /** Minimum number of matches to collect */
  minMatches: number;
  /** Maximum matches per competition */
  maxMatchesPerCompetition: number;
  /** Training epochs */
  epochs: number;
  /** Batch size for training */
  batchSize: number;
  /** Validation split ratio */
  validationSplit: number;
  /** Progress callback */
  onProgress?: (message: string, progress: number, phase: TrainingPhase) => void;
  /** Epoch callback */
  onEpochEnd?: (epoch: number, logs: Record<string, number>) => void;
}

export type TrainingPhase = 
  | 'initializing'
  | 'fetching_data'
  | 'adapting_data'
  | 'training_dense'
  | 'training_lstm'
  | 'training_cnn'
  | 'calibrating'
  | 'evaluating'
  | 'saving'
  | 'complete';

export interface TrainingResult {
  success: boolean;
  metrics?: TrainingMetrics;
  error?: string;
  datasetStats?: {
    totalSamples: number;
    outcomeDistribution: { home: number; draw: number; away: number };
    competitions: string[];
  };
  timing?: {
    dataFetch: number;
    adaptation: number;
    training: number;
    total: number;
  };
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_TRAINING_CONFIG: FreeTrainingConfig = {
  // StatsBomb open data competitions
  competitions: [
    11,  // La Liga (2004-2020)
    37,  // FA Women's Super League
    43,  // FIFA World Cup
    2,   // Premier League (limited seasons)
    49,  // NWSL
    72,  // Women's World Cup
  ],
  minMatches: 300,
  maxMatchesPerCompetition: 100,
  epochs: 30,
  batchSize: 32,
  validationSplit: 0.2
};

// ============================================================================
// Training Pipeline
// ============================================================================

export class FreeTrainingPipeline {
  private pipeline: StatsBombPipeline;
  private engine: TFJSEnsembleEngine;
  private adapter: TrainingAdapter;
  private config: FreeTrainingConfig;
  
  constructor(config: Partial<FreeTrainingConfig> = {}) {
    this.config = { ...DEFAULT_TRAINING_CONFIG, ...config };
    this.pipeline = new StatsBombPipeline();
    this.engine = new TFJSEnsembleEngine();
    this.adapter = new TrainingAdapter({ verbose: false });
  }
  
  /**
   * Run the complete training pipeline
   */
  async run(): Promise<TrainingResult> {
    const startTime = Date.now();
    const timing = {
      dataFetch: 0,
      adaptation: 0,
      training: 0,
      total: 0
    };
    
    try {
      // Phase 1: Initialize
      this.config.onProgress?.('🚀 Initializing training pipeline...', 0, 'initializing');
      await this.engine.initialize();
      
      // Phase 2: Fetch data from StatsBomb
      this.config.onProgress?.('📥 Fetching data from StatsBomb Open Data...', 0.05, 'fetching_data');
      const fetchStart = Date.now();
      
      const datasetOptions: BuildDatasetOptions = {
        competitions: this.config.competitions,
        minMatches: this.config.minMatches,
        maxMatchesPerCompetition: this.config.maxMatchesPerCompetition,
        onProgress: (msg, progress) => {
          this.config.onProgress?.(msg, 0.05 + progress * 0.35, 'fetching_data');
        }
      };
      
      const rawDataset = await this.pipeline.buildTrainingDataset(datasetOptions);
      timing.dataFetch = Date.now() - fetchStart;
      
      if (rawDataset.samples.length === 0) {
        throw new Error('No training samples collected. Check network connection and StatsBomb API availability.');
      }
      
      // Phase 3: Adapt data to ensemble format
      this.config.onProgress?.('🔄 Adapting data for ensemble training...', 0.4, 'adapting_data');
      const adaptStart = Date.now();
      
      const adaptedDataset = this.adapter.adaptDataset(rawDataset);
      const datasetStats = this.adapter.getDatasetStats(adaptedDataset);
      timing.adaptation = Date.now() - adaptStart;
      
      // Log dataset statistics
      console.log('📊 Dataset Statistics:', {
        totalSamples: datasetStats.totalSamples,
        outcomes: datasetStats.outcomeDistribution,
        avgHomeXG: datasetStats.avgHomeXG.toFixed(2),
        avgAwayXG: datasetStats.avgAwayXG.toFixed(2)
      });
      
      // Phase 4: Train ensemble
      this.config.onProgress?.('🎓 Training TensorFlow.js ensemble...', 0.45, 'training_dense');
      const trainStart = Date.now();
      
      const trainingOptions: TrainingOptions = {
        epochs: this.config.epochs,
        batchSize: this.config.batchSize,
        validationSplit: this.config.validationSplit,
        onProgress: (msg, progress) => {
          // Map training progress to phases
          let phase: TrainingPhase = 'training_dense';
          if (progress > 0.35 && progress <= 0.6) phase = 'training_lstm';
          else if (progress > 0.6 && progress <= 0.8) phase = 'training_cnn';
          else if (progress > 0.8 && progress <= 0.9) phase = 'calibrating';
          else if (progress > 0.9 && progress <= 0.95) phase = 'evaluating';
          else if (progress > 0.95) phase = 'saving';
          
          this.config.onProgress?.(msg, 0.45 + progress * 0.5, phase);
        },
        onEpochEnd: (epoch, logs) => {
          this.config.onEpochEnd?.(epoch, logs as Record<string, number> || {});
        }
      };
      
      const metrics = await this.engine.train(adaptedDataset, trainingOptions);
      timing.training = Date.now() - trainStart;
      
      // Phase 5: Complete
      timing.total = Date.now() - startTime;
      this.config.onProgress?.('✅ Training complete!', 1, 'complete');
      
      // Get unique competitions from samples
      const competitions = [...new Set(
        rawDataset.samples.map(s => s.metadata?.competition).filter(Boolean)
      )] as string[];
      
      return {
        success: true,
        metrics,
        datasetStats: {
          totalSamples: datasetStats.totalSamples,
          outcomeDistribution: datasetStats.outcomeDistribution,
          competitions
        },
        timing
      };
      
    } catch (error) {
      timing.total = Date.now() - startTime;
      console.error('Training pipeline error:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timing
      };
    }
  }
  
  /**
   * Get the trained engine instance
   */
  getEngine(): TFJSEnsembleEngine {
    return this.engine;
  }
  
  /**
   * Clear all trained models
   */
  async clearModels(): Promise<void> {
    await this.engine.clearModels();
  }
  
  /**
   * Check if models are already trained
   */
  async hasTrainedModels(): Promise<boolean> {
    try {
      await this.engine.initialize();
      return this.engine.isReady();
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick training function with default config
 */
export async function trainFreeModels(
  onProgress?: (message: string, progress: number, phase: TrainingPhase) => void
): Promise<TrainingResult> {
  const pipeline = new FreeTrainingPipeline({
    onProgress
  });
  
  return pipeline.run();
}

/**
 * Quick training with custom config
 */
export async function trainWithConfig(
  config: Partial<FreeTrainingConfig>
): Promise<TrainingResult> {
  const pipeline = new FreeTrainingPipeline(config);
  return pipeline.run();
}

/**
 * Check if models exist in browser storage
 */
export async function checkExistingModels(): Promise<boolean> {
  const pipeline = new FreeTrainingPipeline();
  return pipeline.hasTrainedModels();
}

/**
 * Clear all models from browser storage
 */
export async function clearAllModels(): Promise<void> {
  const pipeline = new FreeTrainingPipeline();
  await pipeline.clearModels();
}

// ============================================================================
// Export
// ============================================================================

export { FreeTrainingPipeline as default };
