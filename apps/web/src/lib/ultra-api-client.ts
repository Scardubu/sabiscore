/**
 * Ultra API Client - Frontend client for SabiScore Ultra ML Service
 * Optimized for <30ms latency predictions with Redis caching
 */

const ULTRA_API_URL = process.env.NEXT_PUBLIC_ULTRA_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Request deduplication cache
const inFlightRequests = new Map<string, Promise<unknown>>();

// ============================================================================
// Types
// ============================================================================

export interface UltraMatchFeatures {
  match_id: string;
  home_team_id: number;
  away_team_id: number;
  league_id: number;
  match_date: string;
  
  // Team form (last 5 matches)
  home_last_5_wins?: number;
  home_last_5_draws?: number;
  home_last_5_losses?: number;
  away_last_5_wins?: number;
  away_last_5_draws?: number;
  away_last_5_losses?: number;
  
  // Goals statistics
  home_goals_scored_avg?: number;
  home_goals_conceded_avg?: number;
  away_goals_scored_avg?: number;
  away_goals_conceded_avg?: number;
  
  // Head-to-head
  h2h_home_wins?: number;
  h2h_draws?: number;
  h2h_away_wins?: number;
  
  // Odds (optional)
  home_odds?: number;
  draw_odds?: number;
  away_odds?: number;
}

export interface UltraPredictionResponse {
  match_id: string;
  home_win_prob: number;
  draw_prob: number;
  away_win_prob: number;
  predicted_outcome: 'home_win' | 'draw' | 'away_win';
  confidence: number;
  uncertainty: number;
  model_version: string;
  latency_ms: number;
  cached: boolean;
}

export interface UltraBatchPredictionResponse {
  predictions: UltraPredictionResponse[];
  total_latency_ms: number;
  avg_latency_ms: number;
}

export interface UltraHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  model_loaded: boolean;
  model_version: string;
  redis_connected: boolean;
  uptime_seconds: number;
  total_requests: number;
  cache_hit_rate: number;
}

// ============================================================================
// Ultra API Client
// ============================================================================

class UltraAPIClient {
  private baseUrl: string;
  private apiKey: string;
  private maxRetries: number = 2;
  private retryDelay: number = 500;

  constructor(baseUrl: string = ULTRA_API_URL, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey || process.env.NEXT_PUBLIC_ULTRA_API_KEY || 'dev-key-12345';
  }

  /**
   * Make a single match prediction
   * Target latency: <30ms (cache hit), <100ms (cache miss)
   */
  async predict(features: UltraMatchFeatures): Promise<UltraPredictionResponse> {
    const dedupeKey = `ultra:${features.match_id}`;
    
    return this.deduplicate(dedupeKey, () => 
      this.withRetry(async () => {
        const response = await fetch(`${this.baseUrl}/predict`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey,
          },
          body: JSON.stringify({ features }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.detail || `Prediction failed: ${response.statusText}`);
        }

        return response.json();
      })
    );
  }

  /**
   * Make batch predictions for multiple matches
   * More efficient for bulk operations
   */
  async predictBatch(matches: UltraMatchFeatures[]): Promise<UltraBatchPredictionResponse> {
    if (matches.length === 0) {
      return { predictions: [], total_latency_ms: 0, avg_latency_ms: 0 };
    }

    if (matches.length > 50) {
      throw new Error('Batch size exceeds maximum of 50 matches');
    }

    const response = await this.withRetry(async () => {
      const res = await fetch(`${this.baseUrl}/predict/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({ matches }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.detail || `Batch prediction failed: ${res.statusText}`);
      }

      return res.json();
    });

    return response;
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<UltraHealthResponse> {
    const response = await fetch(`${this.baseUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Clear prediction cache (admin operation)
   */
  async clearCache(): Promise<{ message: string }> {
    const response = await fetch(`${this.baseUrl}/cache/clear`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `Cache clear failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Convert legacy prediction request format to Ultra format
   */
  convertFromLegacy(
    matchId: string,
    homeTeam: string,
    awayTeam: string,
    league: string,
    features?: Partial<UltraMatchFeatures>
  ): UltraMatchFeatures {
    return {
      match_id: matchId,
      home_team_id: this.hashString(homeTeam) % 1000,
      away_team_id: this.hashString(awayTeam) % 1000,
      league_id: this.hashString(league) % 100,
      match_date: new Date().toISOString(),
      
      // Default form values
      home_last_5_wins: features?.home_last_5_wins ?? 2,
      home_last_5_draws: features?.home_last_5_draws ?? 1,
      home_last_5_losses: features?.home_last_5_losses ?? 2,
      away_last_5_wins: features?.away_last_5_wins ?? 2,
      away_last_5_draws: features?.away_last_5_draws ?? 1,
      away_last_5_losses: features?.away_last_5_losses ?? 2,
      
      // Default goals
      home_goals_scored_avg: features?.home_goals_scored_avg ?? 1.5,
      home_goals_conceded_avg: features?.home_goals_conceded_avg ?? 1.2,
      away_goals_scored_avg: features?.away_goals_scored_avg ?? 1.3,
      away_goals_conceded_avg: features?.away_goals_conceded_avg ?? 1.4,
      
      // Default H2H
      h2h_home_wins: features?.h2h_home_wins ?? 3,
      h2h_draws: features?.h2h_draws ?? 2,
      h2h_away_wins: features?.h2h_away_wins ?? 3,
      
      // Odds
      home_odds: features?.home_odds,
      draw_odds: features?.draw_odds,
      away_odds: features?.away_odds,
    };
  }

  /**
   * Convert Ultra response to legacy prediction format
   */
  convertToLegacy(
    response: UltraPredictionResponse,
    homeTeam: string,
    awayTeam: string,
    league: string
  ): {
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
    value_bets: never[];
    metadata: {
      model_version: string;
      processing_time_ms: number;
      engine: string;
    };
  } {
    return {
      match_id: response.match_id,
      home_team: homeTeam,
      away_team: awayTeam,
      league: league,
      predictions: {
        home_win: response.home_win_prob,
        draw: response.draw_prob,
        away_win: response.away_win_prob,
      },
      confidence: response.confidence,
      brier_score: this.calculateBrierScore(response),
      value_bets: [],
      metadata: {
        model_version: response.model_version,
        processing_time_ms: response.latency_ms,
        engine: 'ultra_ensemble',
      },
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private calculateBrierScore(response: UltraPredictionResponse): number {
    const probs = [response.home_win_prob, response.draw_prob, response.away_win_prob];
    return 1.0 - probs.reduce((sum, p) => sum + p * p, 0);
  }

  private async deduplicate<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = inFlightRequests.get(key) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }

    const promise = fn().finally(() => {
      inFlightRequests.delete(key);
    });

    inFlightRequests.set(key, promise);
    return promise;
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    retries: number = this.maxRetries
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
      // Network errors or 5xx server errors
      return (
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('500') ||
        error.message.includes('502') ||
        error.message.includes('503') ||
        error.message.includes('504')
      );
    }
    return false;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const ultraApiClient = new UltraAPIClient();

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Quick prediction using Ultra API with automatic format conversion
 */
export async function predictMatch(
  homeTeam: string,
  awayTeam: string,
  league: string,
  options?: {
    features?: Partial<UltraMatchFeatures>;
    useLegacyFormat?: boolean;
  }
): Promise<UltraPredictionResponse | ReturnType<UltraAPIClient['convertToLegacy']>> {
  const matchId = `${homeTeam.toLowerCase().replace(/\s+/g, '_')}_${awayTeam.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
  
  const features = ultraApiClient.convertFromLegacy(
    matchId,
    homeTeam,
    awayTeam,
    league,
    options?.features
  );
  
  const response = await ultraApiClient.predict(features);
  
  if (options?.useLegacyFormat) {
    return ultraApiClient.convertToLegacy(response, homeTeam, awayTeam, league);
  }
  
  return response;
}

/**
 * Check if Ultra API is available and healthy
 */
export async function isUltraApiHealthy(): Promise<boolean> {
  try {
    const health = await ultraApiClient.healthCheck();
    return health.status === 'healthy' && health.model_loaded;
  } catch {
    return false;
  }
}

export default UltraAPIClient;
