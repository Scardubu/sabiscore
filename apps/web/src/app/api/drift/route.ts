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
    
    return NextResponse.json({
      ...drift,
      timestamp: new Date().toISOString(),
    }, {
      status: drift.severity === 'critical' ? 503 : 200,
    });
  } catch (error) {
    console.error('Drift detection failed:', error);
    return NextResponse.json({
      error: 'Drift detection failed',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
