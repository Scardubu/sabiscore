/**
 * Production-disabled browser training compatibility layer.
 *
 * Historical UI imports this module, but production training and inference are
 * backend-only. These helpers fail closed and never fetch open data, train in
 * the browser, or write model artifacts to local storage.
 */

import { TFJSEnsembleEngine, type TrainingMetrics } from "./tfjs-ensemble-engine";

export interface FreeTrainingConfig {
  competitions: number[];
  minMatches: number;
  maxMatchesPerCompetition: number;
  epochs: number;
  batchSize: number;
  validationSplit: number;
  onProgress?: (message: string, progress: number, phase: TrainingPhase) => void;
  onEpochEnd?: (epoch: number, logs: Record<string, number>) => void;
}

export type TrainingPhase =
  | "initializing"
  | "fetching_data"
  | "adapting_data"
  | "training_dense"
  | "training_lstm"
  | "training_cnn"
  | "calibrating"
  | "evaluating"
  | "saving"
  | "complete";

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

export const DEFAULT_TRAINING_CONFIG: FreeTrainingConfig = {
  competitions: [],
  minMatches: 0,
  maxMatchesPerCompetition: 0,
  epochs: 0,
  batchSize: 0,
  validationSplit: 0,
};

const DISABLED_MESSAGE =
  "Browser TFJS training is disabled in production. Use backend model pipelines.";

export class FreeTrainingPipeline {
  private readonly engine = new TFJSEnsembleEngine();

  constructor(_config: Partial<FreeTrainingConfig> = {}) {}

  async run(): Promise<TrainingResult> {
    return {
      success: false,
      error: DISABLED_MESSAGE,
      timing: { dataFetch: 0, adaptation: 0, training: 0, total: 0 },
    };
  }

  getEngine(): TFJSEnsembleEngine {
    return this.engine;
  }

  async clearModels(): Promise<void> {
    return undefined;
  }

  async hasTrainedModels(): Promise<boolean> {
    return false;
  }
}

export async function trainFreeModels(
  _onProgress?: (message: string, progress: number, phase: TrainingPhase) => void
): Promise<TrainingResult> {
  return new FreeTrainingPipeline().run();
}

export async function trainWithConfig(
  config: Partial<FreeTrainingConfig>
): Promise<TrainingResult> {
  return new FreeTrainingPipeline(config).run();
}

export async function checkExistingModels(): Promise<boolean> {
  return false;
}

export async function clearAllModels(): Promise<void> {
  return undefined;
}

export { FreeTrainingPipeline as default };
