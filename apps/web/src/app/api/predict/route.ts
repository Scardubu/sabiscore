/**
 * Prediction API Route
 *
 * Proxies prediction requests to the production FastAPI ensemble backend.
 */

import { NextRequest, NextResponse } from 'next/server';
import { freeMonitoring } from '@/lib/monitoring/free-analytics';
import {
  getCachedPrediction,
  setCachedPrediction,
  generateMatchId,
} from '@/lib/cache/prediction-cache';
import { isHtmlBody } from '@/lib/proxy-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // 30 second timeout

interface PredictRequestBody {
  home_team?: string;
  away_team?: string;
  match_id?: string;
  matchup?: {
    homeTeam?: string;
    awayTeam?: string;
    league?: string;
    label?: string;
  };
  homeTeam?: string;
  awayTeam?: string;
  league?: string;
  odds?: Record<string, number>;
  features?: { odds?: Record<string, number> };
  kickoff_time?: string;
  kickoffTime?: string;
  bankroll?: number;
}

interface BackendPredictionResult {
  predictions?: {
    home_win?: number;
    home_win_prob?: number;
    draw?: number;
    draw_prob?: number;
    away_win?: number;
    away_win_prob?: number;
  };
  prediction?: {
    homeWin?: number;
    draw?: number;
    awayWin?: number;
    confidence?: number;
  };
  confidence?: number;
  metadata?: { ensemble_agreement?: number };
  brier_score?: number;
  model_version?: string | number;
}

function resolveBackendBaseUrl(): string {
  const configured = process.env.SABISCORE_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL;
  if (configured && configured.trim().length > 0) {
    return configured.replace(/\/+$/, '');
  }
  return 'http://127.0.0.1:8000';
}

function buildBackendPayload(body: PredictRequestBody, generatedMatchId: string) {
  if (body?.home_team && body?.away_team) {
    return {
      ...body,
      match_id: body.match_id || generatedMatchId,
    };
  }

  const matchup = body?.matchup || {};
  return {
    match_id: generatedMatchId,
    home_team: matchup.homeTeam || body?.homeTeam || 'Home',
    away_team: matchup.awayTeam || body?.awayTeam || 'Away',
    league: matchup.league || body?.league || 'EPL',
    odds: body?.odds || body?.features?.odds || {},
    kickoff_time: body?.kickoff_time || body?.kickoffTime || null,
    bankroll: body?.bankroll,
  };
}

function normalizeBackendPrediction(result: BackendPredictionResult) {
  const predictions = result?.predictions ?? {};
  const homeWin = Number(predictions.home_win ?? predictions.home_win_prob ?? result?.prediction?.homeWin ?? 0);
  const draw = Number(predictions.draw ?? predictions.draw_prob ?? result?.prediction?.draw ?? 0);
  const awayWin = Number(predictions.away_win ?? predictions.away_win_prob ?? result?.prediction?.awayWin ?? 0);
  const confidence = Number(result?.confidence ?? result?.prediction?.confidence ?? Math.max(homeWin, draw, awayWin));

  return {
    homeWin,
    draw,
    awayWin,
    confidence,
    ensembleAgreement: Number(result?.metadata?.ensemble_agreement ?? confidence),
    calibratedBrier: Number(result?.brier_score ?? 0),
    backend: result,
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = (await request.json()) as PredictRequestBody;
    const matchup = body?.matchup;

    if (!matchup && !(body?.home_team && body?.away_team)) {
      return NextResponse.json({
        error: 'Missing match context',
        message: 'Request must include matchup or home_team/away_team fields',
      }, { status: 400 });
    }
    
    // Generate match ID for caching
    const matchId = matchup ? generateMatchId(
      matchup.homeTeam ?? '',
      matchup.awayTeam ?? '',
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

    const backendBaseUrl = resolveBackendBaseUrl();
    const backendPayload = buildBackendPayload(body, matchId);

    // Run backend prediction with performance tracking
    const predictionStart = Date.now();
    const backendResponse = await fetch(`${backendBaseUrl}/api/v1/predictions/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backendPayload),
      cache: 'no-store',
    });

    const predBody = await backendResponse.text().catch(() => '');
    if (!backendResponse.ok || isHtmlBody(predBody)) {
      throw new Error(
        isHtmlBody(predBody)
          ? 'Backend service unavailable'
          : `Backend prediction failed (${backendResponse.status}): ${predBody.slice(0, 120)}`
      );
    }

    let backendResult: BackendPredictionResult;
    try {
      backendResult = JSON.parse(predBody) as BackendPredictionResult;
    } catch {
      throw new Error('Backend returned an unexpected response');
    }
    const prediction = normalizeBackendPrediction(backendResult);
    const inferenceTime = Date.now() - predictionStart;
    
    // Track prediction with performance metrics
    if (matchup && matchup.homeTeam && matchup.awayTeam) {
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
    const backendBaseUrl = resolveBackendBaseUrl();
    const healthResponse = await fetch(`${backendBaseUrl}/api/v1/health`, {
      method: 'GET',
      cache: 'no-store',
    });

    const healthBody = await healthResponse.text().catch(() => '');

    if (!healthResponse.ok || isHtmlBody(healthBody)) {
      return NextResponse.json({ status: 'not_ready', error: 'Backend service unavailable' }, { status: 503 });
    }

    let info: unknown;
    try {
      info = JSON.parse(healthBody);
    } catch {
      return NextResponse.json({ status: 'not_ready', error: 'Unexpected response from backend' }, { status: 503 });
    }

    return NextResponse.json({
      status: 'ready',
      backend: info,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      status: 'not_ready',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 503 });
  }
}
