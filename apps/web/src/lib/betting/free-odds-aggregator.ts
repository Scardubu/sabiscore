/**
 * Production-disabled odds aggregation compatibility layer.
 *
 * Browser code must not call provider APIs directly. Use the `/intelligence`
 * workflow, which proxies through the FastAPI provider gateway and strict
 * betting engine.
 */

import type { Odds } from "./kelly-optimizer";

export interface OddsSource {
  name: string;
  home: number;
  draw: number;
  away: number;
  timestamp: number;
  reliability: number;
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
  liquidity: "high" | "medium" | "low";
}

export interface OddsMovement {
  direction: "up" | "down" | "stable";
  change: number;
  velocity: number;
  timestamp: number;
}

export interface CLVMetrics {
  clv: number;
  interpretation: "excellent" | "positive" | "neutral" | "negative";
  oddsMovement: {
    opening: number;
    current: number;
    closing?: number;
    change: number;
  };
}

const DISABLED_MESSAGE =
  "Client odds aggregation is disabled. Use backend provider odds snapshots from /intelligence.";

export class FreeOddsAggregator {
  async getOdds(
    _homeTeam?: string,
    _awayTeam?: string,
    _league?: string
  ): Promise<AggregatedOdds> {
    throw new Error(DISABLED_MESSAGE);
  }

  async trackMovement(
    _homeTeam?: string,
    _awayTeam?: string,
    _league?: string,
    _historicalWindow?: number
  ): Promise<Record<"home" | "draw" | "away", OddsMovement>> {
    throw new Error(DISABLED_MESSAGE);
  }

  async trackCLV(
    _betId?: string,
    _placedOdds?: number,
    _homeTeam?: string,
    _awayTeam?: string,
    _league?: string
  ): Promise<CLVMetrics> {
    throw new Error(DISABLED_MESSAGE);
  }

  clearCache(): void {
    return undefined;
  }

  getCacheStats(): { size: number; entries: string[] } {
    return { size: 0, entries: [] };
  }
}

export const freeOddsAggregator = new FreeOddsAggregator();
