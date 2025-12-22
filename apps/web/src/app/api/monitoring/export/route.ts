/**
 * Monitoring Data Export API Route
 * 
 * Exports prediction history and metrics for analysis.
 * Supports JSON and CSV formats.
 * Note: Uses Node.js runtime for localStorage compatibility in freeMonitoring.
 */

import { NextRequest, NextResponse } from 'next/server';
import { freeMonitoring } from '@/lib/monitoring/free-analytics';

// Use Node.js runtime for localStorage compatibility
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Convert predictions to CSV format
 */
function predictionsToCSV(predictions: ReturnType<typeof freeMonitoring.exportData>['predictions']): string {
  const headers = [
    'id',
    'timestamp',
    'homeTeam',
    'awayTeam',
    'league',
    'homeWinProb',
    'drawProb',
    'awayWinProb',
    'confidence',
    'predicted',
    'actual',
    'correct',
    'brierScore',
    'betPlaced',
    'betOutcome',
    'betProfit'
  ];
  
  const rows = predictions.map(p => {
    const predicted = p.prediction.homeWin > p.prediction.draw && p.prediction.homeWin > p.prediction.awayWin
      ? 'home'
      : p.prediction.draw > p.prediction.awayWin
        ? 'draw'
        : 'away';
    
    return [
      p.id,
      new Date(p.timestamp).toISOString(),
      p.homeTeam,
      p.awayTeam,
      p.league || '',
      p.prediction.homeWin.toFixed(4),
      p.prediction.draw.toFixed(4),
      p.prediction.awayWin.toFixed(4),
      p.prediction.confidence?.toFixed(4) || '',
      predicted,
      p.actual || '',
      p.correct !== undefined ? String(p.correct) : '',
      p.brierScore?.toFixed(4) || '',
      String(p.betPlaced || false),
      p.betOutcome || '',
      p.betProfit?.toFixed(2) || ''
    ];
  });
  
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export async function GET(request: NextRequest) {
  try {
    const format = request.nextUrl.searchParams.get('format') || 'json';
    const exportData = freeMonitoring.exportData();
    const metrics = await freeMonitoring.getMetrics();
    const health = await freeMonitoring.getHealthCheck();
    
    if (format === 'csv') {
      const csv = predictionsToCSV(exportData.predictions);
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="sabiscore-predictions-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }
    
    // JSON format with full data
    const response = {
      exportedAt: new Date().toISOString(),
      summary: {
        totalPredictions: exportData.predictions.length,
        predictionsWithOutcomes: exportData.predictions.filter(p => p.actual).length,
        accuracy: metrics.accuracy,
        brierScore: metrics.brierScore,
        roi: metrics.roi,
        healthStatus: health.status,
      },
      metrics,
      health,
      baseline: exportData.baseline,
      predictions: exportData.predictions.map(p => ({
        ...p,
        timestamp: new Date(p.timestamp).toISOString(),
      })),
    };
    
    return NextResponse.json(response, {
      headers: {
        'Content-Disposition': `attachment; filename="sabiscore-monitoring-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('Export failed:', error);
    return NextResponse.json({
      error: 'Export failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
