/**
 * Health Check API Route
 * 
 * Provides system health status for monitoring.
 * Edge-compatible version that doesn't rely on localStorage.
 */

import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Phase 8 baseline metrics (walk-forward validated, not simulated).
    // Actual live metrics tracked client-side via localStorage.
    const health = {
      status: 'healthy' as const,
      accuracy: 0.53,           // Phase 8 ensemble ~53% 3-class accuracy
      brierScore: 0.225,        // Multiclass Brier (avg of 3 binary Brier scores)
      rpsGate: 0.210,           // RPS gate — model must be ≤ this to release
      avgEdgePct: 0.084,        // +8.4% average value bet edge when detected
      predictionCount: 0,
      issues: [] as string[],
      hasSufficientData: false,
      lastUpdate: Date.now(),
    };

    return NextResponse.json({
      status: health.status,
      accuracy: health.accuracy,
      brierScore: health.brierScore,
      rpsGate: health.rpsGate,
      avgEdgePct: health.avgEdgePct,
      predictionCount: health.predictionCount,
      metrics: {
        accuracy: health.accuracy,
        brierScore: health.brierScore,
        rpsGate: health.rpsGate,
        avgEdgePct: health.avgEdgePct,
        predictionCount: health.predictionCount,
      },
      issues: health.issues,
      hasSufficientData: health.hasSufficientData,
      lastUpdate: new Date(health.lastUpdate).toISOString(),
      timestamp: new Date().toISOString(),
      modelVersion: 'phase8-ensemble',
      note: 'Edge health check - live model metrics served by backend /health/ready',
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json({
      status: 'critical',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }
}
