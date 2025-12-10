/**
 * Metrics API Route
 * 
 * Returns detailed rolling metrics for dashboard.
 */

import { NextResponse } from 'next/server';
import { freeMonitoring } from '@/lib/monitoring/free-analytics';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [metrics, health, drift] = await Promise.all([
      freeMonitoring.getMetrics(),
      freeMonitoring.getHealthCheck(),
      freeMonitoring.detectDrift(),
    ]);
    
    return NextResponse.json({
      metrics: {
        accuracy: metrics.accuracy,
        brierScore: metrics.brierScore,
        roi: metrics.roi,
        totalPredictions: metrics.totalPredictions,
        correctPredictions: metrics.correctPredictions,
        totalBets: metrics.totalBets,
        winningBets: metrics.winningBets,
        totalProfit: metrics.totalProfit,
        byOutcome: metrics.byOutcome,
        updatedAt: metrics.updatedAt,
      },
      health: {
        status: health.status,
        accuracy: health.accuracy,
        brierScore: health.brierScore,
        roi: health.roi,
        predictionCount: health.predictionCount,
        issues: health.issues,
        lastUpdate: health.lastUpdate,
        hasSufficientData: health.hasSufficientData,
      },
      drift: {
        driftDetected: drift.driftDetected,
        severity: drift.severity,
        recommendation: drift.recommendation,
        metrics: drift.metrics,
      },
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Metrics fetch failed:', error);
    return NextResponse.json({
      error: 'Failed to fetch metrics',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
