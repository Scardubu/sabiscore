/**
 * Upcoming Matches API Route
 *
 * Proxies upcoming matches + predictions + value bets from FastAPI backend.
 * GET /api/upcoming  (this file is app/api/upcoming/route.ts → served at /api/upcoming)
 * Backend target: GET /api/v1/upcoming/matches
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveBackendBaseUrl, proxyHeaders, isHtmlBody } from '@/lib/proxy-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // 30 second timeout

/**
 * GET /api/upcoming
 * Query parameters:
 *   - league: Optional league filter (EPL, La Liga, Bundesliga, Serie A, Ligue 1, Eredivisie)
 *   - days_ahead: Number of days ahead (1-30, default 7)
 *   - limit: Max matches (1-50, default 20)
 *   - include_predictions: Include ML predictions (default true)
 *   - include_value_bets: Include value bets (default true)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Extract query parameters
    const league = searchParams.get('league') || undefined;
    const daysAhead = searchParams.get('days_ahead') || '7';
    const limit = searchParams.get('limit') || '20';
    const includePredictions = searchParams.get('include_predictions') ?? 'true';
    const includeValueBets = searchParams.get('include_value_bets') ?? 'true';

    // Build backend URL with query params
    const backendBaseUrl = resolveBackendBaseUrl();
    const url = new URL(`${backendBaseUrl}/api/v1/upcoming/matches`);

    // Add query parameters
    if (league) url.searchParams.set('league', league);
    url.searchParams.set('days_ahead', daysAhead);
    url.searchParams.set('limit', limit);
    url.searchParams.set('include_predictions', includePredictions);
    url.searchParams.set('include_value_bets', includeValueBets);

    const response = await fetch(url.toString(), { headers: proxyHeaders() });
    const body = await response.text().catch(() => '');

    if (!response.ok || isHtmlBody(body)) {
      return NextResponse.json(
        {
          upcoming_matches: [],
          total: 0,
          matches_with_value: 0,
          avg_edge_pct: 0.0,
          cache_hit: false,
          ttl_seconds: 0,
          source: 'error',
          error: 'Backend service unavailable',
          offseason: false,
          next_season_start: null,
        },
        { status: 503 }
      );
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(body);
    } catch {
      return NextResponse.json(
        { upcoming_matches: [], total: 0, matches_with_value: 0, avg_edge_pct: 0, cache_hit: false, ttl_seconds: 0, source: 'error', error: 'Unexpected response from backend', offseason: false, next_season_start: null },
        { status: 502 }
      );
    }

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': `public, s-maxage=${data?.ttl_seconds || 300}, stale-while-revalidate=60`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error: unknown) {
    console.error('[Upcoming Matches] Error:', error);

    return NextResponse.json(
      {
        upcoming_matches: [],
        total: 0,
        matches_with_value: 0,
        avg_edge_pct: 0.0,
        cache_hit: false,
        ttl_seconds: 0,
        source: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        offseason: false,
        next_season_start: null,
      },
      { status: 500 }
    );
  }
}
