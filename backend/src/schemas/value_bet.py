"""Value bet schemas shared across prediction endpoints."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ValueBetResponse(BaseModel):
	"""Rich description of a detected value betting opportunity."""

	match_id: str = Field(..., description="Match identifier")
	market: str = Field(..., description="Market name, e.g. home_win")
	odds: float = Field(..., ge=1.01, description="Offered decimal odds")
	fair_probability: float = Field(..., ge=0, le=1)
	implied_probability: float = Field(..., ge=0, le=1)
	edge_percent: float = Field(..., description="Edge expressed as percentage" )
	edge_ngn: float = Field(..., description="Edge translated to Naira per ₦10k stake")
	kelly_stake_ngn: float = Field(..., ge=0, description="Recommended stake in Naira")
	kelly_fraction: float = Field(..., ge=0, le=1, description="Kelly fraction applied")
	clv_ngn: float = Field(..., description="Estimated closing line value in Naira")
	confidence: float = Field(..., ge=0, le=1)
	expected_roi: float = Field(..., description="Expected ROI for this value bet")
	created_at: datetime = Field(default_factory=datetime.utcnow)
	pinnacle_close: Optional[float] = Field(
		default=None,
		description="Reference Pinnacle closing price, if available",
		ge=1.01,
	)

	class Config:
		json_schema_extra = {
			"example": {
				"match_id": "epl_2025_234",
				"market": "home_win",
				"odds": 1.96,
				"fair_probability": 0.563,
				"implied_probability": 0.510,
				"edge_percent": 9.3,
				"edge_ngn": 186.0,
				"kelly_stake_ngn": 53720.0,
				"kelly_fraction": 0.125,
				"clv_ngn": 81.0,
				"confidence": 0.847,
				"expected_roi": 0.089,
				"created_at": "2025-11-11T14:32:00Z",
			}
		}


__all__ = ["ValueBetResponse"]
