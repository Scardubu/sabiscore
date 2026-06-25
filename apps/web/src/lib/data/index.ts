/**
 * Data Pipeline Exports
 * 
 * @module lib/data
 */

export {
  // Classes
  StatsBombPipeline,
  FBrefScraper,
  FreeDataPipeline,
  
  // Singletons
  statsBombPipeline,
  freeDataPipeline,
  
  // Types
  type StatsBombEvent,
  type Match,
  type Competition,
  type Shot,
  type Pass,
  type Pressure,
  type XGStats,
  type SpatialMaps,
  type PossessionStats,
  type MatchFeatures,
  type ModelFeatures,
  type TrainingSample,
  type TrainingDataset,
  type TeamStats,
  type PlayerStats,
  type BuildDatasetOptions
} from './statsbomb-pipeline';
