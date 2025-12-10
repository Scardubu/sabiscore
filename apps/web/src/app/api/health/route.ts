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
    
    return NextResponse.json({
      status: health.status,
      metrics: {
        accuracy: health.accuracy,
        brierScore: health.brierScore,
        roi: health.roi,
        predictionCount: health.predictionCount,
      },
      issues: health.issues,
      lastUpdate: new Date(health.lastUpdate).toISOString(),
      timestamp: new Date().toISOString(),
    }, {
      status: health.status === 'healthy' ? 200 : health.status === 'degraded' ? 207 : 503,
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
