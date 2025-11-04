from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.gzip import GZipMiddleware
import logging
import time
from typing import Dict

from ..core.cache import cache
from ..core.config import settings

logger = logging.getLogger(__name__)

class RateLimitMiddleware(BaseHTTPMiddleware):
    """Redis-backed fixed-window rate limiting."""

    def __init__(self, app, requests_per_window: int, window_seconds: int):
        super().__init__(app)
        self.requests_per_window = requests_per_window
        self.window_seconds = window_seconds
        self._memory_fallback: Dict[str, Dict[int, int]] = {}

    async def dispatch(self, request: Request, call_next):
        client_ip = (request.client.host if request.client else "unknown") or "unknown"
        window_start = int(time.time() // self.window_seconds * self.window_seconds)

        if self._is_rate_limited(client_ip, window_start):
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Too many requests",
                    "error_code": "RATE_LIMIT_EXCEEDED",
                },
            )

        return await call_next(request)

    def _is_rate_limited(self, client_ip: str, window_start: int) -> bool:
        redis_client = getattr(cache, "redis_client", None)

        if redis_client:
            key = f"ratelimit:{client_ip}:{window_start}"
            try:
                count = redis_client.incr(key)
                if count == 1:
                    redis_client.expire(key, self.window_seconds)
                return count > self.requests_per_window
            except Exception as exc:  # pragma: no cover - fallback path
                logger.warning("Redis rate limit fallback engaged: %s", exc)

        bucket = self._memory_fallback.setdefault(client_ip, {})
        bucket[window_start] = bucket.get(window_start, 0) + 1

        # prune old windows
        for ts in list(bucket.keys()):
            if ts < window_start:
                bucket.pop(ts, None)

        return bucket[window_start] > self.requests_per_window

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers when enabled."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        if settings.enable_security_headers:
            response.headers.setdefault("X-Content-Type-Options", "nosniff")
            response.headers.setdefault("X-Frame-Options", "DENY")
            response.headers.setdefault("X-XSS-Protection", "1; mode=block")
            response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")

            if settings.app_env != "development":
                response.headers.setdefault(
                    "Strict-Transport-Security",
                    "max-age=31536000; includeSubDomains",
                )
                response.headers.setdefault(
                    "Content-Security-Policy",
                    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
                )
            else:
                response.headers.setdefault(
                    "Content-Security-Policy",
                    "default-src 'self'; "
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:3000 http://127.0.0.1:3000; "
                    "style-src 'self' 'unsafe-inline'; "
                    "connect-src 'self' ws://localhost:3000 ws://127.0.0.1:3000 http://localhost:8000 http://127.0.0.1:8000;",
                )

        return response

class TimingMiddleware(BaseHTTPMiddleware):
    """Request timing and structured logging middleware."""

    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time

        logger.info(
            "request_completed",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round(process_time * 1000, 2),
            },
        )

        response.headers["X-Process-Time"] = f"{process_time:.6f}"
        return response

class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Global error handling middleware emitting structured errors."""

    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            return response
        except Exception as exc:  # pragma: no cover - safety net
            logger.exception("Unhandled application error", extra={"path": request.url.path})
            return JSONResponse(
                status_code=500,
                content={
                    "detail": "Internal server error",
                    "error_code": "INTERNAL_ERROR",
                    "timestamp": time.time(),
                },
            )

def setup_middleware(app):
    """Setup all middleware for the FastAPI app"""

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    # Trusted hosts (only in production or when explicitly configured)
    if settings.app_env == "production" and settings.allowed_hosts:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=settings.allowed_hosts,
        )

    # Rate limiting
    app.add_middleware(
        RateLimitMiddleware,
        requests_per_window=settings.rate_limit_requests,
        window_seconds=settings.rate_limit_window_seconds,
    )

    # Security headers
    app.add_middleware(SecurityHeadersMiddleware)

    # Response compression
    if settings.enable_response_compression:
        app.add_middleware(GZipMiddleware, minimum_size=500)

    # Timing and logging
    app.add_middleware(TimingMiddleware)

    # Error handling
    app.add_middleware(ErrorHandlingMiddleware)
