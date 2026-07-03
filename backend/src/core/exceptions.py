"""Domain exceptions for SabiScore backend.

Production inference must never silently replace missing evidence with defaults.
Callers should catch DataUnavailableError and propagate it as a structured gap
(PARTIAL or NO_BET verdict) rather than substituting fabricated values.
"""


class DataUnavailableError(Exception):
    """Raised when required evidence is missing and fail-closed mode is active.

    Propagate to verdict evaluation as PARTIAL (structural gap) or
    NO_BET (reason=DATA_UNAVAILABLE) depending on which evidence is absent.
    """

    def __init__(self, message: str, provider: str = "unknown", evidence_type: str = "unknown"):
        super().__init__(message)
        self.provider = provider
        self.evidence_type = evidence_type


class OddsUnavailableError(DataUnavailableError):
    """Raised when 1X2 odds are missing and cannot be fabricated.

    Odds are a required signal — no bet may be surfaced without real market data.
    """

    def __init__(self, provider: str = "unknown"):
        super().__init__(
            "1X2 odds are required but unavailable; cannot fabricate market probabilities",
            provider=provider,
            evidence_type="odds",
        )
