/**
 * Production-disabled browser ML compatibility types.
 *
 * Official SabiScore inference runs only in the FastAPI backend. This module
 * remains so legacy imports compile, but it never loads TensorFlow.js, trains
 * browser models, or fabricates probabilities.
 */

export interface EnsembleMatchFeatures {
  homeForm: number[];
  awayForm: number[];
  homeXG: number[];
  awayXG: number[];
  homeXGA: number[];
  awayXGA: number[];
  homeAdvantage: number;
  restDays: number;
  injuries: number;
  h2hHistory: number[];
  advancedFeatures?: number[];
  homeShotMap: number[][];
  awayShotMap: number[][];
  homePressureMap: number[][];
  awayPressureMap: number[][];
}

export interface PredictionOutput {
  homeWin: number;
  draw: number;
  awayWin: number;
  confidence: number;
  ensembleAgreement: number;
  calibratedBrier: number;
  ensembleVotes: {
    dense: number[];
    lstm: number[];
    cnn: number[];
    poisson?: number[];
  };
  poissonAgreement?: number;
  mostLikelyScore?: {
    home: number;
    away: number;
    probability: number;
  };
}

export interface EnsembleTrainingDataset {
  samples: Array<{
    features: EnsembleMatchFeatures;
    outcome: "home" | "draw" | "away";
  }>;
}

export interface TrainingMetrics {
  denseAccuracy: number;
  lstmAccuracy: number;
  cnnAccuracy: number;
  ensembleAccuracy: number;
  calibratedBrier: number;
  totalSamples: number;
  trainingTime: number;
}

export interface TrainingOptions {
  epochs: number;
  batchSize: number;
  validationSplit: number;
  onProgress?: (message: string, progress: number) => void;
  onEpochEnd?: (epoch: number, logs: Record<string, unknown> | undefined) => void;
}

export class IsotonicCalibrator {
  async train(): Promise<void> {
    throw new Error("Browser training is disabled in production. Use backend model pipelines.");
  }

  async calibrate(probs: number[]): Promise<number[]> {
    return probs;
  }

  export(): { bins: Array<{ threshold: number; calibrated: number }>; trained: boolean } {
    return { bins: [], trained: false };
  }

  load(): void {
    return undefined;
  }

  isTrained(): boolean {
    return false;
  }
}

export class TFJSEnsembleEngine {
  private readonly calibrator = new IsotonicCalibrator();

  async initialize(): Promise<void> {
    throw new Error("Client-side TensorFlow inference is disabled. Use the backend prediction API.");
  }

  getModelInfo() {
    return {
      initialized: false,
      backend: "disabled",
      modelsLoaded: { dense: false, lstm: false, cnn: false },
      calibratorTrained: false,
      ensembleWeights: { dense: 0, lstm: 0, cnn: 0 },
    };
  }

  async saveModels(): Promise<void> {
    throw new Error("Browser model storage is disabled in production.");
  }

  async train(
    _dataset?: EnsembleTrainingDataset,
    _options?: TrainingOptions
  ): Promise<TrainingMetrics> {
    throw new Error("Browser training is disabled in production. Use backend model pipelines.");
  }

  async predict(_features?: EnsembleMatchFeatures): Promise<PredictionOutput> {
    throw new Error("Client-side prediction is disabled. Use the FastAPI backend.");
  }

  isReady(): boolean {
    return false;
  }

  getCalibrator(): IsotonicCalibrator {
    return this.calibrator;
  }

  async clearModels(): Promise<void> {
    return undefined;
  }

  getMemoryInfo(): { numTensors: number; numBytes: number } {
    return { numTensors: 0, numBytes: 0 };
  }
}

export const ensembleEngine = new TFJSEnsembleEngine();
