// Edge-optimized API client for Sabiscore
// Supports Cloudflare KV → Upstash Redis → PostgreSQL cache hierarchy


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

// ── Phase 6 types ────────────────────────────────────────────────────────────

export interface CredibleInterval {
  lower: number;
  upper: number;
}

export interface UncertaintyBreakdown {
  epistemic_unc: number;
  aleatoric_unc: number;
  concentration: number;
  credible_interval: CredibleInterval;
  /** "LOW_EVIDENCE" when epistemic > threshold; "OK" otherwise. C12 */
  confidence_tier?: "LOW_EVIDENCE" | "OK";
}

export interface CausalSummary {
  top_drivers: string[];
  collider_warnings: string[];
  source?: string | null;
  status: string;
}

export interface RLRecommendation {
  stake_fraction: number;
  abstain: boolean;
  reward_components: Record<string, number>;
  reason?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────

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
  uncertainty?: UncertaintyBreakdown | null;
  causal_summary?: CausalSummary | null;
  rl_recommendation?: RLRecommendation | null;
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
    // Use the Next.js proxy route to avoid cross-origin requests from the browser.
    // The /api/health route is same-origin from the client's perspective and proxies
    // to the Render backend server-side.
    const response = await fetchWithRetry('/api/health', {
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
      uncertainty: null,
      causal_summary: null,
      rl_recommendation: null,
    };
  }

  try {
    const response = await fetchWithRetry(
      `/api/insights`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ matchup, league }),
        cache: "no-store",
      },
      INSIGHTS_TIMEOUT_MS,
      INSIGHTS_MAX_RETRIES
    );

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");

      // HTML body = Render suspension page = cold start
      const bodyLower = bodyText.trimStart().toLowerCase();
      if (bodyLower.startsWith("<!doctype") || bodyLower.startsWith("<html")) {
        throw new APIError(
          "The prediction engine is warming up. Please wait a moment.",
          503,
          "COLD_START",
        );
      }

      // Any 503 from our proxy = cold_start (proxy always sets this on Render suspension)
      if (response.status === 503) {
        let detail = "The prediction engine is warming up.";
        try {
          const errJson = JSON.parse(bodyText) as Record<string, string>;
          detail = errJson.detail || errJson.error || detail;
        } catch { /* ignore parse errors */ }
        throw new APIError(detail, 503, "COLD_START");
      }

      // Other HTTP errors
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errJson = JSON.parse(bodyText) as Record<string, string>;
        errorMessage = errJson.detail || errJson.message || errJson.error || errorMessage;
      } catch { /* ignore */ }

      throw new APIError(errorMessage, response.status, "INSIGHTS_ERROR");
    }

    return (await response.json()) as InsightsResponse;
  } catch (error) {
    console.error("Insights fetch error:", error);
    if (error instanceof APIError) throw error;
    const msg = error instanceof Error ? error.message : "Unknown error";
    // Network/parse failures during cold-start should show the warm-up UI
    throw new APIError(msg, 503, "COLD_START");
  }
}

// Client-side API client for use in React components
export const apiClient = {
  healthCheck,
  
  async generateInsights(matchup: string, league: string = "EPL"): Promise<InsightsResponse> {
    const response = await fetch("/api/insights", {
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

// ---------------------------------------------------------------------------
// Phase 7-D: FullMatchAnalysisResponse types and client
// ---------------------------------------------------------------------------

/** CLV-centered advisory actionability block (Sprint 4 Slice A). */
export interface MatchActionability {
  /** Composite 0.0–1.0 score: confidence×0.40 + market_alignment×0.30 + drift×0.20 + completeness×0.10 */
  edge_quality_score: number;
  /** Closing-line value % points. Always null pre-kick-off. */
  clv_pct: number | null;
  /** Implied-probability drift since opening odds snapshot (positive = sharp-money confirms model). Null if DATA_GAP. */
  closing_line_convergence_delta: number | null;
  /** Fractional Kelly × 100. 0.0 when abstain=true or edge quality below threshold. */
  suggested_stake_pct: number;
  /** True when RL layer advises no bet OR edge quality is below the configured threshold. */
  abstain: boolean;
  /** Human-readable abstain reason. Null when abstain=false. */
  abstain_reason: string | null;
  /** Up to 3 key signals behind this edge assessment (causal drivers, market edge, drift). */
  top_evidence: string[];
  /** Data-gap or quality warnings that reduce confidence. */
  caveats: string[];
}

export interface FullMatchEnsemble {
  home_win_prob: number;
  draw_prob: number;
  away_win_prob: number;
  prediction: string;
  confidence: number;
  league: string;
  model_version: string;
  /** Phase D: calibration method applied ("raw" | "isotonic" | "platt" | …). */
  calibration_method?: string;
  /** Phase D: true when a FittedCalibrator was applied at inference time. */
  calibration_applied?: boolean;
  /** Phase D: true when BivariatePoissonDrawOverlay was applied (alpha > 0). */
  overlay_applied?: boolean;
}

export interface FullMatchUncertainty {
  epistemic_unc: number;
  aleatoric_unc: number;
  concentration: number;
  credible_interval: [number, number];
  confidence_tier: string;
}

export interface FullMatchRLRecommendation {
  stake_fraction: number;
  abstain: boolean;
  reason: string;
  reward_components: Record<string, number>;
}

export interface FullMatchEloContext {
  home_elo: number;
  away_elo: number;
  elo_difference: number;
  home_elo_trend_5: number;
  away_elo_trend_5: number;
  elo_momentum_cross: number;
}

export interface FullMatchOddsEdge {
  market: string;
  market_odds: number;
  model_prob: number;
  edge: number;
  kelly_stake: number;
}

export interface FullMatchAnalysisResponse {
  match_id: string;
  verdict: "HIGH_CONVICTION" | "ACTIONABLE" | "SPECULATIVE" | "HOLD" | "PARTIAL";
  ensemble: FullMatchEnsemble;
  uncertainty: FullMatchUncertainty;
  causal_drivers: string[];
  rl_recommendation: FullMatchRLRecommendation;
  elo_context: FullMatchEloContext;
  odds_edge: FullMatchOddsEdge | null;
  narrative: string;
  partial_intelligence: boolean;
  data_gaps: string[];
  /** Age in seconds of the oldest live feature source used. 0 means cache-fresh or unavailable. */
  staleness_seconds: number;
  /** "LIVE" | "RECENT" | "STALE" — derived from staleness_seconds on the backend. */
  freshness_tag: "LIVE" | "RECENT" | "STALE";
  /**
   * Per-feature staleness map (Phase 8 Sprint 4). Keys are canonical feature names.
   * null value = DATA_GAP (feature could not be live-computed).
   * 0 = fresh (parquet/cache). >0 = staleness in seconds.
   */
  feature_freshness_seconds: Record<string, number | null>;
  /** Per-feature data source identifier (Phase 8 Sprint 4). e.g. "odds_service", "league_standings". */
  feature_source: Record<string, string>;
  /** CLV-centered advisory actionability block (Sprint 4 Slice A). Null when not computed. */
  actionability: MatchActionability | null;
  generated_at: string;
  /** Phase F: composite importance score 0.0–1.0. ≥0.70 = High Stakes (UCL knockout, title run-ins). Null when feature not computed. */
  match_importance_score?: number | null;
  /** Phase F: competition stage string (qualifying | group | r16 | qf | sf | final). UCL only. */
  competition_stage?: string | null;
  /**
   * Phase 9 / V4 shadow-mode candidate metadata. Present only when USE_PHASE9_CANDIDATE_FEATURES=true.
   * Never influences probabilities, verdicts, or value bets — informational only.
   */
  phase9_candidate_features?: {
    hybrid_xg?: Record<string, number>;
    market_efficiency?: {
      bookmaker_margin?: number;
      market_complete?: boolean;
      market_sharpness?: "sharp" | "standard" | "unknown";
      has_value?: boolean;
      value_bets?: Array<{
        outcome: string;
        ev: number;
        edge: number;
        kelly_fraction?: number;
      }>;
      recommended_kelly_fraction?: number;
      clv_available?: boolean;
    };
  } | null;
  /** True when phase9_candidate_features is present and phase9_shadow_only=true. */
  phase9_shadow_only?: boolean;
}

export async function getFullAnalysis(
  matchId: string,
  league: string = "EPL",
): Promise<FullMatchAnalysisResponse> {
  const url = `/api/full-analysis/${encodeURIComponent(matchId)}?league=${encodeURIComponent(league)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
      signal: controller.signal,
    } as RequestInit);

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const err = await response.json();
        if (err.error === "cold_start") {
          throw new APIError(
            err.detail || "The prediction engine is warming up.",
            503,
            "COLD_START",
          );
        }
        detail = err.detail || err.error || detail;
      } catch (parseErr) {
        if (parseErr instanceof APIError) throw parseErr;
      }
      throw new APIError(detail, response.status, "FULL_ANALYSIS_ERROR");
    }

    return (await response.json()) as FullMatchAnalysisResponse;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new APIError("Full analysis timed out (8s)", 408, "FULL_ANALYSIS_TIMEOUT");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Phase 8 Sprint 2: Phase8FeaturesResponse types and client
// ---------------------------------------------------------------------------

export interface Phase8FeatureValue {
  name: string;
  value: number;
  is_data_gap: boolean;
  /**
   * Seconds since this feature's live data source was last updated.
   * null = DATA_GAP (not computable). 0 = fresh. >0 = staleness in seconds.
   */
  freshness_seconds: number | null;
  source: string | null;
}

export interface Phase8FeatureGroup {
  group_id: string;
  label: string;
  description: string;
  reference: string;
  features: Phase8FeatureValue[];
  all_available: boolean;
  /** Max staleness across the group's live features (seconds). 0 if all are DATA_GAP. */
  group_freshness_seconds: number;
}

export interface Phase8FeaturesResponse {
  match_id: string;
  league: string;
  /** "ok" | "partial" | "disabled" */
  status: string;
  data_gaps: string[];
  feature_groups: Phase8FeatureGroup[];
  /**
   * Per-feature staleness map for Phase 8 features.
   * null = DATA_GAP. 0 = fresh. >0 = staleness in seconds.
   */
  feature_freshness_seconds: Record<string, number | null>;
  total_phase8_features: number;
  available_features: number;
  phase8_enabled: boolean;
  source: string;
}

/**
 * Fetch Phase 8 enriched feature values for a match from the backend proxy.
 * The backend route is: GET /matches/upcoming/{match_id}/phase8-features
 * Proxied via Next.js API at: /api/phase8-features/{matchId}
 */
export async function getPhase8Features(
  matchId: string,
  league: string = "EPL",
): Promise<Phase8FeaturesResponse> {
  const url = `/api/phase8-features/${encodeURIComponent(matchId)}?league=${encodeURIComponent(league)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
      signal: controller.signal,
    } as RequestInit);

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const err = await response.json();
        if (err.error === "cold_start") {
          throw new APIError(
            err.detail || "The prediction engine is warming up.",
            503,
            "COLD_START",
          );
        }
        detail = err.detail || err.error || detail;
      } catch (parseErr) {
        if (parseErr instanceof APIError) throw parseErr;
      }
      throw new APIError(detail, response.status, "PHASE8_FEATURES_ERROR");
    }

    return (await response.json()) as Phase8FeaturesResponse;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new APIError("Phase 8 features timed out (8s)", 408, "PHASE8_FEATURES_TIMEOUT");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Sprint 4 Slice A: Off-season status endpoint
// ---------------------------------------------------------------------------

export interface OffseasonDataAvailability {
  historical_results: boolean;
  elo_ratings: boolean;
  market_odds: boolean;
  form_stats: boolean;
  team_metadata: boolean;
}

export interface OffseasonStatusResponse {
  league: string;
  league_slug: string;
  season_status: "IN_SEASON" | "OFF_SEASON" | "UNKNOWN";
  current_season_label: string;
  current_season_end: string;
  next_season_start: string;
  days_until_next_season: number | null;
  data_availability: OffseasonDataAvailability;
  prediction_advisory: string;
  queried_at: string;
}

/**
 * Fetch off-season status for a league.
 * Proxied via Next.js API at: /api/offseason/{league}
 * Cached 1 hour at edge (s-maxage=3600).
 */
export async function getOffseasonStatus(
  league: string,
): Promise<OffseasonStatusResponse> {
  const url = `/api/offseason/${encodeURIComponent(league)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
      signal: controller.signal,
    } as RequestInit);

    if (!response.ok) {
      // Graceful degradation: return UNKNOWN status rather than throwing
      return {
        league,
        league_slug: league.toLowerCase(),
        season_status: "UNKNOWN",
        current_season_label: "",
        current_season_end: "",
        next_season_start: "",
        days_until_next_season: null,
        data_availability: {
          historical_results: true,
          elo_ratings: true,
          market_odds: false,
          form_stats: true,
          team_metadata: true,
        },
        prediction_advisory: "Season status unavailable.",
        queried_at: new Date().toISOString(),
      };
    }

    return (await response.json()) as OffseasonStatusResponse;
  } catch {
    // Network error — degrade gracefully, don't block fixture rendering
    return {
      league,
      league_slug: league.toLowerCase(),
      season_status: "UNKNOWN",
      current_season_label: "",
      current_season_end: "",
      next_season_start: "",
      days_until_next_season: null,
      data_availability: {
        historical_results: true,
        elo_ratings: true,
        market_odds: false,
        form_stats: true,
        team_metadata: true,
      },
      prediction_advisory: "Season status unavailable.",
      queried_at: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Sprint 4: Upcoming matches with edge_quality_score and offseason contract
// ---------------------------------------------------------------------------

export interface UpcomingMatchPrediction {
  home_win: number;
  draw: number;
  away_win: number;
  confidence: number;
  model_version: string;
}

export interface UpcomingMatchValueBet {
  outcome: string;
  edge_pct: number;
  kelly_stake_pct: number;
  clv_cents: number;
  recommended_stake_ngn: number;
  confidence: number;
}

export interface UpcomingMatch {
  match_id: string;
  home_team: string;
  away_team: string;
  league: string;
  match_date: string;
  venue: string | null;
  status: string;
  predictions: UpcomingMatchPrediction | null;
  value_bets: UpcomingMatchValueBet[];
  has_value: boolean;
  best_value_bet: UpcomingMatchValueBet | null;
  data_gaps: string[];
  staleness_seconds: number;
  source: string;
  /** Composite 0–1 edge quality: 0.40×confidence + 0.30×market_edge + 0.20×freshness + 0.10×completeness. */
  edge_quality_score: number | null;
  /** Closing-line value %. Always null pre-kick-off. */
  clv_pct: number | null;
}

export interface UpcomingMatchesResponse {
  upcoming_matches: UpcomingMatch[];
  total: number;
  matches_with_value: number;
  avg_edge_pct: number;
  cache_hit: boolean;
  ttl_seconds: number;
  source: string;
  /** True when the fixture list is genuinely empty and the league is in an inter-season break. */
  offseason: boolean;
  /** ISO 8601 date of the next season kick-off. Null when not offseason. */
  next_season_start: string | null;
}

/** Fetch upcoming matches with predictions and edge quality scores. */
export async function getUpcomingMatches(
  params: { league?: string; days_ahead?: number; limit?: number } = {},
): Promise<UpcomingMatchesResponse> {
  const qs = new URLSearchParams();
  if (params.league) qs.set("league", params.league);
  if (params.days_ahead !== undefined) qs.set("days_ahead", String(params.days_ahead));
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  const url = `/api/upcoming${qs.size ? `?${qs}` : ""}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
      signal: controller.signal,
    } as RequestInit);

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const err = await response.json();
        detail = err.detail || err.error || detail;
      } catch { /* ignore */ }
      throw new APIError(detail, response.status, "UPCOMING_MATCHES_ERROR");
    }

    return (await response.json()) as UpcomingMatchesResponse;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new APIError("Upcoming matches request timed out (8s)", 408, "UPCOMING_MATCHES_TIMEOUT");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Sprint 4: Team intelligence endpoint
// ---------------------------------------------------------------------------

export type TeamFormVerdict = "IMPROVING" | "STABLE" | "DECLINING" | "VOLATILE";

export interface TeamFormResult {
  match_date: string;
  opponent: string;
  home_or_away: "home" | "away";
  goals_for: number | null;
  goals_against: number | null;
  result: "W" | "D" | "L";
  points: number;
}

export interface TeamH2HEntry {
  opponent: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
}

export interface TeamUpcomingFixture {
  match_id: string;
  home_team: string;
  away_team: string;
  match_date: string;
  league: string;
  edge_quality_score: number | null;
  has_prediction: boolean;
}

export interface TeamIntelligenceResponse {
  team_slug: string;
  team_name: string;
  league: string | null;
  form_verdict: TeamFormVerdict;
  ppg_last5: number | null;
  ppg_last10: number | null;
  recent_form: TeamFormResult[];
  h2h_summary: TeamH2HEntry[];
  upcoming_fixtures: TeamUpcomingFixture[];
  queried_at: string;
}

/** Fetch rolling form, H2H, and upcoming fixtures for a team by slug. */
export async function getTeamIntelligence(
  slug: string,
  options: { history_matches?: number; upcoming_days?: number } = {},
): Promise<TeamIntelligenceResponse> {
  const qs = new URLSearchParams();
  if (options.history_matches !== undefined) qs.set("history_matches", String(options.history_matches));
  if (options.upcoming_days !== undefined) qs.set("upcoming_days", String(options.upcoming_days));
  const url = `/api/teams/${encodeURIComponent(slug)}/intelligence${qs.size ? `?${qs}` : ""}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
      signal: controller.signal,
    } as RequestInit);

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const err = await response.json();
        detail = err.detail || err.error || detail;
      } catch { /* ignore */ }
      throw new APIError(detail, response.status, "TEAM_INTELLIGENCE_ERROR");
    }

    return (await response.json()) as TeamIntelligenceResponse;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new APIError("Team intelligence request timed out (8s)", 408, "TEAM_INTELLIGENCE_TIMEOUT");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

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
