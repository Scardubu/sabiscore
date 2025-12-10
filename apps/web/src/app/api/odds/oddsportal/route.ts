/**
 * Oddsportal Scraper Proxy
 * 
 * Fetches odds from oddsportal.com (web scraping).
 * Note: This is a lightweight scraper for educational purposes.
 * Consider rate limiting and robots.txt compliance.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const matchId = searchParams.get('matchId');
  
  if (!matchId) {
    return NextResponse.json({
      error: 'matchId parameter required',
      source: 'oddsportal',
    }, { status: 400 });
  }
  
  try {
    // Note: Actual implementation would use a headless browser or API
    // This is a placeholder showing the structure
    
    const url = `https://www.oddsportal.com/football/${matchId}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Oddsportal returned ${response.status}`);
    }
    
    const html = await response.text();
    
    // Simple regex parsing (production would use cheerio/jsdom)
    const odds = {
      home: extractOdds(html, 'home'),
      draw: extractOdds(html, 'draw'),
      away: extractOdds(html, 'away'),
    };
    
    return NextResponse.json({
      odds,
      source: 'oddsportal',
      matchId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Oddsportal scrape failed:', error);
    return NextResponse.json({
      error: 'Failed to scrape odds from oddsportal',
      source: 'oddsportal',
      note: 'Web scraping may be unreliable. Consider using API sources.',
    }, { status: 500 });
  }
}

/**
 * Extract odds from HTML (simplified)
 */
function extractOdds(html: string, outcome: string): number | null {
  // Production implementation would use proper DOM parsing
  // This is a placeholder
  const pattern = new RegExp(`data-${outcome}="([0-9.]+)"`);
  const match = html.match(pattern);
  return match ? parseFloat(match[1]) : null;
}
