/**
 * Odds API Proxy
 * 
 * Fetches odds from odds-api.com (500 requests/month free tier).
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const ODDS_API_KEY = process.env.ODDS_API_KEY || '';
const BASE_URL = 'https://api.the-odds-api.com/v4';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sport = searchParams.get('sport') || 'soccer_epl';
  const markets = searchParams.get('markets') || 'h2h';
  
  if (!ODDS_API_KEY) {
    return NextResponse.json({
      error: 'Odds API key not configured',
      source: 'odds-api',
    }, { status: 500 });
  }
  
  try {
    const url = `${BASE_URL}/sports/${sport}/odds?` + new URLSearchParams({
      apiKey: ODDS_API_KEY,
      regions: 'uk,eu',
      markets,
      oddsFormat: 'decimal',
    });
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Odds API returned ${response.status}`);
    }
    
    const data = await response.json() as Array<{
      home_team: string;
      away_team: string;
      commence_time: string;
      bookmakers?: Array<{
        key: string;
        markets?: Array<{
          key: string;
          outcomes?: Array<{ name: string; price: number }>;
        }>;
      }>;
    }>;
    
    // Transform to standard format
    const odds = data.map((match) => ({
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      commence: match.commence_time,
      bookmakers: match.bookmakers?.map((bm) => ({
        name: bm.key,
        markets: bm.markets?.map((market) => ({
          type: market.key,
          outcomes: market.outcomes?.map((outcome) => ({
            name: outcome.name,
            price: outcome.price,
          })),
        })),
      })),
    }));
    
    return NextResponse.json({
      odds,
      source: 'odds-api',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Odds API fetch failed:', error);
    return NextResponse.json({
      error: 'Failed to fetch odds from odds-api',
      source: 'odds-api',
    }, { status: 500 });
  }
}
