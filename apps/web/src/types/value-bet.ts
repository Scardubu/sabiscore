/**
 * ValueBet Type Definitions
 * Normalized types with safe defaults for frontend display
 */

export interface ValueBetQuality {
  quality_score: number;
  tier: string;
  recommendation: string;
  ev_contribution: number;
  confidence_contribution: number;
  liquidity_contribution: number;
}

interface RawValueBetQuality {
  quality_score?: unknown;
  tier?: unknown;
  recommendation?: unknown;
  ev_contribution?: unknown;
  confidence_contribution?: unknown;
  liquidity_contribution?: unknown;
}

interface RawValueBet {
  id?: unknown;
  match_id?: unknown;
  league?: unknown;
  home_team?: unknown;
  away_team?: unknown;
  kickoff?: unknown;
  bet_type?: unknown;
  market_odds?: unknown;
  model_prob?: unknown;
  market_prob?: unknown;
  expected_value?: unknown;
  value_pct?: unknown;
  edge?: unknown;
  kelly_stake?: unknown;
  confidence_interval?: unknown;
  recommendation?: unknown;
  quality?: RawValueBetQuality;
  bookmaker?: unknown;
  clv_expected_ngn?: unknown;
  implied_probability?: unknown;
  fair_probability?: unknown;
}

export interface ValueBet {
  // Core identification
  id?: string;
  match_id?: string;
  
  // Match details
  league?: string;
  home_team?: string;
  away_team?: string;
  kickoff?: string; // ISO datetime
  
  // Bet details
  bet_type: string;
  market_odds: number;
  model_prob: number;
  market_prob: number;
  
  // Value metrics
  expected_value: number;
  value_pct: number;
  edge: number;
  kelly_stake: number;
  
  // Additional fields
  confidence_interval?: number[];
  recommendation?: string;
  quality?: ValueBetQuality;
  
  // Bookmaker info
  bookmaker?: string;
  clv_expected_ngn?: number;
  
  // Probability fields
  implied_probability?: number;
  fair_probability?: number;
}

/**
 * Normalize raw API response to safe ValueBet with defaults
 */
export function normalizeValueBet(raw: RawValueBet): ValueBet {
  return {
    // Core fields
    id: String(raw.id ?? raw.match_id ?? `bet-${Date.now()}`),
    match_id: raw.match_id ? String(raw.match_id) : undefined,
    
    // Match details
    league: raw.league ? String(raw.league) : undefined,
    home_team: raw.home_team ? String(raw.home_team) : undefined,
    away_team: raw.away_team ? String(raw.away_team) : undefined,
    kickoff: raw.kickoff ? String(raw.kickoff) : undefined,
    
    // Required bet details
    bet_type: String(raw.bet_type ?? "Unknown"),
    market_odds: Number(raw.market_odds ?? 1.0),
    model_prob: Number(raw.model_prob ?? 0),
    market_prob: Number(raw.market_prob ?? 0),
    
    // Value metrics
    expected_value: Number(raw.expected_value ?? 0),
    value_pct: Number(raw.value_pct ?? 0),
    edge: Number(raw.edge ?? 0),
    kelly_stake: Number(raw.kelly_stake ?? 0),
    
    // Optional fields
    confidence_interval: Array.isArray(raw.confidence_interval)
      ? raw.confidence_interval.map(Number)
      : undefined,
    recommendation: raw.recommendation ? String(raw.recommendation) : undefined,
    quality: raw.quality ? normalizeQuality(raw.quality) : undefined,
    
    // Bookmaker
    bookmaker: raw.bookmaker ? String(raw.bookmaker) : "bookie",
    clv_expected_ngn: raw.clv_expected_ngn != null ? Number(raw.clv_expected_ngn) : undefined,
    
    // Probabilities
    implied_probability: raw.implied_probability != null ? Number(raw.implied_probability) : undefined,
    fair_probability: raw.fair_probability != null ? Number(raw.fair_probability) : undefined,
  };
}

function normalizeQuality(raw: RawValueBetQuality): ValueBetQuality {
  return {
    quality_score: Number(raw.quality_score ?? 0),
    tier: String(raw.tier ?? "Standard"),
    recommendation: String(raw.recommendation ?? ""),
    ev_contribution: Number(raw.ev_contribution ?? 0),
    confidence_contribution: Number(raw.confidence_contribution ?? 0),
    liquidity_contribution: Number(raw.liquidity_contribution ?? 0),
  };
}
