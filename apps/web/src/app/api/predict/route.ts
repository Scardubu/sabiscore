/**
 * Prediction API Route
 * 
 * Generates match predictions using TensorFlow.js ensemble.
 * Uses Node.js runtime for TensorFlow.js compatibility.
 */

import { NextRequest, NextResponse } from 'next/server';
import { TFJSEnsembleEngine } from '@/lib/ml/tfjs-ensemble-engine';
import { TrainingAdapter } from '@/lib/ml/training-adapter';
import { freeMonitoring } from '@/lib/monitoring/free-analytics';
import {
  getCachedPrediction,
  setCachedPrediction,
  generateMatchId,
} from '@/lib/cache/prediction-cache';

// Use Node.js runtime for TensorFlow.js compatibility
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // 30 second timeout

let engine: TFJSEnsembleEngine | null = null;
const adapter = new TrainingAdapter();

async function getEngine(): Promise<TFJSEnsembleEngine> {
  if (!engine) {
    engine = new TFJSEnsembleEngine();
    await engine.initialize();
  }
  return engine;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { features, matchup } = body;
    
    if (!features) {
      return NextResponse.json({
        error: 'Missing features',
        message: 'Request must include match features',
      }, { status: 400 });
    }
    
    // Generate match ID for caching
    const matchId = matchup ? generateMatchId(
      matchup.homeTeam,
      matchup.awayTeam,
      matchup.league
    ) : `unknown-${Date.now()}`;
    
    // Check cache first
    const cached = await getCachedPrediction(matchId);
    if (cached) {
      console.log(`✅ Cache hit for ${matchId}`);
      return NextResponse.json({
        ...cached,
        performance: {
          inferenceTime: 0,
          totalTime: Date.now() - startTime,
          fromCache: true,
        },
        timestamp: new Date().toISOString(),
      });
    }
    
    // Get engine instance with timeout
    const predictionEngine = await Promise.race([
      getEngine(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Engine initialization timeout')), 15000)
      )
    ]);
    
    // Adapt features to ensemble format
    const adaptedFeatures = adapter.adaptFeatures(features);
    
    // Run prediction with performance tracking
    const predictionStart = Date.now();
    const prediction = await predictionEngine.predict(adaptedFeatures);
    const inferenceTime = Date.now() - predictionStart;
    
    // Track prediction with performance metrics
    if (matchup) {
      await freeMonitoring.trackPrediction({
        id: `pred-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        matchup: matchup.label || `${matchup.homeTeam} vs ${matchup.awayTeam}`,
        homeTeam: matchup.homeTeam,
        awayTeam: matchup.awayTeam,
        league: matchup.league || 'unknown',
        timestamp: Date.now(),
        prediction: {
          homeWin: prediction.homeWin,
          draw: prediction.draw,
          awayWin: prediction.awayWin,
          confidence: prediction.confidence,
        },
      });
    }
    
    const totalTime = Date.now() - startTime;
    
    // Cache the prediction result
    const responseData = {
      prediction,
      performance: {
        inferenceTime,
        totalTime,
        fromCache: false,
      },
      metadata: {
        ensembleAgreement: prediction.ensembleAgreement,
        calibratedBrier: prediction.calibratedBrier,
      },
    };
    
    await setCachedPrediction(matchId, responseData);
    
    return NextResponse.json({
      ...responseData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Prediction failed:', error);
    
    // Track error for monitoring
    await freeMonitoring.trackError({
      type: 'prediction_error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
    });
    
    return NextResponse.json({
      error: 'Prediction failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const predictionEngine = await getEngine();
    const info = predictionEngine.getModelInfo();
    
    return NextResponse.json({
      status: 'ready',
      models: info,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      status: 'not_ready',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 503 });
  }
}
