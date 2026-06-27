/**
 * Ultra API Client - Frontend client for SabiScore Ultra ML Service
 * Optimized for <30ms latency predictions with Redis caching
 */

// In the browser, use a relative base so /api/v1/* requests go through the
// Vercel rewrite (same-origin, no CORS). On the server use the absolute URL.
const ULTRA_API_URL =
  typeof window !== 'undefined'
    ? ''
    : (process.env.SABISCORE_BACKEND_URL || 'http://localhost:8000');
const ULTRA_API_PREFIX = '/api/v1/ultra'; // Ultra predictions API prefix

/**
 * Normalize Ultra API URL - handles cases where env var includes prefix or not
 * @param baseUrl - The base URL (may or may not include /api/v1/ultra)
 * @returns Properly formatted URL with prefix, no trailing slash
 */
function normalizeUltraUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  // If URL already ends with the prefix path, don't add it again
  if (base.endsWith('/ultra') || base.endsWith('/api/v1/ultra')) {
    return base;
  }
  // If URL ends with /api/v1, add /ultra
  if (base.endsWith('/api/v1')) {
    return `${base}/ultra`;
  }
  // Otherwise add the full prefix
  return `${base}${ULTRA_API_PREFIX}`;
}

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
  private apiKey?: string;
  private maxRetries: number = 2;
  private retryDelay: number = 500;

  constructor(baseUrl: string = ULTRA_API_URL, apiKey?: string) {
    // Normalize URL to handle env vars with or without prefix
    this.baseUrl = normalizeUltraUrl(baseUrl);
    this.apiKey = apiKey;
  }

  /**
   * Make a single match prediction
   * Target latency: <30ms (cache hit), <100ms (cache miss)
   */
  async predict(features: UltraMatchFeatures): Promise<UltraPredictionResponse> {
    const dedupeKey = `ultra:${features.match_id}`;
    
    return this.deduplicate(dedupeKey, () => 
      this.withRetry(async () => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (this.apiKey && typeof window === 'undefined') {
          headers['X-API-Key'] = this.apiKey;
        }
        const response = await fetch(`${this.baseUrl}/predict`, {
          method: 'POST',
          headers,
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
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.apiKey && typeof window === 'undefined') {
        headers['X-API-Key'] = this.apiKey;
      }
      const res = await fetch(`${this.baseUrl}/predict/batch`, {
        method: 'POST',
        headers,
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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey && typeof window === 'undefined') {
      headers['X-API-Key'] = this.apiKey;
    }
    const response = await fetch(`${this.baseUrl}/cache/clear`, {
      method: 'DELETE',
      headers,
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
    if (!features) {
      throw new Error('Production inference requires backend-resolved features; synthetic defaults are disabled.');
    }
    const required: Array<keyof UltraMatchFeatures> = [
      'home_last_5_wins',
      'home_last_5_draws',
      'home_last_5_losses',
      'away_last_5_wins',
      'away_last_5_draws',
      'away_last_5_losses',
      'home_goals_scored_avg',
      'home_goals_conceded_avg',
      'away_goals_scored_avg',
      'away_goals_conceded_avg',
      'h2h_home_wins',
      'h2h_draws',
      'h2h_away_wins',
    ];
    const missing = required.filter((field) => features[field] == null);
    if (missing.length > 0) {
      throw new Error(`Missing backend-resolved feature fields: ${missing.join(', ')}`);
    }
    return {
      match_id: matchId,
      home_team_id: this.hashString(homeTeam) % 1000,
      away_team_id: this.hashString(awayTeam) % 1000,
      league_id: this.hashString(league) % 100,
      match_date: new Date().toISOString(),
      
      // Default form values
      home_last_5_wins: features.home_last_5_wins,
      home_last_5_draws: features.home_last_5_draws,
      home_last_5_losses: features.home_last_5_losses,
      away_last_5_wins: features.away_last_5_wins,
      away_last_5_draws: features.away_last_5_draws,
      away_last_5_losses: features.away_last_5_losses,
      
      // Default goals
      home_goals_scored_avg: features.home_goals_scored_avg,
      home_goals_conceded_avg: features.home_goals_conceded_avg,
      away_goals_scored_avg: features.away_goals_scored_avg,
      away_goals_conceded_avg: features.away_goals_conceded_avg,
      
      // Default H2H
      h2h_home_wins: features.h2h_home_wins,
      h2h_draws: features.h2h_draws,
      h2h_away_wins: features.h2h_away_wins,
      
      // Odds
      home_odds: features.home_odds,
      draw_odds: features.draw_odds,
      away_odds: features.away_odds,
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
