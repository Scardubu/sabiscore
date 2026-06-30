"""Domain exceptions used to enforce SabiScore production contracts."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


class SabiScoreContractError(RuntimeError):
    """Base class for production contract violations."""


@dataclass(slots=True)
class DataUnavailableError(SabiScoreContractError):
    """Raised when real source data required for inference is unavailable."""

    missing_fields: tuple[str, ...]
    reason: str = "DATA_UNAVAILABLE"

    def __init__(self, missing_fields: str | Iterable[str], reason: str = "DATA_UNAVAILABLE") -> None:
        fields = (missing_fields,) if isinstance(missing_fields, str) else tuple(missing_fields)
        self.missing_fields = fields
        self.reason = reason
        detail = ", ".join(fields) if fields else "unspecified input"
        super().__init__(f"{reason}: missing or invalid real data: {detail}")


@dataclass(slots=True)
class StaleDataWarning(SabiScoreContractError):
    """Raised when evidence exceeds the active league freshness policy."""

    provider: str
    age_seconds: float
    ttl_seconds: float

    def __post_init__(self) -> None:
        super().__init__(
            f"STALE_DATA: provider={self.provider} age={self.age_seconds:.0f}s ttl={self.ttl_seconds:.0f}s"
        )


class VerdictContractViolation(SabiScoreContractError):
    """Raised when a verdict transition or stake breaches the domain contract."""
