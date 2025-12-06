import { API_ORIGIN, API_V1_BASE } from './api-base';

/**
 * Frontend API client for Sabiscore predictions
 * Handles all communication with the FastAPI backend
 * Includes request deduplication and retry logic
 */

// In-flight request cache to prevent duplicate API calls
const IN_FLIGHT_REQUESTS = new Map<string, Promise<unknown>>();

export type ConfidenceIntervalMap = Record<string, [number, number]>;
export type ExplanationMap = Record<string, unknown>;

export interface Match {
  id: string;
  home_team: string;
  away_team: string;
  league: string;
  match_date: string;
  venue?: string;
  status: string;
  has_odds: boolean;
}

export interface Prediction {
  match_id: string;
  home_team: string;
  away_team: string;
  league: string;
  predictions: {
    home_win: number;
    draw: number;
    away_win: number;
  };
  confidence: number;
  brier_score: number;
  value_bets: ValueBet[];
  confidence_intervals?: ConfidenceIntervalMap;
  explanations?: ExplanationMap;
  metadata: {
    model_version: string;
    processing_time_ms?: number;
    data_freshness?: string;
  };
}

export interface ValueBet {
  match_id: string;
  market: string;
  odds: number;
  fair_probability: number;
  implied_probability: number;
  edge_percent: number;
  edge_ngn: number;
  kelly_stake_ngn: number;
  kelly_fraction: number;
  clv_ngn: number;
  confidence: number;
  expected_roi: number;
  created_at?: string;
  pinnacle_close?: number;
  // Legacy aliases for backward compatibility
  home_team?: string;
  away_team?: string;
  league?: string;
  bet_type?: string;
  recommended_odds?: number;
  market_odds?: number;
  match_date?: string;
}

export interface ValueBetSummary {
  total_bets: number;
  avg_edge: number;
  avg_confidence: number;
  total_potential_edge_ngn: number;
  by_league: Record<string, number>;
  by_market: Record<string, number>;
}

export interface PredictionRequest {
  match_id?: string;
  home_team: string;
  away_team: string;
  league: string;
  odds?: {
    home_win?: number;
    draw?: number;
    away_win?: number;
  };
  bankroll?: number;
}

class SabiscoreAPIClient {
  private origin: string;
  private apiV1Base: string;
  private maxRetries = 2;
  private retryDelay = 1000;

  constructor(origin: string = API_ORIGIN, apiV1Base: string = API_V1_BASE) {
    this.origin = origin.replace(/\/+$/, '');
    this.apiV1Base = apiV1Base.replace(/\/+$/, '');
  }

  /**
   * Retry helper for transient network failures
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    retries = this.maxRetries
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0 && this.isRetryableError(error)) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.withRetry(fn, retries - 1);
      }
      throw error;
    }
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('network') || 
             message.includes('timeout') || 
             message.includes('503') ||
             message.includes('504');
    }
    return false;
  }

  /**
   * Fetch upcoming matches
   */
  async getUpcomingMatches(params?: {
    league?: string;
    days_ahead?: number;
    limit?: number;
  }): Promise<{ matches: Match[]; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.league) queryParams.append('league', params.league);
    if (params?.days_ahead) queryParams.append('days_ahead', params.days_ahead.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const url = `${this.apiV1Base}/matches/upcoming?${queryParams.toString()}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Disable caching for fresh data
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch matches: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching upcoming matches:', error);
      throw error;
    }
  }

  /**
   * Get match details
   */
  async getMatchDetail(matchId: string): Promise<Match> {
    const url = `${this.apiV1Base}/matches/${matchId}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch match details: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching match details:', error);
      throw error;
    }
  }

  /**
   * Deduplicate concurrent requests for the same resource
   */
  private async deduplicate<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = IN_FLIGHT_REQUESTS.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = fn().finally(() => {
      IN_FLIGHT_REQUESTS.delete(key);
    });

    IN_FLIGHT_REQUESTS.set(key, promise);
    return promise;
  }

  /**
   * Create a new prediction
   */
  async createPrediction(request: PredictionRequest): Promise<Prediction> {
    const url = `${this.apiV1Base}/predictions/`;
    const dedupeKey = `pred:${request.home_team}:${request.away_team}:${request.league}`;
    
    return this.deduplicate(dedupeKey, () => this.withRetry(async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to create prediction: ${response.statusText}`);
      }

      return await response.json();
    }));
  }

  /**
   * Get existing prediction for a match
   */
  async getPrediction(matchId: string): Promise<Prediction> {
    const url = `${this.apiV1Base}/predictions/${matchId}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('PREDICTION_NOT_FOUND');
        }
        if (response.status === 410) {
          throw new Error('PREDICTION_STALE');
        }
        throw new Error(`Failed to fetch prediction: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching prediction:', error);
      throw error;
    }
  }

  /**
   * Get today's value bets (via /predictions/value-bets/today)
   */
  async getTodaysValueBets(params?: {
    min_edge?: number;
    min_confidence?: number;
    league?: string;
    limit?: number;
  }): Promise<ValueBet[]> {
    const queryParams = new URLSearchParams();
    if (params?.min_edge) queryParams.append('min_edge', params.min_edge.toString());
    if (params?.min_confidence) queryParams.append('min_confidence', params.min_confidence.toString());
    if (params?.league) queryParams.append('league', params.league);
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const url = `${this.apiV1Base}/predictions/value-bets/today?${queryParams.toString()}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch value bets: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching value bets:', error);
      throw error;
    }
  }

  /**
   * List value bets with filters (via /value-bets/)
   */
  async listValueBets(params?: {
    league?: string;
    min_edge?: number;
    min_confidence?: number;
    max_results?: number;
  }): Promise<ValueBet[]> {
    const queryParams = new URLSearchParams();
    if (params?.league) queryParams.append('league', params.league);
    if (params?.min_edge) queryParams.append('min_edge', params.min_edge.toString());
    if (params?.min_confidence) queryParams.append('min_confidence', params.min_confidence.toString());
    if (params?.max_results) queryParams.append('max_results', params.max_results.toString());

    const url = `${this.apiV1Base}/value-bets/?${queryParams.toString()}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to list value bets: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error listing value bets:', error);
      throw error;
    }
  }

  /**
   * Get value bet summary statistics
   */
  async getValueBetSummary(): Promise<ValueBetSummary> {
    const url = `${this.apiV1Base}/value-bets/summary`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to get value bet summary: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting value bet summary:', error);
      throw error;
    }
  }

  /**
   * Get value bets for a specific match
   */
  async getMatchValueBets(matchId: string): Promise<ValueBet[]> {
    const url = `${this.apiV1Base}/value-bets/${matchId}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('MATCH_NOT_FOUND');
        }
        throw new Error(`Failed to get match value bets: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting match value bets:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const url = `${this.origin}/health`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('API unhealthy');
      }

      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const apiClient = new SabiscoreAPIClient();

// Export class for custom instances
export default SabiscoreAPIClient;
