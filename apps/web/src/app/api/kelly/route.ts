/**
 * Kelly Criterion API Route
 * 
 * Calculates optimal betting stakes using Kelly criterion with Monte Carlo simulation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { kellyOptimizer } from '@/lib/betting/kelly-optimizer';

// Use Node.js runtime for better performance
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

interface RequestBody {
  prediction: {
    homeWin: number;
    draw: number;
    awayWin: number;
    confidence: number;
  };
  odds: {
    home: number;
    draw: number;
    away: number;
  };
  bankroll: number;
  riskProfile?: 'conservative' | 'moderate' | 'aggressive';
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    
    const { prediction, odds, bankroll, riskProfile = 'conservative' } = body;
    
    // Validate inputs
    if (!prediction || !odds || !bankroll) {
      return NextResponse.json({
        error: 'Missing required fields: prediction, odds, bankroll',
      }, { status: 400 });
    }
    
    // Calculate recommendation
    const recommendation = await kellyOptimizer.optimizeStake(
      prediction,
      odds,
      bankroll,
      riskProfile
    );
    
    return NextResponse.json({
      ...recommendation,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Kelly calculation failed:', error);
    return NextResponse.json({
      error: 'Kelly calculation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
