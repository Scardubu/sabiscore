/**
 * Health Check API Route
 * 
 * Provides system health status for monitoring.
 */

import { NextResponse } from 'next/server';
import { freeMonitoring } from '@/lib/monitoring/free-analytics';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const health = await freeMonitoring.getHealthCheck();
    const statusCode = health.status === 'critical' ? 503 : 200;

    // Frontend dashboards expect these fields at the top-level.
    // Keep the nested `metrics` object for backward compatibility.
    const accuracy = typeof health.accuracy === 'number' ? health.accuracy : 0;
    const brierScore = typeof health.brierScore === 'number' ? health.brierScore : 0;
    const roi = typeof health.roi === 'number' ? health.roi : 0;
    const predictionCount = typeof health.predictionCount === 'number' ? health.predictionCount : 0;
    
    return NextResponse.json({
      status: health.status,
      accuracy,
      brierScore,
      roi,
      predictionCount,
      metrics: {
        accuracy,
        brierScore,
        roi,
        predictionCount,
      },
      issues: health.issues,
      hasSufficientData: health.hasSufficientData,
      lastUpdate: new Date(health.lastUpdate).toISOString(),
      timestamp: new Date().toISOString(),
    }, {
      status: statusCode,
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
