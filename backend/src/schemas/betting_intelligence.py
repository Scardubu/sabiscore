"""
SabiScore Core Engine - Versioned Betting Intelligence Schemas
CONTRACT VERSION: 1.3.0

Strict Pydantic v2 models for the betting intelligence request/response contract.
Every field that can be absent is Optional[...] with a None default.
Callers must treat None as DATA_GAP, never as zero or an average.

Null rules:
  - Missing quantitative evidence -> None (not 0, not a league average)
  - probabilities may be None only under PARTIAL
  - stake/stake_fraction is always 0/"pass" under PARTIAL / HOLD / NO_BET
  - Timestamps must be UTC ISO-8601
  - Full Kelly is internal audit math and is never returned to public clients
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class VerdictEnum(str, Enum):
    HIGH_CONVICTION = "HIGH_CONVICTION"
    ACTIONABLE = "ACTIONABLE"
    SPECULATIVE = "SPECULATIVE"
    HOLD = "HOLD"
    PARTIAL = "PARTIAL"
    NO_BET = "NO_BET"


class AnalysisModeEnum(str, Enum):
    VALUE_ANALYSIS = "VALUE_ANALYSIS"
    FORECAST_ONLY = "FORECAST_ONLY"


class CompetitionEnum(str, Enum):
    EPL = "EPL"
    LA_LIGA = "LA_LIGA"
    SERIE_A = "SERIE_A"
    BUNDESLIGA = "BUNDESLIGA"
    LIGUE_1 = "LIGUE_1"
    EREDIVISIE = "EREDIVISIE"
    UCL = "UCL"


class SourceStatusEnum(str, Enum):
    VERIFIED = "VERIFIED"
    STALE = "STALE"
    CONFLICTING = "CONFLICTING"
    DATA_GAP = "DATA_GAP"


class FreshnessStatusEnum(str, Enum):
    FRESH = "FRESH"
    RECENT = "RECENT"
    STALE = "STALE"
    DATA_GAP = "DATA_GAP"
    CONFLICTING = "CONFLICTING"
    UNKNOWN = "UNKNOWN"


class LineupStatusEnum(str, Enum):
    CONFIRMED = "CONFIRMED"
    PROVISIONAL = "PROVISIONAL"
    UNKNOWN = "UNKNOWN"


class SharpSignalEnum(str, Enum):
    CONFIRMING = "CONFIRMING"
    NEUTRAL = "NEUTRAL"
    CONFLICTING = "CONFLICTING"
    UNKNOWN = "UNKNOWN"


class BestMarketEnum(str, Enum):
    HOME_ML = "HOME_ML"
    DRAW_ML = "DRAW_ML"
    AWAY_ML = "AWAY_ML"


class ConfidenceLabelEnum(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class EvidenceTierEnum(str, Enum):
    OK = "OK"
    LOW_EVIDENCE = "LOW_EVIDENCE"


class EvidenceProviderEnum(str, Enum):
    """Canonical provider ownership identities used for independence gates."""

    ESPN = "ESPN"
    FOOTBALL_DATA_ORG = "FOOTBALL_DATA_ORG"
    API_FOOTBALL = "API_FOOTBALL"
    SPORTMONKS = "SPORTMONKS"
    THE_ODDS_API = "THE_ODDS_API"


# ---------------------------------------------------------------------------
# Input sub-models
# ---------------------------------------------------------------------------


class ModelInput(BaseModel):
    """Calibrated model output for one match."""

    home_probability: float = Field(..., ge=0.0, le=1.0)
    draw_probability: float = Field(..., ge=0.0, le=1.0)
    away_probability: float = Field(..., ge=0.0, le=1.0)
    model_version: str
    calibration_method: str
    calibration_validated: bool
    epistemic_uncertainty: float = Field(..., ge=0.0)
    aleatoric_uncertainty: float = Field(..., ge=0.0)
    confidence_tier: EvidenceTierEnum

    @model_validator(mode="after")
    def check_prob_sum(self) -> "ModelInput":
        total = self.home_probability + self.draw_probability + self.away_probability
        if abs(total - 1.0) > 0.005:
            raise ValueError(
                f"Probabilities must sum to 1.0 +/-0.005; got {total:.6f}. "
                "DATA_GAP: INVALID_MODEL_PROBABILITY_SUM"
            )
        return self


class MarketInput(BaseModel):
    """Complete coherent 1X2 market snapshot from a single bookmaker."""

    bookmaker: str
    market_type: str = "1X2"
    home_odds: float = Field(..., gt=1.0)
    draw_odds: float = Field(..., gt=1.0)
    away_odds: float = Field(..., gt=1.0)
    opening_home_odds: Optional[float] = Field(default=None, gt=1.0)
    opening_draw_odds: Optional[float] = Field(default=None, gt=1.0)
    opening_away_odds: Optional[float] = Field(default=None, gt=1.0)
    captured_at: datetime


class SignalsInput(BaseModel):
    """Pre-match contextual signals."""

    xg_differential: Optional[float] = None
    xga_differential: Optional[float] = None
    opponent_adjusted_form: Optional[float] = None
    club_elo_difference: Optional[float] = None
    schedule_congestion: Optional[float] = None
    travel_load: Optional[float] = None
    confirmed_absences: List[str] = Field(default_factory=list)
    lineup_status: LineupStatusEnum = LineupStatusEnum.UNKNOWN
    sharp_market_signal: SharpSignalEnum = SharpSignalEnum.UNKNOWN


class FreshnessInput(BaseModel):
    """Measured staleness in seconds for each evidence category."""

    model_features_seconds: Optional[int] = None
    market_seconds: Optional[int] = None
    injury_news_seconds: Optional[int] = None
    lineup_seconds: Optional[int] = None


class SourceStatusInput(BaseModel):
    """Caller-declared reliability status for each evidence category."""

    model: SourceStatusEnum = SourceStatusEnum.DATA_GAP
    market: SourceStatusEnum = SourceStatusEnum.DATA_GAP
    team_metrics: SourceStatusEnum = SourceStatusEnum.DATA_GAP
    availability: SourceStatusEnum = SourceStatusEnum.DATA_GAP


class MatchAnalysisRequest(BaseModel):
    """Single-match analysis request with explicit provider provenance."""

    match_id: str
    home_team: str
    away_team: str
    competition: CompetitionEnum
    kickoff_utc: datetime

    # Critical - can be None, which forces PARTIAL
    model: Optional[ModelInput] = None
    market: Optional[MarketInput] = None

    signals: SignalsInput = Field(default_factory=SignalsInput)
    freshness: FreshnessInput = Field(default_factory=FreshnessInput)
    source_status: SourceStatusInput = Field(default_factory=SourceStatusInput)
    verified_evidence_providers: List[EvidenceProviderEnum] = Field(default_factory=list)

    # Caller-declared data gaps (execution-blocking by design)
    data_gaps: List[str] = Field(default_factory=list)
    known_risks: List[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def check_provider_uniqueness(self) -> "MatchAnalysisRequest":
        if len(set(self.verified_evidence_providers)) != len(self.verified_evidence_providers):
            raise ValueError("verified_evidence_providers must contain unique provider owners")
        return self


class BatchAnalysisRequest(BaseModel):
    """Batch of up to 100 match analysis requests."""

    matches: List[MatchAnalysisRequest] = Field(..., min_length=1, max_length=100)
    engine_version: str = "1.2.0"


# ---------------------------------------------------------------------------
# Output sub-models
# ---------------------------------------------------------------------------


class ProbabilitySet(BaseModel):
    home: Optional[float] = None
    draw: Optional[float] = None
    away: Optional[float] = None


class DataFreshness(BaseModel):
    status: FreshnessStatusEnum
    market_captured_at: Optional[datetime] = None
    oldest_critical_input_seconds: Optional[int] = None
    lineup_status: LineupStatusEnum = LineupStatusEnum.UNKNOWN


class CalculationAudit(BaseModel):
    bookmaker: Optional[str] = None
    market_overround: Optional[float] = None
    raw_implied_home: Optional[float] = None
    raw_implied_draw: Optional[float] = None
    raw_implied_away: Optional[float] = None
    fair_market_home: Optional[float] = None
    fair_market_draw: Optional[float] = None
    fair_market_away: Optional[float] = None
    calibration_method: Optional[str] = None
    model_version: Optional[str] = None
    kelly_fraction: float = 0.25
    kelly_cap: float = 0.05
    breakeven_odds: Optional[float] = None
    minimum_odds_for_target_ev: Optional[float] = None
    edge_preserving_minimum_odds: Optional[float] = None


class MarketEvaluation(BaseModel):
    """Public edge/EV calculation for a single 1X2 outcome."""

    outcome: str  # "home" | "draw" | "away"
    market_label: BestMarketEnum
    model_probability: float
    market_odds: float
    raw_implied_probability: float
    fair_market_probability: float
    edge: float
    edge_pct: float
    expected_value: float
    stake_fraction: float  # capped Quarter-Kelly; Full Kelly is never public
    confidence_adjusted_value: float


class MatchAnalysisResult(BaseModel):
    """Complete analysis result for a single match."""

    contract_version: str = "1.3.0"
    policy_version: str = "1.1"
    decision_id: Optional[str] = None
    evaluation_at: Optional[datetime] = None
    analysis_mode: AnalysisModeEnum = AnalysisModeEnum.FORECAST_ONLY
    execution_eligible: bool = False
    watchlist: bool = False
    source_summary: Dict[str, Any] = Field(default_factory=dict)
    verified_evidence_providers: List[EvidenceProviderEnum] = Field(default_factory=list)
    independent_source_count: int = Field(default=0, ge=0)
    input_hash: Optional[str] = None
    policy_hash: Optional[str] = None
    minimum_acceptable_odds_method: Optional[str] = None
    target_expected_value: float = 0.0

    match_identifier: str
    match_id: str
    competition: str
    kickoff_utc: Optional[datetime] = None

    verdict: VerdictEnum
    probabilities: Optional[ProbabilitySet] = None

    # Best market selection (null under PARTIAL / NO_BET)
    best_market: Optional[BestMarketEnum] = None
    market_odds: Optional[float] = None
    raw_market_implied_probability: Optional[float] = None
    fair_market_probability: Optional[float] = None
    edge: Optional[float] = None
    edge_percentage_points: Optional[float] = None
    expected_value: Optional[float] = None
    confidence: Optional[ConfidenceLabelEnum] = None
    confidence_adjusted_value: Optional[float] = None

    # Staking
    stake: str = "pass"
    stake_fraction: float = 0.0
    minimum_acceptable_odds: Optional[float] = None

    # Evidence
    drivers: List[str] = Field(default_factory=list)
    risks: List[str] = Field(default_factory=list)
    invalidation_conditions: List[str] = Field(default_factory=list)
    critical_gaps: List[str] = Field(default_factory=list)
    advisory_gaps: List[str] = Field(default_factory=list)
    conflicts: List[str] = Field(default_factory=list)

    # All evaluated markets (for transparency)
    all_market_evaluations: Optional[List[Dict[str, Any]]] = None

    data_freshness: Optional[DataFreshness] = None
    data_gaps: List[str] = Field(default_factory=list)
    calculation_audit: Optional[CalculationAudit] = None
    explanation: str = ""


class BatchAnalysisResponse(BaseModel):
    """Response for a batch of match analyses."""

    contract_version: str = "1.3.0"
    policy_version: str = "1.1"
    engine_version: str = "1.2.0"
    generated_at: datetime
    top_opportunities: List[str] = Field(default_factory=list)
    batch_watchlist: List[str] = Field(
        default_factory=list,
        description="Match IDs with SPECULATIVE verdict - watchlist only, never top_opportunities.",
    )
    matches: List[MatchAnalysisResult] = Field(default_factory=list)
