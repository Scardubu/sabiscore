import { describe, expect, it } from "vitest";
import {
  classifyAnalysisError,
  fullMatchAnalysisSchema,
  isRetryableInfrastructureError,
  mapFullAnalysisPresentation,
} from "./full-analysis-contract";

function payload(overrides: Record<string, unknown> = {}) {
  const base = {
    match_id: "Arsenal vs Chelsea",
    verdict: "ACTIONABLE",
    prediction_status: "AVAILABLE",
    prediction_source: "CERTIFIED_MODEL",
    probabilities_available: true,
    is_reduced_evidence_baseline: false,
    top_outcome_probability: 0.5,
    effective_kelly_cap: 0.04,
    stake_permitted: true,
    evidence_quality: {
      critical_gaps: [],
      advisory_gaps: [],
      conflicts: [],
      all_gaps: [],
      critical_gap_count: 0,
      advisory_gap_count: 0,
      conflict_count: 0,
      total_gap_count: 0,
    },
    ensemble: {
      home_win_prob: 0.5,
      draw_prob: 0.28,
      away_win_prob: 0.22,
      prediction: "home_win",
      confidence: 0.5,
      top_outcome_probability: 0.5,
      probabilities_available: true,
      league: "EPL",
      model_version: "v5_phase7",
      calibration_method: "isotonic",
      calibration_applied: true,
      overlay_applied: false,
    },
    uncertainty: {
      epistemic_unc: 0.05,
      aleatoric_unc: 0.1,
      concentration: 0.8,
      credible_interval: [0.42, 0.58],
      confidence_tier: "OK",
    },
    causal_drivers: ["elo_difference"],
    rl_recommendation: {
      stake_fraction: 0.015,
      abstain: false,
      reason: "Quarter-Kelly within league cap",
      reward_components: {},
    },
    elo_context: {
      home_elo: 1550,
      away_elo: 1500,
      elo_difference: 50,
      home_elo_trend_5: 2,
      away_elo_trend_5: -1,
      elo_momentum_cross: 0,
    },
    odds_edge: {
      market: "home_win",
      market_odds: 2.4,
      model_prob: 0.5,
      edge: 0.08,
      kelly_stake: 0.015,
    },
    narrative: "[ACTIONABLE] Verified evidence supports a bounded home-win position.",
    partial_intelligence: false,
    data_gaps: [],
    staleness_seconds: 120,
    staleness_available: true,
    freshness_tag: "LIVE",
    feature_freshness_seconds: {},
    feature_source: {},
    actionability: {
      edge_quality_score: 0.7,
      clv_pct: null,
      closing_line_convergence_delta: null,
      suggested_stake_pct: 1.5,
      abstain: false,
      abstain_reason: null,
      top_evidence: ["Elo Difference"],
      caveats: [],
    },
    generated_at: "2026-07-20T12:00:00Z",
    match_importance_score: null,
    competition_stage: null,
  };
  return fullMatchAnalysisSchema.parse({ ...base, ...overrides });
}

function blockedEvidence(kind: "critical" | "conflict") {
  const gap = kind === "critical" ? "MODEL_PREDICTION_UNAVAILABLE" : "CONFLICTING_MARKET_SNAPSHOTS";
  return {
    critical_gaps: kind === "critical" ? [gap] : [],
    advisory_gaps: [],
    conflicts: kind === "conflict" ? [gap] : [],
    all_gaps: [gap],
    critical_gap_count: kind === "critical" ? 1 : 0,
    advisory_gap_count: 0,
    conflict_count: kind === "conflict" ? 1 : 0,
    total_gap_count: 1,
  };
}

describe("full-analysis Zod contract and presentation", () => {
  it("maps certified actionable evidence to one bounded stake decision", () => {
    const view = mapFullAnalysisPresentation(payload(), new Date("2026-07-20T13:00:00Z"));
    expect(view.primaryDecision).toBe("Consider home win");
    expect(view.predictionAvailable).toBe(true);
    expect(view.topOutcomeProbability).toBe(0.5);
    expect(view.stakePermitted).toBe(true);
    expect(view.stakeFraction).toBe(0.015);
    expect(view.effectiveKellyCap).toBe(0.04);
    expect(view.kellyGaugeRatio).toBeCloseTo(0.375);
    expect(view.generatedRelative).toBe("1h ago");
    expect(view.generatedAbsoluteLagos).toContain("2026");
  });

  it("keeps advisory-only evidence available and counts it", () => {
    const evidence = {
      critical_gaps: [],
      advisory_gaps: ["lineup_context"],
      conflicts: [],
      all_gaps: ["lineup_context"],
      critical_gap_count: 0,
      advisory_gap_count: 1,
      conflict_count: 0,
      total_gap_count: 1,
    };
    const view = mapFullAnalysisPresentation(payload({ evidence_quality: evidence, data_gaps: evidence.all_gaps }));
    expect(view.predictionAvailable).toBe(true);
    expect(view.evidenceCounts.advisory).toBe(1);
  });

  it.each(["critical", "conflict"] as const)("forces %s evidence to No bet", (kind) => {
    const evidence = blockedEvidence(kind);
    const view = mapFullAnalysisPresentation(payload({
      verdict: "PARTIAL",
      partial_intelligence: true,
      stake_permitted: false,
      evidence_quality: evidence,
      data_gaps: evidence.all_gaps,
      rl_recommendation: { stake_fraction: 0, abstain: true, reason: "No bet", reward_components: {} },
      odds_edge: { ...payload().odds_edge, kelly_stake: 0 },
      actionability: null,
    }));
    expect(view.primaryDecision).toBe("No bet");
    expect(view.stakeFraction).toBe(0);
    expect(view.kellyGaugeRatio).toBe(0);
  });

  it.each([
    ["REDUCED_EVIDENCE_BASELINE", "DIAGNOSTIC_BASELINE"],
    ["UNAVAILABLE", "NONE"],
  ] as const)("withholds %s probabilities", (status, source) => {
    const evidence = blockedEvidence("critical");
    const ensemble = {
      ...payload().ensemble,
      probabilities_available: false,
      ...(status === "UNAVAILABLE"
        ? { home_win_prob: 0, draw_prob: 0, away_win_prob: 0, confidence: 0, top_outcome_probability: 0 }
        : {}),
    };
    const view = mapFullAnalysisPresentation(payload({
      verdict: "PARTIAL",
      prediction_status: status,
      prediction_source: source,
      probabilities_available: false,
      is_reduced_evidence_baseline: status === "REDUCED_EVIDENCE_BASELINE",
      top_outcome_probability: status === "UNAVAILABLE" ? 0 : 0.5,
      partial_intelligence: true,
      stake_permitted: false,
      evidence_quality: evidence,
      data_gaps: evidence.all_gaps,
      ensemble,
      rl_recommendation: { stake_fraction: 0, abstain: true, reason: "No bet", reward_components: {} },
      odds_edge: { ...payload().odds_edge, kelly_stake: 0 },
      actionability: null,
    }));
    expect(view.primaryDecision).toBe("No bet");
    expect(view.displayedProbabilities).toBeNull();
    expect(view.topOutcomeProbability).toBeNull();
  });

  it("keeps speculative evidence watchlist-only", () => {
    const view = mapFullAnalysisPresentation(payload({
      verdict: "SPECULATIVE",
      stake_permitted: false,
      rl_recommendation: { stake_fraction: 0, abstain: false, reason: "Watch", reward_components: {} },
      odds_edge: { ...payload().odds_edge, kelly_stake: 0 },
      actionability: null,
    }));
    expect(view.primaryDecision).toBe("Watchlist");
    expect(view.stakePermitted).toBe(false);
  });

  it("rejects a non-simplex available prediction", () => {
    const valid = payload();
    const result = fullMatchAnalysisSchema.safeParse({
      ...valid,
      ensemble: { ...valid.ensemble, home_win_prob: 0.8 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects any positive compatibility stake when the public gate is closed", () => {
    const valid = payload();
    const result = fullMatchAnalysisSchema.safeParse({
      ...valid,
      verdict: "HOLD",
      stake_permitted: false,
      rl_recommendation: { ...valid.rl_recommendation, stake_fraction: 0.01 },
    });
    expect(result.success).toBe(false);
  });
});

describe("analysis error taxonomy", () => {
  it("never classifies HTTP 500 as a cold start", () => {
    expect(classifyAnalysisError({ status: 500 })).toBe("backend_internal_error");
    expect(classifyAnalysisError({ status: 500, body: { error: "warming" } })).toBe("backend_internal_error");
  });

  it("recognizes explicit cold start and retryable infrastructure failures", () => {
    expect(classifyAnalysisError({ status: 503, body: { error: "cold_start" } })).toBe("cold_start");
    expect(classifyAnalysisError({ status: 504 })).toBe("upstream_unavailable");
    expect(isRetryableInfrastructureError("upstream_timeout")).toBe(true);
    expect(isRetryableInfrastructureError("backend_internal_error")).toBe(false);
  });
});
