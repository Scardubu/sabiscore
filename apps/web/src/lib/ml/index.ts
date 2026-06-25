/**
 * ML Module Exports
 * 
 * @module lib/ml
 */

// TensorFlow.js Ensemble Engine
export {
  TFJSEnsembleEngine,
  IsotonicCalibrator,
  ensembleEngine,
  
  type EnsembleMatchFeatures,
  type PredictionOutput,
  type EnsembleTrainingDataset,
  type TrainingMetrics,
  type TrainingOptions
} from './tfjs-ensemble-engine';

// Training Adapter
export {
  TrainingAdapter,
  trainingAdapter,
  adaptModelFeatures,
  adaptTrainingDataset,
  
  type AdapterOptions,
  type AdaptedSample
} from './training-adapter';

// Free Training Pipeline
export {
  FreeTrainingPipeline,
  trainFreeModels,
  trainWithConfig,
  checkExistingModels,
  clearAllModels,
  DEFAULT_TRAINING_CONFIG,
  
  type FreeTrainingConfig,
  type TrainingPhase,
  type TrainingResult
} from './train-tfjs-free';
