/**
 * Cron: Update Odds
 * 
 * Runs every 30 minutes to refresh odds from free sources.
 * Vercel Cron job configuration in vercel.json.
 * 
 * Fetches upcoming matches from football-data.org free tier API.
 * Caches results in Redis Cloud for performance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { freeOddsAggregator } from '@/lib/betting/free-odds-aggregator';
import { edgeCache } from '@/lib/cache';

export const runtime = 'nodejs'; // Changed from edge to support Redis
export const dynamic = 'force-dynamic';

// Football-data.org free tier supported competitions
const SUPPORTED_COMPETITIONS = {
  PL: { code: 'PL', name: 'Premier League', league: 'premier-league' },
  BL1: { code: 'BL1', name: 'Bundesliga', league: 'bundesliga' },
  SA: { code: 'SA', name: 'Serie A', league: 'serie-a' },
  PD: { code: 'PD', name: 'La Liga', league: 'la-liga' },
  FL1: { code: 'FL1', name: 'Ligue 1', league: 'ligue-1' },
  CL: { code: 'CL', name: 'Champions League', league: 'champions-league' },
} as const;

interface FootballDataMatch {
  homeTeam: { name: string; shortName: string };
  awayTeam: { name: string; shortName: string };
  utcDate: string;
  status: string;
}

interface FootballDataResponse {
  matches: FootballDataMatch[];
}

// Cache key for upcoming matches
const MATCHES_CACHE_KEY = 'sabiscore:matches:upcoming';
const MATCHES_CACHE_TTL = 1800; // 30 minutes

/**
 * Get upcoming matches from football-data.org free tier
 * Results are cached in Redis Cloud
 */
async function getUpcomingMatches(): Promise<Array<{
  homeTeam: string;
  awayTeam: string;
  league: string;
  matchDate: string;
}>> {
  // Check Redis cache first
  const cached = await edgeCache.get<Array<{
    homeTeam: string;
    awayTeam: string;
    league: string;
    matchDate: string;
  }>>(MATCHES_CACHE_KEY);
  
  if (cached && cached.length > 0) {
    console.log('[CRON] Using cached matches from Redis');
    return cached;
  }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  const matches: Array<{
    homeTeam: string;
    awayTeam: string;
    league: string;
    matchDate: string;
  }> = [];
  
  // If no API key, return cached/sample matches for testing
  if (!apiKey) {
    console.log('[CRON] No FOOTBALL_DATA_API_KEY configured, using fallback');
    return getUpcomingMatchesFallback();
  }
  
  // Fetch from supported competitions (free tier: 10 req/min)
  for (const comp of Object.values(SUPPORTED_COMPETITIONS)) {
    try {
      const response = await fetch(
        `https://api.football-data.org/v4/competitions/${comp.code}/matches?status=SCHEDULED&limit=5`,
        {
          headers: { 'X-Auth-Token': apiKey },
          next: { revalidate: 1800 } // Cache for 30 minutes
        }
      );
      
      if (!response.ok) {
        console.warn(`[CRON] Failed to fetch ${comp.name}: ${response.status}`);
        continue;
      }
      
      const data: FootballDataResponse = await response.json();
      
      for (const match of data.matches) {
        if (match.status === 'SCHEDULED') {
          matches.push({
            homeTeam: match.homeTeam.shortName || match.homeTeam.name,
            awayTeam: match.awayTeam.shortName || match.awayTeam.name,
            league: comp.league,
            matchDate: match.utcDate
          });
        }
      }
      
      // Small delay to respect rate limits (10 req/min)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`[CRON] Error fetching ${comp.name}:`, error);
    }
  }
  
  // Sort by match date, return closest 20 matches
  const sortedMatches = matches
    .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime())
    .slice(0, 20);
  
  // Cache the results in Redis
  if (sortedMatches.length > 0) {
    await edgeCache.set(MATCHES_CACHE_KEY, sortedMatches, MATCHES_CACHE_TTL);
    console.log(`[CRON] Cached ${sortedMatches.length} matches in Redis`);
  }
  
  return sortedMatches;
}

/**
 * Fallback matches when API key is not configured
 * Returns major upcoming fixtures from top leagues
 */
function getUpcomingMatchesFallback(): Array<{
  homeTeam: string;
  awayTeam: string;
  league: string;
  matchDate: string;
}> {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  // Sample fixtures from major leagues - these would typically be fetched live
  return [
    { homeTeam: 'Arsenal', awayTeam: 'Chelsea', league: 'premier-league', matchDate: now.toISOString() },
    { homeTeam: 'Man City', awayTeam: 'Liverpool', league: 'premier-league', matchDate: now.toISOString() },
    { homeTeam: 'Barcelona', awayTeam: 'Real Madrid', league: 'la-liga', matchDate: now.toISOString() },
    { homeTeam: 'Bayern', awayTeam: 'Dortmund', league: 'bundesliga', matchDate: now.toISOString() },
    { homeTeam: 'Juventus', awayTeam: 'Inter', league: 'serie-a', matchDate: now.toISOString() },
    { homeTeam: 'PSG', awayTeam: 'Marseille', league: 'ligue-1', matchDate: nextWeek.toISOString() },
  ];
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const startTime = Date.now();
  
  try {
    // Get upcoming matches from database or external API
    const upcomingMatches = await getUpcomingMatches();
    
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];
    
    for (const match of upcomingMatches) {
      try {
        await freeOddsAggregator.getOdds(
          match.homeTeam,
          match.awayTeam,
          match.league
        );
        updated++;
      } catch (error) {
        console.error(`Failed to update odds for ${match.homeTeam} vs ${match.awayTeam}:`, error);
        errors.push(`${match.homeTeam} vs ${match.awayTeam}`);
        failed++;
      }
    }
    
    const duration = Date.now() - startTime;
    console.log('[CRON] Odds update:', { updated, failed, durationMs: duration });
    
    return NextResponse.json({
      success: true,
      updated,
      failed,
      totalMatches: upcomingMatches.length,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CRON] Odds update failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
