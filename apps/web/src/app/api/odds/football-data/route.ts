/**
 * Football-Data.org Proxy
 * 
 * Fetches odds from football-data.org CSV exports (free tier).
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const FOOTBALL_DATA_BASE = 'https://www.football-data.co.uk/mmz4281';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const season = searchParams.get('season') || '2425'; // 2024-25 season
  const league = searchParams.get('league') || 'E0'; // Premier League
  
  try {
    const url = `${FOOTBALL_DATA_BASE}/${season}/${league}.csv`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Football-Data returned ${response.status}`);
    }
    
    const csv = await response.text();
    const lines = csv.split('\n');
    const headers = lines[0].split(',');
    
    // Find column indices
    const homeIdx = headers.indexOf('HomeTeam');
    const awayIdx = headers.indexOf('AwayTeam');
    const dateIdx = headers.indexOf('Date');
    const b365HIdx = headers.indexOf('B365H'); // Bet365 home odds
    const b365DIdx = headers.indexOf('B365D'); // Bet365 draw odds
    const b365AIdx = headers.indexOf('B365A'); // Bet365 away odds
    
    if (homeIdx === -1 || awayIdx === -1) {
      throw new Error('Invalid CSV format');
    }
    
    // Parse future matches (empty result fields)
    const matches = lines.slice(1)
      .map(line => {
        const cols = line.split(',');
        if (cols.length < headers.length) return null;
        
        // Skip completed matches (have FTHG/FTAG)
        const fthgIdx = headers.indexOf('FTHG');
        if (fthgIdx !== -1 && cols[fthgIdx]) return null;
        
        return {
          homeTeam: cols[homeIdx],
          awayTeam: cols[awayIdx],
          date: cols[dateIdx],
          odds: {
            home: parseFloat(cols[b365HIdx]) || null,
            draw: parseFloat(cols[b365DIdx]) || null,
            away: parseFloat(cols[b365AIdx]) || null,
          },
          bookmaker: 'bet365',
        };
      })
      .filter(Boolean);
    
    return NextResponse.json({
      matches,
      source: 'football-data',
      season,
      league,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Football-Data fetch failed:', error);
    return NextResponse.json({
      error: 'Failed to fetch odds from football-data',
      source: 'football-data',
    }, { status: 500 });
  }
}
