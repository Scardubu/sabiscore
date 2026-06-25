/**
 * Free Odds Aggregation
 * 
 * Aggregates odds from multiple free sources to find best available prices.
 * Uses Vercel Edge Functions to bypass CORS.
 * 
 * @module lib/betting/free-odds-aggregator
 */

import type { Odds } from './kelly-optimizer';

export interface OddsSource {
  name: string;
  home: number;
  draw: number;
  away: number;
  timestamp: number;
  reliability: number; // 0-1
}

export interface AggregatedOdds extends Odds {
  sources: OddsSource[];
  bestHome: OddsSource;
  bestDraw: OddsSource;
  bestAway: OddsSource;
  spread: {
    home: number;
    draw: number;
    away: number;
  };
  liquidity: 'high' | 'medium' | 'low';
}

export interface OddsMovement {
  direction: 'up' | 'down' | 'stable';
  change: number;
  velocity: number; // Rate of change
  timestamp: number;
}

export interface CLVMetrics {
  clv: number;
  interpretation: 'excellent' | 'positive' | 'neutral' | 'negative';
  oddsMovement: {
    opening: number;
    current: number;
    closing?: number;
    change: number;
  };
}

// ============================================================================
// Free Odds Aggregator
// ============================================================================

export class FreeOddsAggregator {
  private cache: Map<string, { odds: AggregatedOdds; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  private sources = [
    {
      name: 'odds-api',
      endpoint: '/api/odds/odds-api',
      rateLimit: 500, // req/month
      reliability: 0.9,
    },
    {
      name: 'football-data',
      endpoint: '/api/odds/football-data',
      rateLimit: null, // CSV download, no rate limit
      reliability: 0.85,
    },
    {
      name: 'oddsportal',
      endpoint: '/api/odds/oddsportal',
      rateLimit: null, // Scraping via Edge Function
      reliability: 0.80,
    },
  ];
  
  /**
   * Get aggregated odds from all sources
   */
  async getOdds(
    homeTeam: string,
    awayTeam: string,
    league?: string
  ): Promise<AggregatedOdds> {
    const cacheKey = `${homeTeam}-${awayTeam}-${league || 'default'}`;
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.odds;
    }
    
    // Fetch from all sources in parallel
    const results = await Promise.allSettled(
      this.sources.map(source =>
        this.fetchFromSource(source, homeTeam, awayTeam, league)
      )
    );
    
    // Extract successful results
    const validSources: OddsSource[] = results
      .filter((r): r is PromiseFulfilledResult<OddsSource | null> => 
        r.status === 'fulfilled' && r.value !== null
      )
      .map(r => r.value as OddsSource);
    
    if (validSources.length === 0) {
      throw new Error('No odds sources available');
    }
    
    // Find best odds for each market
    const bestHome = this.findBestOdds(validSources, 'home');
    const bestDraw = this.findBestOdds(validSources, 'draw');
    const bestAway = this.findBestOdds(validSources, 'away');
    
    // Calculate spreads (difference between best and worst)
    const spread = {
      home: this.calculateSpread(validSources, 'home'),
      draw: this.calculateSpread(validSources, 'draw'),
      away: this.calculateSpread(validSources, 'away'),
    };
    
    // Determine liquidity based on source count and spread
    const liquidity = this.assessLiquidity(validSources.length, spread);
    
    const aggregated: AggregatedOdds = {
      home: bestHome.home,
      draw: bestDraw.draw,
      away: bestAway.away,
      sources: validSources,
      bestHome,
      bestDraw,
      bestAway,
      spread,
      liquidity,
      timestamp: Date.now(),
    };
    
    // Cache result
    this.cache.set(cacheKey, { odds: aggregated, timestamp: Date.now() });
    
    return aggregated;
  }
  
  /**
   * Fetch odds from a specific source
   */
  private async fetchFromSource(
    source: { name: string; endpoint: string; reliability: number },
    homeTeam: string,
    awayTeam: string,
    league?: string
  ): Promise<OddsSource | null> {
    try {
      const response = await fetch(source.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeTeam, awayTeam, league }),
      });
      
      if (!response.ok) {
        console.warn(`${source.name} failed: ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      
      return {
        name: source.name,
        home: data.home || data.homeWin || 0,
        draw: data.draw || 0,
        away: data.away || data.awayWin || 0,
        timestamp: Date.now(),
        reliability: source.reliability,
      };
    } catch (error) {
      console.warn(`${source.name} error:`, error);
      return null;
    }
  }
  
  /**
   * Find best odds for a market
   */
  private findBestOdds(
    sources: OddsSource[],
    market: 'home' | 'draw' | 'away'
  ): OddsSource {
    return sources.reduce((best, current) => {
      const bestValue = best[market];
      const currentValue = current[market];
      
      // Higher odds are better for betting
      return currentValue > bestValue ? current : best;
    });
  }
  
  /**
   * Calculate spread (max - min odds)
   */
  private calculateSpread(
    sources: OddsSource[],
    market: 'home' | 'draw' | 'away'
  ): number {
    const odds = sources.map(s => s[market]);
    return Math.max(...odds) - Math.min(...odds);
  }
  
  /**
   * Assess market liquidity
   */
  private assessLiquidity(
    sourceCount: number,
    spread: { home: number; draw: number; away: number }
  ): 'high' | 'medium' | 'low' {
    const avgSpread = (spread.home + spread.draw + spread.away) / 3;
    
    if (sourceCount >= 3 && avgSpread < 0.2) {
      return 'high';
    }
    if (sourceCount >= 2 && avgSpread < 0.4) {
      return 'medium';
    }
    return 'low';
  }
  
  /**
   * Track odds movement over time
   */
  async trackMovement(
    homeTeam: string,
    awayTeam: string,
    league?: string,
    _historicalWindow: number = 24 * 60 * 60 * 1000 // 24 hours
  ): Promise<Record<'home' | 'draw' | 'away', OddsMovement>> {
    // In production, this would query a time-series database
    // For now, return mock data based on current odds
    const current = await this.getOdds(homeTeam, awayTeam, league);
    
    // Mock historical odds (in production, fetch from DB)
    const historical = {
      home: current.home * 0.95,
      draw: current.draw * 1.02,
      away: current.away * 1.03,
    };
    
    return {
      home: this.calculateMovement(historical.home, current.home),
      draw: this.calculateMovement(historical.draw, current.draw),
      away: this.calculateMovement(historical.away, current.away),
    };
  }
  
  /**
   * Calculate odds movement direction and velocity
   */
  private calculateMovement(
    previous: number,
    current: number
  ): OddsMovement {
    const change = current - previous;
    const percentChange = (change / previous) * 100;
    
    let direction: 'up' | 'down' | 'stable';
    if (Math.abs(percentChange) < 1) {
      direction = 'stable';
    } else if (change > 0) {
      direction = 'up';
    } else {
      direction = 'down';
    }
    
    return {
      direction,
      change: percentChange,
      velocity: Math.abs(percentChange), // Simplified velocity
      timestamp: Date.now(),
    };
  }
  
  /**
   * Calculate Closing Line Value
   */
  async trackCLV(
    betId: string,
    placedOdds: number,
    homeTeam: string,
    awayTeam: string,
    league?: string
  ): Promise<CLVMetrics> {
    // Get current closing odds
    const current = await this.getOdds(homeTeam, awayTeam, league);
    const closingOdds = current.home; // Simplified - would track specific market
    
    const clv = ((closingOdds / placedOdds) - 1) * 100;
    
    let interpretation: 'excellent' | 'positive' | 'neutral' | 'negative';
    if (clv > 2) {
      interpretation = 'excellent';
    } else if (clv > 0) {
      interpretation = 'positive';
    } else if (clv > -2) {
      interpretation = 'neutral';
    } else {
      interpretation = 'negative';
    }
    
    return {
      clv,
      interpretation,
      oddsMovement: {
        opening: placedOdds,
        current: closingOdds,
        closing: closingOdds,
        change: closingOdds - placedOdds,
      },
    };
  }
  
  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const freeOddsAggregator = new FreeOddsAggregator();
