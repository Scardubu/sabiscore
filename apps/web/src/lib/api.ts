// Edge-optimized API client for Sabiscore
// Supports Cloudflare KV → Upstash Redis → PostgreSQL cache hierarchy

import { API_ORIGIN, API_V1_BASE } from "./api-base";

// Tunables for slow upstreams (Render free tier can stall)
// NOTE: Vercel Hobby has 10s function timeout, so we use 8s to leave headroom
const INSIGHTS_TIMEOUT_MS = Number(process.env.INSIGHTS_TIMEOUT_MS ?? process.env.NEXT_PUBLIC_INSIGHTS_TIMEOUT_MS ?? 8000);
const INSIGHTS_MAX_RETRIES = Number(process.env.INSIGHTS_MAX_RETRIES ?? process.env.NEXT_PUBLIC_INSIGHTS_MAX_RETRIES ?? 0);
const INSIGHTS_OFFLINE = (process.env.INSIGHTS_OFFLINE ?? process.env.NEXT_PUBLIC_INSIGHTS_OFFLINE) === "true";

// Performance optimization: Enable connection reuse
const ENABLE_KEEPALIVE = true;

export interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  database: boolean;
  models: boolean;
  cache: boolean;
  cache_metrics: Record<string, unknown>;
  latency_ms: number;
}

export interface PredictionSummary {
  home_win_prob: number;
  draw_prob: number;
  away_win_prob: number;
  prediction: string;
  confidence: number;
}

export interface XGAnalysis {
  home_xg: number;
  away_xg: number;
  total_xg: number;
  xg_difference: number;
}

export interface ValueBetQuality {
  quality_score: number;
  tier: string;
  recommendation: string;
  ev_contribution: number;
  confidence_contribution: number;
  liquidity_contribution: number;
}

export interface ValueBet {
  bet_type: string;
  market_odds: number;
  model_prob: number;
  market_prob: number;
  expected_value: number;
  value_pct: number;
  kelly_stake: number;
  confidence_interval: number[];
  edge: number;
  recommendation: string;
  quality: ValueBetQuality;
}

export interface MonteCarloData {
  simulations: number;
  distribution: Record<string, number>;
  confidence_intervals: Record<string, number[]>;
}

export interface Scenario {
  name: string;
  probability: number;
  home_score: number;
  away_score: number;
  result: string;
}

export interface RiskAssessment {
  risk_level: string;
  confidence_score: number;
  value_available: boolean;
  best_bet?: ValueBet | null;
  distribution: Record<string, number>;
  recommendation: string;
}

export interface Metadata {
  matchup: string;
  league: string;
  home_team: string;
  away_team: string;
}

export interface TransformationStep {
  step: string;
  function: string;
  timestamp: string;
}

export interface DataProvenance {
  source: Record<string, unknown>;
  computed_from: string[];
  transformations: TransformationStep[];
  real_time_adjusted: boolean;
  drift_detected?: Record<string, unknown> | null;
  validation_status: string;
}

export interface InsightsResponse {
  matchup: string;
  league: string;
  metadata: Metadata;
  predictions: PredictionSummary;
  xg_analysis: XGAnalysis;
  value_analysis: {
    bets: ValueBet[];
    edges: Record<string, number>;
    best_bet?: ValueBet | null;
    summary: string;
  };
  monte_carlo: MonteCarloData;
  scenarios: Scenario[];
  explanation: Record<string, unknown>;
  risk_assessment: RiskAssessment;
  narrative: string;
  generated_at: string;
  confidence_level: number;
  provenance?: DataProvenance | null;
}

class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = "APIError";
  }

  // Ensure proper serialization for logging
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
    };
  }

  // Proper string representation
  toString() {
    return `${this.name}: ${this.message}${this.status ? ` (${this.status})` : ''}${this.code ? ` [${this.code}]` : ''}`;
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      // Enable keep-alive for connection reuse
      keepalive: ENABLE_KEEPALIVE,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new APIError("The prediction engine is warming up. Please try again in 30 seconds.", 408, "TIMEOUT");
    }
    // Handle network errors gracefully
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new APIError("Network error - please check your connection", 0, "NETWORK_ERROR");
    }
    throw error;
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  timeout = 10000,
  maxRetries = 2
): Promise<Response> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchWithTimeout(url, options, timeout);
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on client errors (4xx)
      if (error instanceof APIError && error.status && error.status >= 400 && error.status < 500) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }
  
  throw lastError || new APIError("Max retries exceeded", 503, "MAX_RETRIES_EXCEEDED");
}

export async function healthCheck(): Promise<HealthResponse> {
  try {
    const response = await fetchWithRetry(`${API_ORIGIN}/health`, {
      next: { revalidate: 60 }, // Cache for 60 seconds
    }, 5000, 1); // 5s timeout, 1 retry

    if (!response.ok) {
      throw new APIError(
        "Health check failed",
        response.status,
        "HEALTH_CHECK_FAILED"
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Health check error:", error);
    throw error;
  }
}

export async function getMatchInsights(
  matchup: string,
  league: string = "EPL"
): Promise<InsightsResponse> {
  // Allow skipping upstream calls during local dev when the API is cold or unreachable
  if (INSIGHTS_OFFLINE) {
    return {
      matchup,
      league,
      metadata: { matchup, league, home_team: matchup.split(" vs ")[0] || "Home", away_team: matchup.split(" vs ")[1] || "Away" },
      predictions: { home_win_prob: 0.33, draw_prob: 0.33, away_win_prob: 0.34, prediction: "away", confidence: 0.51 },
      xg_analysis: { home_xg: 1.2, away_xg: 1.3, total_xg: 2.5, xg_difference: -0.1 },
      value_analysis: { bets: [], edges: {}, best_bet: null, summary: "Offline fallback mode" },
      monte_carlo: { simulations: 0, distribution: {}, confidence_intervals: {} },
      scenarios: [],
      explanation: {},
      risk_assessment: { risk_level: "unknown", confidence_score: 0, value_available: false, distribution: {}, recommendation: "offline" },
      narrative: "Insights unavailable (offline mode)",
      generated_at: new Date().toISOString(),
      confidence_level: 0,
      provenance: null,
    };
  }

  try {
    const response = await fetchWithRetry(
      `${API_V1_BASE}/insights`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ matchup, league }),
        // Force fresh data for insights (no cache)
        cache: "no-store",
      },
      INSIGHTS_TIMEOUT_MS,
      INSIGHTS_MAX_RETRIES
    );

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        // Ignore JSON parse errors
      }

      throw new APIError(errorMessage, response.status, "INSIGHTS_ERROR");
    }

  const data = (await response.json()) as InsightsResponse;
  return data;
  } catch (error) {
    console.error("Insights fetch error:", error);
    // Normalize errors so callers can present friendly messages
    if (error instanceof APIError) throw error;
    throw new APIError((error as Error).message || "Unknown error", undefined, "UNKNOWN_ERROR");
  }
}

// Client-side API client for use in React components
export const apiClient = {
  healthCheck,
  
  async generateInsights(matchup: string, league: string = "EPL"): Promise<InsightsResponse> {
    const response = await fetch("/api/v1/insights", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ matchup, league }),
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        // Ignore
      }
      throw new APIError(errorMessage, response.status, "INSIGHTS_ERROR");
    }

    return (await response.json()) as InsightsResponse;
  },
};

export function parseApiError(error: unknown): { message: string; code?: string } {
  if (error instanceof APIError) {
    return { message: error.message, code: error.code };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return { message: "An unexpected error occurred" };
}

export { APIError };
