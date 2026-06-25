/**
 * Confidence-Based Accuracy Tracking
 * 
 * Tracks prediction accuracy stratified by confidence levels.
 * Helps identify calibration issues and improve betting strategies.
 * 
 * Impact: Better model monitoring, calibration insights, ROI optimization
 */

import { kv } from '@vercel/kv';

export interface PredictionRecord {
  id: string;
  timestamp: number;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  prediction: {
    homeWin: number;
    draw: number;
    awayWin: number;
    confidence: number;
    ensembleAgreement?: number;
  };
  outcome?: 'home' | 'draw' | 'away'; // Actual result (set after match)
  correct?: boolean;
}

export interface ConfidenceBand {
  label: string;
  min: number;
  max: number;
  predictions: number;
  correct: number;
  accuracy: number;
  averageConfidence: number;
}

export interface AccuracyMetrics {
  overall: {
    total: number;
    correct: number;
    accuracy: number;
  };
  byConfidence: ConfidenceBand[];
  byAgreement: {
    high: { total: number; correct: number; accuracy: number };
    medium: { total: number; correct: number; accuracy: number };
    low: { total: number; correct: number; accuracy: number };
  };
  calibration: {
    isWellCalibrated: boolean;
    calibrationError: number; // Mean absolute calibration error
  };
}

const KV_PREFIX = 'prediction:';
const METRICS_KEY = 'accuracy:metrics';
const CONFIDENCE_BANDS = [
  { label: 'Very High', min: 0.85, max: 1.0 },
  { label: 'High', min: 0.75, max: 0.85 },
  { label: 'Medium-High', min: 0.65, max: 0.75 },
  { label: 'Medium', min: 0.55, max: 0.65 },
  { label: 'Low', min: 0.0, max: 0.55 },
];

/**
 * Track a new prediction
 */
export async function trackPredictionByConfidence(
  record: PredictionRecord
): Promise<void> {
  try {
    // Store prediction record with 90-day TTL
    const key = `${KV_PREFIX}${record.id}`;
    await kv.set(key, JSON.stringify(record), { ex: 60 * 60 * 24 * 90 });
    
    console.log(`✅ Tracked prediction ${record.id} (confidence: ${(record.prediction.confidence * 100).toFixed(1)}%)`);
  } catch (error) {
    console.error('Failed to track prediction:', error);
    // Don't throw - tracking failures shouldn't block predictions
  }
}

/**
 * Update prediction with actual outcome
 */
export async function updatePredictionOutcome(
  predictionId: string,
  outcome: 'home' | 'draw' | 'away'
): Promise<void> {
  try {
    const key = `${KV_PREFIX}${predictionId}`;
    const data = await kv.get<string>(key);
    
    if (!data) {
      console.warn(`Prediction ${predictionId} not found`);
      return;
    }
    
    const record: PredictionRecord = JSON.parse(data);
    
    // Determine predicted outcome (highest probability)
    const probs = [
      { outcome: 'home', prob: record.prediction.homeWin },
      { outcome: 'draw', prob: record.prediction.draw },
      { outcome: 'away', prob: record.prediction.awayWin },
    ];
    const predicted = probs.reduce((max, p) => p.prob > max.prob ? p : max, probs[0]);
    
    // Check if correct
    const correct = predicted.outcome === outcome;
    
    // Update record
    record.outcome = outcome;
    record.correct = correct;
    
    await kv.set(key, JSON.stringify(record), { ex: 60 * 60 * 24 * 90 });
    
    // Invalidate cached metrics
    await kv.del(METRICS_KEY);
    
    console.log(`✅ Updated prediction ${predictionId}: ${correct ? 'CORRECT' : 'INCORRECT'}`);
  } catch (error) {
    console.error('Failed to update prediction outcome:', error);
  }
}

/**
 * Calculate accuracy metrics across confidence bands
 */
export async function getAccuracyMetrics(): Promise<AccuracyMetrics> {
  try {
    // Check cache first
    const cached = await kv.get<string>(METRICS_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Fetch all prediction records
    const keys = await kv.keys(`${KV_PREFIX}*`);
    const records: PredictionRecord[] = [];
    
    for (const key of keys) {
      const data = await kv.get<string>(key);
      if (data) {
        const record = JSON.parse(data);
        if (record.outcome) {
          records.push(record);
        }
      }
    }
    
    if (records.length === 0) {
      return getEmptyMetrics();
    }
    
    // Calculate overall accuracy
    const correct = records.filter(r => r.correct).length;
    const overall = {
      total: records.length,
      correct,
      accuracy: correct / records.length,
    };
    
    // Calculate by confidence bands
    const byConfidence: ConfidenceBand[] = CONFIDENCE_BANDS.map(band => {
      const bandRecords = records.filter(
        r => r.prediction.confidence >= band.min && r.prediction.confidence < band.max
      );
      
      const bandCorrect = bandRecords.filter(r => r.correct).length;
      const avgConfidence = bandRecords.length > 0
        ? bandRecords.reduce((sum, r) => sum + r.prediction.confidence, 0) / bandRecords.length
        : (band.min + band.max) / 2;
      
      return {
        label: band.label,
        min: band.min,
        max: band.max,
        predictions: bandRecords.length,
        correct: bandCorrect,
        accuracy: bandRecords.length > 0 ? bandCorrect / bandRecords.length : 0,
        averageConfidence: avgConfidence,
      };
    });
    
    // Calculate by ensemble agreement
    const byAgreement = {
      high: calculateAgreementMetrics(records, 0.85, 1.0),
      medium: calculateAgreementMetrics(records, 0.70, 0.85),
      low: calculateAgreementMetrics(records, 0.0, 0.70),
    };
    
    // Calculate calibration error
    const calibrationError = calculateCalibrationError(byConfidence);
    
    const metrics: AccuracyMetrics = {
      overall,
      byConfidence,
      byAgreement,
      calibration: {
        isWellCalibrated: calibrationError < 0.05, // <5% error is good
        calibrationError,
      },
    };
    
    // Cache for 1 hour
    await kv.set(METRICS_KEY, JSON.stringify(metrics), { ex: 3600 });
    
    return metrics;
  } catch (error) {
    console.error('Failed to calculate accuracy metrics:', error);
    return getEmptyMetrics();
  }
}

/**
 * Get predictions in a specific confidence band
 */
export async function getPredictionsByConfidence(
  minConfidence: number,
  maxConfidence: number = 1.0
): Promise<PredictionRecord[]> {
  try {
    const keys = await kv.keys(`${KV_PREFIX}*`);
    const records: PredictionRecord[] = [];
    
    for (const key of keys) {
      const data = await kv.get<string>(key);
      if (data) {
        const record: PredictionRecord = JSON.parse(data);
        if (
          record.prediction.confidence >= minConfidence &&
          record.prediction.confidence < maxConfidence
        ) {
          records.push(record);
        }
      }
    }
    
    return records.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Failed to get predictions by confidence:', error);
    return [];
  }
}

/**
 * Get recent prediction history
 */
export async function getRecentPredictions(limit: number = 50): Promise<PredictionRecord[]> {
  try {
    const keys = await kv.keys(`${KV_PREFIX}*`);
    const records: PredictionRecord[] = [];
    
    for (const key of keys) {
      const data = await kv.get<string>(key);
      if (data) {
        records.push(JSON.parse(data));
      }
    }
    
    return records
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  } catch (error) {
    console.error('Failed to get recent predictions:', error);
    return [];
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateAgreementMetrics(
  records: PredictionRecord[],
  minAgreement: number,
  maxAgreement: number
): { total: number; correct: number; accuracy: number } {
  const filtered = records.filter(
    r => r.prediction.ensembleAgreement &&
         r.prediction.ensembleAgreement >= minAgreement &&
         r.prediction.ensembleAgreement < maxAgreement
  );
  
  const correct = filtered.filter(r => r.correct).length;
  
  return {
    total: filtered.length,
    correct,
    accuracy: filtered.length > 0 ? correct / filtered.length : 0,
  };
}

function calculateCalibrationError(bands: ConfidenceBand[]): number {
  // Mean absolute calibration error:
  // Average difference between predicted confidence and actual accuracy
  let totalError = 0;
  let totalWeight = 0;
  
  for (const band of bands) {
    if (band.predictions > 0) {
      const error = Math.abs(band.averageConfidence - band.accuracy);
      totalError += error * band.predictions;
      totalWeight += band.predictions;
    }
  }
  
  return totalWeight > 0 ? totalError / totalWeight : 0;
}

function getEmptyMetrics(): AccuracyMetrics {
  return {
    overall: { total: 0, correct: 0, accuracy: 0 },
    byConfidence: CONFIDENCE_BANDS.map(band => ({
      label: band.label,
      min: band.min,
      max: band.max,
      predictions: 0,
      correct: 0,
      accuracy: 0,
      averageConfidence: (band.min + band.max) / 2,
    })),
    byAgreement: {
      high: { total: 0, correct: 0, accuracy: 0 },
      medium: { total: 0, correct: 0, accuracy: 0 },
      low: { total: 0, correct: 0, accuracy: 0 },
    },
    calibration: {
      isWellCalibrated: true,
      calibrationError: 0,
    },
  };
}
