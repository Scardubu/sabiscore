"""Shared primitives for V4 / Phase 9 external data connectors.

Design goals
------------
- Async-first for FastAPI background tasks and stand-alone backfill scripts.
- Bounded retries, exponential back-off, and Retry-After-aware 429 handling.
- Explicit ``SourceMeta`` for freshness contracts (mirrors the
  ``freshness`` pattern already used in ``data/aggregator.py``).
- Context-manager *and* standalone usage modes.
- No synthetic fallback inside connectors — callers decide how to degrade.

This module is purely additive: it does not import from, or get imported by,
the legacy live-odds connectors in this package (``opta.py``, ``betfair.py``,
``pinnacle.py``). Those continue to use ``aiohttp`` + ``tenacity.retry``
directly and are untouched.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Mapping

import httpx
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class ConnectorError(RuntimeError):
    """Raised when a connector cannot return trustworthy data.

    Callers should catch this and decide on their own fallback strategy.
    """


class ConnectorRateLimitError(ConnectorError):
    """Raised when the upstream source signals rate-limiting (HTTP 429).

    ``retry_after_seconds`` carries the value from the ``Retry-After``
    response header when present.
    """

    def __init__(self, message: str, retry_after_seconds: float | None = None) -> None:
        super().__init__(message)
        self.retry_after_seconds = retry_after_seconds


# ---------------------------------------------------------------------------
# Source metadata (freshness contract)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class SourceMeta:
    """Immutable provenance record attached to every connector response.

    Shape mirrors the ``freshness`` metadata already produced by
    ``DataAggregator.fetch_match_data`` so no adapter layer is needed when
    callers fold this into ``metadata["freshness"]`` or similar.
    """

    source: str
    fetched_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    freshness_seconds: int = 0
    raw_status: str = "ok"
    notes: tuple[str, ...] = ()

    def as_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "fetched_at": self.fetched_at.isoformat(),
            "freshness_seconds": int(self.freshness_seconds),
            "raw_status": self.raw_status,
            "notes": list(self.notes),
        }


# ---------------------------------------------------------------------------
# Async HTTP client
# ---------------------------------------------------------------------------


class AsyncJSONClient:
    """Typed, retry-aware wrapper around httpx for JSON connector calls.

    Intentionally decoupled from Redis/SabiScore cache — caching stays in the
    existing ``DataAggregator`` layer, keeping this class trivially testable.

    Usage as context manager (preferred in long-lived tasks)::

        async with AsyncJSONClient(base_url="https://...") as client:
            data = await client.get_json("/endpoint")

    Usage standalone (one-shot calls in scripts)::

        client = AsyncJSONClient(base_url="https://...")
        try:
            data = await client.get_json("/endpoint")
        finally:
            await client.aclose()
    """

    _RETRYABLE = (
        httpx.TimeoutException,
        httpx.TransportError,
        httpx.RemoteProtocolError,
    )

    def __init__(
        self,
        *,
        base_url: str,
        headers: Mapping[str, str] | None = None,
        timeout_seconds: float = 12.0,
        max_retries: int = 3,
        user_agent: str = "SabiScore/4.0 (+https://github.com/Scardubu/sabiscore)",
    ) -> None:
        merged: dict[str, str] = {"User-Agent": user_agent, "Accept": "application/json"}
        if headers:
            merged.update({k: v for k, v in headers.items() if v})
        self._base_url = base_url.rstrip("/")
        self._max_retries = max_retries
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            headers=merged,
            timeout=httpx.Timeout(timeout_seconds),
            follow_redirects=True,
        )

    # ------------------------------------------------------------------
    # Context manager
    # ------------------------------------------------------------------

    async def __aenter__(self) -> "AsyncJSONClient":
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        await self._client.aclose()

    # ------------------------------------------------------------------
    # Internal retry helper
    # ------------------------------------------------------------------

    def _make_retryer(self) -> AsyncRetrying:
        return AsyncRetrying(
            reraise=True,
            stop=stop_after_attempt(self._max_retries),
            wait=wait_exponential_jitter(initial=0.5, max=8.0),
            retry=retry_if_exception_type(self._RETRYABLE),
        )

    async def _execute_get(
        self,
        path: str,
        *,
        params: Mapping[str, Any] | None = None,
    ) -> httpx.Response:
        """Single GET call with rate-limit interception."""
        response = await self._client.get(path, params=params)
        if response.status_code == 429:
            retry_after: float | None = None
            raw_header = response.headers.get("Retry-After")
            if raw_header:
                try:
                    retry_after = float(raw_header)
                except ValueError:
                    retry_after = 60.0
            msg = (
                f"Rate-limited by {self._base_url}{path} "
                f"(Retry-After={retry_after}s)"
            )
            logger.warning(msg)
            raise ConnectorRateLimitError(msg, retry_after_seconds=retry_after)
        response.raise_for_status()
        return response

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    async def get_json(
        self,
        path: str,
        *,
        params: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        """GET ``path`` and return the parsed JSON object.

        Raises ``ConnectorError`` if the response is not a JSON object,
        ``ConnectorRateLimitError`` on HTTP 429, or re-raises ``httpx``
        exceptions after ``max_retries`` exhausted.
        """
        retryer = self._make_retryer()
        async for attempt in retryer:
            with attempt:
                response = await self._execute_get(path, params=params)
                payload = response.json()
                if not isinstance(payload, dict):
                    raise ConnectorError(
                        f"Expected JSON object from {self._base_url}{path}, "
                        f"got {type(payload).__name__!r}"
                    )
                return payload
        # tenacity with reraise=True never reaches here; satisfy type-checker.
        raise ConnectorError(f"Unreachable retry state for {path}")

    async def get_list(
        self,
        path: str,
        *,
        params: Mapping[str, Any] | None = None,
    ) -> list[Any]:
        """GET ``path`` and return the parsed JSON array.

        Useful for endpoints that return a bare JSON list rather than an
        envelope object.
        """
        retryer = self._make_retryer()
        async for attempt in retryer:
            with attempt:
                response = await self._execute_get(path, params=params)
                payload = response.json()
                if not isinstance(payload, list):
                    raise ConnectorError(
                        f"Expected JSON array from {self._base_url}{path}, "
                        f"got {type(payload).__name__!r}"
                    )
                return payload
        raise ConnectorError(f"Unreachable retry state for {path}")

    async def get_json_with_rate_limit_backoff(
        self,
        path: str,
        *,
        params: Mapping[str, Any] | None = None,
        max_wait_seconds: float = 120.0,
    ) -> dict[str, Any]:
        """Like ``get_json`` but honours ``Retry-After`` before re-attempting.

        Use this for sources (like football-data.org free tier) that have hard
        per-minute quotas rather than soft rate limits.
        """
        try:
            return await self.get_json(path, params=params)
        except ConnectorRateLimitError as exc:
            wait = min(exc.retry_after_seconds or 60.0, max_wait_seconds)
            logger.info("Honouring Retry-After: sleeping %.1f s for %s", wait, path)
            await asyncio.sleep(wait)
            return await self.get_json(path, params=params)
