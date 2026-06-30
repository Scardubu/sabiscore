"""Domain exceptions used to enforce SabiScore production contracts."""

from __future__ import annotations

from collections.abc import Iterable


class SabiScoreContractError(RuntimeError):
    """Base class for production contract violations."""


class DataUnavailableError(SabiScoreContractError):
    """Raised when real source data required for inference is unavailable."""

    def __init__(
        self,
        missing_fields: str | Iterable[str],
        reason: str = "DATA_UNAVAILABLE",
    ) -> None:
        fields = (missing_fields,) if isinstance(missing_fields, str) else tuple(missing_fields)
        self.missing_fields: tuple[str, ...] = fields
        self.reason = reason
        detail = ", ".join(fields) if fields else "unspecified input"
        super().__init__(f"{reason}: missing or invalid real data: {detail}")


class StaleDataWarning(SabiScoreContractError):
    """Raised when evidence exceeds the active league freshness policy."""

    def __init__(self, provider: str, age_seconds: float, ttl_seconds: float) -> None:
        self.provider = provider
        self.age_seconds = age_seconds
        self.ttl_seconds = ttl_seconds
        super().__init__(
            f"STALE_DATA: provider={provider} age={age_seconds:.0f}s ttl={ttl_seconds:.0f}s"
        )


class VerdictContractViolation(SabiScoreContractError):
    """Raised when a verdict transition or stake breaches the domain contract."""


__all__ = [
    "DataUnavailableError",
    "SabiScoreContractError",
    "StaleDataWarning",
    "VerdictContractViolation",
]
