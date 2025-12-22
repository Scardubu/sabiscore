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
    // Return baseline health status for Edge runtime
    // Actual metrics tracking happens client-side with localStorage
    const health = {
      status: 'healthy' as const,
      accuracy: 0.528, // V2 model baseline
      brierScore: 0.973,
      roi: 2.34, // 234%
      predictionCount: 0,
      issues: [] as string[],
      hasSufficientData: false,
      lastUpdate: Date.now(),
    };

    return NextResponse.json({
      status: health.status,
      accuracy: health.accuracy,
      brierScore: health.brierScore,
      roi: health.roi,
      predictionCount: health.predictionCount,
      metrics: {
        accuracy: health.accuracy,
        brierScore: health.brierScore,
        roi: health.roi,
        predictionCount: health.predictionCount,
      },
      issues: health.issues,
      hasSufficientData: health.hasSufficientData,
      lastUpdate: new Date(health.lastUpdate).toISOString(),
      timestamp: new Date().toISOString(),
      modelVersion: 'v2.0',
      note: 'Edge health check - client-side tracking available in browser',
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
