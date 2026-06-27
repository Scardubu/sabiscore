// SabiScore Strict Betting Intelligence API Types
// Contract version: 1.1.0
// Generated: 2026-06-25

// --- Enums -------------------------------------------------------------------

export type Verdict =
  | "HIGH_CONVICTION"
  | "ACTIONABLE"
  | "SPECULATIVE"
  | "HOLD"
  | "PARTIAL"
  | "NO_BET";  // NEW: valid data, no positive value

export type Competition =
  | "EPL"
  | "LA_LIGA"
  | "SERIE_A"
  | "BUNDESLIGA"
  | "LIGUE_1"
  | "EREDIVISIE"
  | "UCL";

export type BestMarket = "HOME_ML" | "DRAW_ML" | "AWAY_ML";

export type ConfidenceLabel = "HIGH" | "MEDIUM" | "LOW";

export type EvidenceTier = "OK" | "LOW_EVIDENCE";

export type SourceStatus = "VERIFIED" | "STALE" | "CONFLICTING" | "DATA_GAP";

export type FreshnessStatus = "FRESH" | "RECENT" | "STALE" | "DATA_GAP" | "CONFLICTING" | "UNKNOWN";

export type LineupStatus = "CONFIRMED" | "PROVISIONAL" | "UNKNOWN";

export type SharpSignal = "CONFIRMING" | "NEUTRAL" | "CONFLICTING" | "UNKNOWN";

// --- Strict Engine Input Types ------------------------------------------------

export interface ModelInput {
  home_probability: number;
  draw_probability: number;
  away_probability: number;
  model_version: string;
  calibration_method: string;
  calibration_validated: boolean;
  epistemic_uncertainty: number;
  aleatoric_uncertainty: number;
  confidence_tier: EvidenceTier;
}

export interface MarketInput {
  bookmaker: string;
  market_type: string;
  home_odds: number;
  draw_odds: number;
  away_odds: number;
  opening_home_odds?: number | null;
  opening_draw_odds?: number | null;
  opening_away_odds?: number | null;
  captured_at: string; // ISO-8601 UTC
}

export interface SignalsInput {
  xg_differential?: number | null;
  xga_differential?: number | null;
  opponent_adjusted_form?: number | null;
  club_elo_difference?: number | null;
  schedule_congestion?: number | null;
  travel_load?: number | null;
  confirmed_absences?: string[];
  lineup_status?: LineupStatus;
  sharp_market_signal?: SharpSignal;
}

export interface FreshnessInput {
  model_features_seconds?: number | null;
  market_seconds?: number | null;
  injury_news_seconds?: number | null;
  lineup_seconds?: number | null;
}

export interface SourceStatusInput {
  model?: SourceStatus;
  market?: SourceStatus;
  team_metrics?: SourceStatus;
  availability?: SourceStatus;
}

export interface MatchAnalysisRequest {
  match_id: string;
  home_team: string;
  away_team: string;
  competition: Competition;
  kickoff_utc: string;
  model?: ModelInput | null;
  market?: MarketInput | null;
  signals?: SignalsInput;
  freshness?: FreshnessInput;
  source_status?: SourceStatusInput;
  data_gaps?: string[];
  known_risks?: string[];
}

export interface BatchAnalysisRequest {
  matches: MatchAnalysisRequest[];
  engine_version?: string;
}

// --- Strict Engine Output Types -----------------------------------------------

export interface ProbabilitySet {
  home: number | null;
  draw: number | null;
  away: number | null;
}

export interface DataFreshness {
  status: FreshnessStatus;
  market_captured_at?: string | null;
  oldest_critical_input_seconds?: number | null;
  lineup_status?: LineupStatus;
}

export interface CalculationAudit {
  bookmaker?: string | null;
  market_overround?: number | null;
  raw_implied_home?: number | null;
  raw_implied_draw?: number | null;
  raw_implied_away?: number | null;
  fair_market_home?: number | null;
  fair_market_draw?: number | null;
  fair_market_away?: number | null;
  calibration_method?: string | null;
  model_version?: string | null;
  kelly_fraction: number;
  kelly_cap: number;
  breakeven_odds?: number | null;
  minimum_odds_for_target_ev?: number | null;
  edge_preserving_minimum_odds?: number | null;
}

export interface MarketEvaluation {
  outcome: "home" | "draw" | "away";
  market_label: BestMarket;
  model_probability: number;
  market_odds: number;
  raw_implied_probability: number;
  fair_market_probability: number;
  edge: number;
  edge_pct: number;
  expected_value: number;
  full_kelly: number;
  stake_fraction: number;
  confidence_adjusted_value: number;
}

export interface MatchAnalysisResult {
  contract_version?: string;
  policy_version?: string;
  decision_id?: string | null;
  evaluation_at?: string | null;
  analysis_mode?: "VALUE_ANALYSIS" | "FORECAST_ONLY";
  execution_eligible?: boolean;
  watchlist?: boolean;
  source_summary?: Record<string, unknown>;
  input_hash?: string | null;
  policy_hash?: string | null;
  minimum_acceptable_odds_method?: string | null;
  target_expected_value?: number;
  match_identifier: string;
  match_id: string;
  competition: string;
  kickoff_utc?: string | null;
  verdict: Verdict;
  probabilities?: ProbabilitySet | null;
  best_market?: BestMarket | null;
  market_odds?: number | null;
  raw_market_implied_probability?: number | null;
  fair_market_probability?: number | null;
  edge?: number | null;
  edge_percentage_points?: number | null;
  expected_value?: number | null;
  confidence?: ConfidenceLabel | null;
  confidence_adjusted_value?: number | null;
  stake: string; // "pass" or "{fraction}u"
  stake_fraction: number;
  minimum_acceptable_odds?: number | null;
  drivers: string[];
  risks: string[];
  invalidation_conditions: string[];
  all_market_evaluations?: MarketEvaluation[] | null;
  data_freshness?: DataFreshness | null;
  data_gaps: string[];
  calculation_audit?: CalculationAudit | null;
  explanation: string;
}

export interface BatchAnalysisResponse {
  contract_version?: string;
  policy_version?: string;
  engine_version: string;
  generated_at: string;
  top_opportunities: string[];
  matches: MatchAnalysisResult[];
}

// --- Engine Policy ------------------------------------------------------------

export interface EnginePolicy {
  contract_version?: string;
  engine_version: string;
  policy_version?: string;
  generated_at: string;
  policy: {
    min_actionable_edge_pp: number;
    high_conviction_edge_pp: number;
    kelly_fraction: number;
    max_kelly_cap: number;
    speculative_stake_cap: number;
    minimum_acceptable_odds_method?: string;
    target_expected_value?: number;
    verdict_precedence: Verdict[];
    ucl_coverage: string;
    market_freshness_thresholds: {
      fresh_seconds: number;
      recent_seconds: number;
      stale_above_seconds: number;
    };
    model_features_fresh_seconds?: number;
    null_rules: {
      missing_quantitative_data: string;
      stake_under_partial_hold_no_bet: string;
      probabilities_under_partial: string;
    };
  };
}

export interface FixtureSummary {
  fixture_id: string;
  competition: string;
  home_team: string;
  away_team: string;
  kickoff_utc: string;
  status: string;
  venue?: string | null;
  evidence_status: string;
  odds_status: string;
}

export interface UpcomingFixturesResponse {
  fixtures: FixtureSummary[];
  total: number;
  source: string;
}

export interface FixtureEvidenceResponse {
  fixture: FixtureSummary;
  model?: Record<string, unknown> | null;
  market?: Record<string, unknown> | null;
  freshness: Record<string, unknown>;
  source_status: Record<string, string>;
  data_gaps: string[];
  retrieval_timeline: Array<Record<string, unknown>>;
  readiness: Array<Record<string, unknown>>;
  source_comparison: Array<Record<string, unknown>>;
}

export interface ManualOddsSnapshotRequest {
  bookmaker: string;
  home_odds: number;
  draw_odds: number;
  away_odds: number;
  observed_at: string;
  opening_home_odds?: number | null;
  opening_draw_odds?: number | null;
  opening_away_odds?: number | null;
  source_label?: string | null;
  source_url?: string | null;
  user_confirmed: boolean;
}

export interface ManualOddsSnapshotResponse {
  fixture_id: string;
  bookmaker: string;
  home_odds: number;
  draw_odds: number;
  away_odds: number;
  observed_at: string;
  received_at: string;
  executable: boolean;
  provenance: Record<string, unknown>;
}

export interface ProviderOddsCandidate {
  bookmaker: string;
  home_odds: number;
  draw_odds: number;
  away_odds: number;
  captured_at: string;
  provider: string;
  executable: boolean;
}

export interface ProviderOddsCandidatesResponse {
  fixture_id: string;
  candidates: ProviderOddsCandidate[];
  warnings: string[];
}

export interface RefreshEvidenceResponse {
  fixture_id: string;
  profile: string;
  provider_results: Array<Record<string, unknown>>;
  refreshed_at: string;
}

// --- Legacy Full-Analysis Types (backward-compatible, hardened) ---------------

/** Phase 7-D (hardened): now includes NO_BET verdict */
export interface FullMatchAnalysisResponse {
  match_id: string;
  // UPDATED: NO_BET added to verdict union
  verdict: Verdict;
  ensemble: {
    home_win_prob: number;
    draw_prob: number;
    away_win_prob: number;
    prediction: string;
    confidence: number;
    league: string;
    model_version: string;
    calibration_method?: string;
    calibration_applied?: boolean;
    overlay_applied?: boolean;
    /** HARDENED: false when prediction is unavailable (was missing previously) */
    probabilities_available?: boolean;
  };
  uncertainty: {
    epistemic_unc: number;
    aleatoric_unc: number;
    concentration: number;
    credible_interval: [number, number];
    confidence_tier: EvidenceTier;
  };
  causal_drivers: string[];
  rl_recommendation: {
    stake_fraction: number;
    abstain: boolean;
    reason: string | null;
    reward_components: Record<string, number>;
  };
  elo_context: {
    home_elo: number;
    away_elo: number;
    elo_difference: number;
    home_elo_trend_5: number;
    away_elo_trend_5: number;
    elo_momentum_cross: number;
  };
  /** HARDENED: now includes expected_value and edge_pct (de-vigged) */
  odds_edge: {
    market: string;
    market_odds: number;
    model_prob: number;
    edge: number;          // de-vigged edge
    kelly_stake: number;
    edge_pct: number;      // NEW
    expected_value: number; // NEW
  } | null;
  narrative: string;
  partial_intelligence: boolean;
  data_gaps: string[];
  staleness_seconds: number;
  /** HARDENED: false means staleness is unknown - never renders as LIVE */
  staleness_available?: boolean;
  /** HARDENED: "UNKNOWN" is now possible when staleness_available=false */
  freshness_tag: "LIVE" | "RECENT" | "STALE" | "UNKNOWN";
  feature_freshness_seconds: Record<string, number | null>;
  feature_source: Record<string, string>;
  actionability: {
    edge_quality_score: number;
    clv_pct: number | null;
    closing_line_convergence_delta: number | null;
    suggested_stake_pct: number;
    abstain: boolean;
    abstain_reason: string | null;
    top_evidence: string[];
    caveats: string[];
  } | null;
  generated_at: string;
  match_importance_score?: number | null;
  competition_stage?: string | null;
}

// --- API Client Functions -----------------------------------------------------

const SAME_ORIGIN_API = "/api/betting-intelligence";

export class APIError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message?: string,
  ) {
    super(message ?? `API error ${status}`);
  }
}

function messageFromErrorBody(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const candidate = body as { message?: unknown; detail?: unknown; error?: unknown };
  for (const value of [candidate.message, candidate.detail, candidate.error]) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
  timeoutMs = 10_000,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      ...options,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new APIError(
        res.status,
        body,
        messageFromErrorBody(body) ?? `API error ${res.status}`,
      );
    }
    return (await res.json()) as T;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new APIError(408, null, "Request timed out while waiting for the backend.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/** Call the strict betting intelligence batch endpoint. */
export async function analyzeBatch(
  request: BatchAnalysisRequest,
): Promise<BatchAnalysisResponse> {
  return apiFetch<BatchAnalysisResponse>(
    `${SAME_ORIGIN_API}/analyze`,
    { method: "POST", body: JSON.stringify(request) },
  );
}

/** Call the strict betting intelligence single-match endpoint. */
export async function analyzeSingle(
  request: MatchAnalysisRequest,
): Promise<MatchAnalysisResult> {
  return apiFetch<MatchAnalysisResult>(
    `${SAME_ORIGIN_API}/analyze`,
    { method: "POST", body: JSON.stringify(request) },
  );
}

/** Get current engine policy parameters. */
export async function getEnginePolicy(): Promise<EnginePolicy> {
  return apiFetch<EnginePolicy>(`${SAME_ORIGIN_API}/policy`);
}

export async function getUpcomingFixtures(competition?: string): Promise<UpcomingFixturesResponse> {
  const params = competition ? `?competition=${encodeURIComponent(competition)}` : "";
  return apiFetch<UpcomingFixturesResponse>(`/api/fixtures/upcoming${params}`);
}

export async function getFixtureEvidence(fixtureId: string): Promise<FixtureEvidenceResponse> {
  return apiFetch<FixtureEvidenceResponse>(
    `/api/fixtures/${encodeURIComponent(fixtureId)}/evidence`,
  );
}

export async function refreshFixtureEvidence(
  fixtureId: string,
  profile = "PREMATCH_STANDARD",
): Promise<RefreshEvidenceResponse> {
  return apiFetch<RefreshEvidenceResponse>(
    `/api/fixtures/${encodeURIComponent(fixtureId)}/refresh`,
    { method: "POST", body: JSON.stringify({ profile }) },
  );
}

export async function getProviderOddsCandidates(
  fixtureId: string,
): Promise<ProviderOddsCandidatesResponse> {
  return apiFetch<ProviderOddsCandidatesResponse>(
    `/api/fixtures/${encodeURIComponent(fixtureId)}/odds-snapshots`,
  );
}

export async function submitManualOddsSnapshot(
  fixtureId: string,
  request: ManualOddsSnapshotRequest,
): Promise<ManualOddsSnapshotResponse> {
  return apiFetch<ManualOddsSnapshotResponse>(
    `/api/fixtures/${encodeURIComponent(fixtureId)}/odds-snapshot`,
    { method: "POST", body: JSON.stringify(request) },
  );
}

export async function analyzeFixture(fixtureId: string): Promise<MatchAnalysisResult> {
  return apiFetch<MatchAnalysisResult>(
    `/api/fixtures/${encodeURIComponent(fixtureId)}/analyze`,
    { method: "POST" },
  );
}

/** Legacy full-analysis route (backward-compatible, hardened). */
export async function getFullAnalysis(
  matchId: string,
  league = "EPL",
): Promise<FullMatchAnalysisResponse> {
  return apiFetch<FullMatchAnalysisResponse>(
    `/api/full-analysis/${encodeURIComponent(matchId)}?league=${league}`,
  );
}
