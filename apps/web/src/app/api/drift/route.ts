/**
 * Drift Detection API Route
 * 
 * Monitors model performance drift.
 */

import { NextResponse } from 'next/server';
import { freeMonitoring } from '@/lib/monitoring/free-analytics';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const drift = await freeMonitoring.detectDrift();
    
    // Only return 503 for critical drift with sufficient baseline data
    // Otherwise return 200 to avoid false alarms during initialization
    const statusCode = drift.driftDetected && drift.severity === 'critical' ? 503 : 200;
    
    return NextResponse.json({
      ...drift,
      timestamp: new Date().toISOString(),
    }, {
      status: statusCode,
    });
  } catch (error) {
    console.error('Drift detection failed:', error);
    return NextResponse.json({
      error: 'Drift detection failed',
      driftDetected: false,
      severity: 'none',
      recommendation: 'Drift detection unavailable. System may be initializing.',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
