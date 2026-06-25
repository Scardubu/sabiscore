/**
 * Outcome Update API Route
 * 
 * Updates prediction outcomes when match results are known.
 * This enables the monitoring system to calculate accuracy and ROI.
 * Note: Uses Node.js runtime for localStorage compatibility in freeMonitoring.
 */

import { NextRequest, NextResponse } from 'next/server';
import { freeMonitoring } from '@/lib/monitoring/free-analytics';

// Use Node.js runtime for localStorage compatibility
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface OutcomeUpdateRequest {
  predictionId: string;
  actual: 'home' | 'draw' | 'away';
  betOutcome?: 'win' | 'loss' | 'void';
  betProfit?: number;
}

interface BatchOutcomeRequest {
  outcomes: OutcomeUpdateRequest[];
}

/**
 * POST /api/outcome
 * Update a single prediction outcome
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as OutcomeUpdateRequest;
    
    const { predictionId, actual, betOutcome, betProfit } = body;
    
    if (!predictionId || !actual) {
      return NextResponse.json({
        error: 'Missing required fields',
        message: 'predictionId and actual outcome are required',
      }, { status: 400 });
    }
    
    if (!['home', 'draw', 'away'].includes(actual)) {
      return NextResponse.json({
        error: 'Invalid outcome',
        message: 'actual must be "home", "draw", or "away"',
      }, { status: 400 });
    }
    
    await freeMonitoring.updateOutcome(predictionId, actual, betOutcome, betProfit);
    
    return NextResponse.json({
      success: true,
      message: `Outcome updated for prediction ${predictionId}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Outcome update failed:', error);
    return NextResponse.json({
      error: 'Failed to update outcome',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

/**
 * PUT /api/outcome
 * Batch update multiple prediction outcomes
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json() as BatchOutcomeRequest;
    
    if (!body.outcomes || !Array.isArray(body.outcomes) || body.outcomes.length === 0) {
      return NextResponse.json({
        error: 'Invalid request',
        message: 'outcomes array is required and must not be empty',
      }, { status: 400 });
    }
    
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };
    
    for (const outcome of body.outcomes) {
      try {
        if (!outcome.predictionId || !outcome.actual) {
          results.failed++;
          results.errors.push(`Missing fields for prediction: ${outcome.predictionId || 'unknown'}`);
          continue;
        }
        
        if (!['home', 'draw', 'away'].includes(outcome.actual)) {
          results.failed++;
          results.errors.push(`Invalid outcome for prediction: ${outcome.predictionId}`);
          continue;
        }
        
        await freeMonitoring.updateOutcome(
          outcome.predictionId,
          outcome.actual,
          outcome.betOutcome,
          outcome.betProfit
        );
        results.successful++;
      } catch (err) {
        results.failed++;
        results.errors.push(`Failed to update ${outcome.predictionId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
    
    return NextResponse.json({
      success: results.failed === 0,
      results,
      message: `Updated ${results.successful}/${body.outcomes.length} outcomes`,
      timestamp: new Date().toISOString(),
    }, {
      status: results.failed > 0 && results.successful === 0 ? 500 : 200,
    });
  } catch (error) {
    console.error('Batch outcome update failed:', error);
    return NextResponse.json({
      error: 'Failed to process batch update',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
