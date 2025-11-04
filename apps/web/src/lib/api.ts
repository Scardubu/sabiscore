// Edge-optimized API client for Sabiscore
// Supports Cloudflare KV → Upstash Redis → PostgreSQL cache hierarchy

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  database: boolean;
  models: boolean;
  cache: boolean;
  cache_metrics: any;
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
  explanation: Record<string, any>;
  risk_assessment: RiskAssessment;
  narrative: string;
  generated_at: string;
  confidence_level: number;
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
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new APIError("Request timeout", 408, "TIMEOUT");
    }
    throw error;
  }
}

export async function healthCheck(): Promise<HealthResponse> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/health`, {
      next: { revalidate: 60 }, // Cache for 60 seconds
    });

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
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/insights`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ matchup, league }),
        // Force fresh data for insights (no cache)
        cache: "no-store",
      },
      30000 // 30 second timeout for insights generation
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

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Insights fetch error:", error);
    throw error;
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

    return await response.json();
  },
};

export { APIError };
