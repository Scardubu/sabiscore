/**
 * Model Warmup API Route
 * 
 * Pre-initializes TensorFlow.js models to reduce first prediction latency.
 * Called during app startup and periodically to keep models warm.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

let warmupComplete = false;
let lastWarmup = 0;
const WARMUP_COOLDOWN = 5 * 60 * 1000; // 5 minutes

/**
 * Perform model warmup by running a dummy prediction
 */
async function warmupModels(): Promise<{
  success: boolean;
  duration: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    // Import engine dynamically to avoid loading it on every request
    const { TFJSEnsembleEngine } = await import('@/lib/ml/tfjs-ensemble-engine');
    
    const engine = new TFJSEnsembleEngine();
    await engine.initialize();
    
    // Run a dummy prediction to warm up models
    const dummyFeatures = {
      homeForm: [0.6, 0.7, 0.5, 0.6, 0.7],
      awayForm: [0.5, 0.4, 0.6, 0.5, 0.4],
      homeXG: [1.5, 1.8, 1.2, 1.6, 1.7, 1.5, 1.4, 1.6, 1.5, 1.8],
      awayXG: [1.2, 1.1, 1.5, 1.3, 1.2, 1.4, 1.3, 1.2, 1.3, 1.1],
      homeXGA: [1.1, 1.0, 1.3, 1.2, 1.1],
      awayXGA: [1.4, 1.5, 1.3, 1.4, 1.6],
      homeAdvantage: 0.46,
      restDays: 0.5,
      injuries: 0.1,
      h2hHistory: [0.4, 0.2, 0.4],
      homeShotMap: Array(12).fill(null).map(() => Array(8).fill(0.1)),
      awayShotMap: Array(12).fill(null).map(() => Array(8).fill(0.1)),
      homePressureMap: Array(12).fill(null).map(() => Array(8).fill(0.1)),
      awayPressureMap: Array(12).fill(null).map(() => Array(8).fill(0.1)),
    };
    
    await engine.predict(dummyFeatures);
    
    const duration = Date.now() - startTime;
    warmupComplete = true;
    lastWarmup = Date.now();
    
    return { success: true, duration };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Model warmup failed:', error);
    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function GET(request: NextRequest) {
  // Optional auth check for production
  const authHeader = request.headers.get('authorization');
  const warmupSecret = process.env.WARMUP_SECRET;
  
  if (warmupSecret && authHeader !== `Bearer ${warmupSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Check cooldown to prevent excessive warmups
  if (warmupComplete && Date.now() - lastWarmup < WARMUP_COOLDOWN) {
    return NextResponse.json({
      success: true,
      cached: true,
      message: 'Models already warm',
      lastWarmup: new Date(lastWarmup).toISOString(),
      nextWarmupAvailable: new Date(lastWarmup + WARMUP_COOLDOWN).toISOString(),
    });
  }
  
  const result = await warmupModels();
  
  return NextResponse.json({
    ...result,
    timestamp: new Date().toISOString(),
  }, {
    status: result.success ? 200 : 500,
  });
}

/**
 * POST endpoint for forced warmup (bypasses cooldown)
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const warmupSecret = process.env.WARMUP_SECRET;
  
  if (warmupSecret && authHeader !== `Bearer ${warmupSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Force warmup regardless of cooldown
  const result = await warmupModels();
  
  return NextResponse.json({
    ...result,
    forced: true,
    timestamp: new Date().toISOString(),
  }, {
    status: result.success ? 200 : 500,
  });
}
