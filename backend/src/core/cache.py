import json
import logging
import pickle
import time
from dataclasses import dataclass
from functools import wraps
from threading import Lock
from typing import Any, Callable, Dict, Optional, Tuple
import hashlib
import fnmatch

import redis
from redis.exceptions import RedisError

from .config import settings


logger = logging.getLogger(__name__)


@dataclass
class CacheMetrics:
    """Simple in-memory metrics tracker for observability hooks."""

    hits: int = 0
    misses: int = 0
    errors: int = 0

    def record_hit(self) -> None:
        self.hits += 1

    def record_miss(self) -> None:
        self.misses += 1

    def record_error(self) -> None:
        self.errors += 1

    def as_dict(self) -> Dict[str, int]:
        return {
            "hits": self.hits,
            "misses": self.misses,
            "errors": self.errors,
        }


class RedisCache:
    def __init__(self) -> None:
        self.ttl = settings.redis_cache_ttl
        self.metrics = CacheMetrics()
        self._circuit_open_until: Optional[float] = None
        self._memory_cache: Dict[str, Tuple[Any, Optional[float]]] = {}
        self._lock = Lock()
        self._enabled = settings.redis_enabled
        self._redis_available = False
        self.redis_client: Optional[redis.Redis] = None

        if self._enabled:
            try:
                client = redis.Redis.from_url(
                    settings.redis_url,
                    max_connections=settings.redis_max_connections,
                    decode_responses=False,
                    health_check_interval=30,
                    socket_timeout=5,
                    socket_connect_timeout=5
                )
                client.ping()
                self.redis_client = client
                self._redis_available = True
            except (RedisError, ConnectionError, TimeoutError) as exc:
                logger.warning("Redis unavailable, using in-memory cache only: %s", exc)
                self.metrics.record_error()
                self._enabled = False
                self.redis_client = None

    # Internal helpers -------------------------------------------------
    def _is_circuit_open(self) -> bool:
        if self._circuit_open_until is None:
            return False
        if time.time() > self._circuit_open_until:
            self._circuit_open_until = None
            return False
        return True

    def _trip_circuit(self, cooldown_seconds: int = 30) -> None:
        self._circuit_open_until = time.time() + cooldown_seconds
        logger.warning("Redis circuit opened for %s seconds", cooldown_seconds)

    def _serialize(self, value: Any) -> bytes:
        # Ensure MagicMock or non-JSON-serializable objects don't leak
        try:
            if hasattr(value, "model_dump"):
                value = value.model_dump(mode="json")  # type: ignore[attr-defined]
            return json.dumps(value).encode("utf-8")
        except (TypeError, ValueError):
            return pickle.dumps(value, protocol=pickle.HIGHEST_PROTOCOL)

    def _deserialize(self, payload: Optional[bytes]) -> Any:
        if payload is None:
            return None
        try:
            return json.loads(payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            try:
                return pickle.loads(payload)
            except pickle.UnpicklingError:
                logger.error("Failed to deserialize cache payload")
                self.metrics.record_error()
                return None

    # Public API -------------------------------------------------------
    def get(self, key: str) -> Optional[Any]:
        if not self._enabled or self._is_circuit_open() or not self.redis_client:
            logger.debug("Circuit open or Redis unavailable. Using in-memory cache for %s", key)
            return self._read_from_memory(key)

        try:
            payload = self.redis_client.get(key)
            self._redis_available = True
            if payload is None:
                fallback = self._read_from_memory(key, record_metrics=False)
                if fallback is None:
                    self.metrics.record_miss()
                else:
                    self.metrics.record_hit()
                return fallback

            self.metrics.record_hit()
            return self._deserialize(payload)
        except RedisError as exc:
            logger.error("Cache get error: %s", exc)
            self.metrics.record_error()
            self._trip_circuit()
            self._redis_available = False
            return self._read_from_memory(key)

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        ttl_value = ttl or self.ttl

        if self._enabled and not self._is_circuit_open() and self.redis_client:
            try:
                payload = self._serialize(value)
                if self.redis_client.setex(key, ttl_value, payload):
                    self._redis_available = True
                    self._write_to_memory(key, value, ttl_value)
                    return True
            except RedisError as exc:
                logger.error("Cache set error: %s", exc)
                self.metrics.record_error()
                self._trip_circuit()
                self._redis_available = False

        return self._write_to_memory(key, value, ttl_value)

    def delete(self, key: str) -> bool:
        deleted = False
        if self._enabled and self.redis_client:
            try:
                deleted = bool(self.redis_client.delete(key))
                self._redis_available = True
            except RedisError as exc:
                logger.error("Cache delete error: %s", exc)
                self.metrics.record_error()
                self._redis_available = False

        return self._delete_from_memory(key) or deleted

    def exists(self, key: str) -> bool:
        if self._enabled and self.redis_client:
            try:
                if self.redis_client.exists(key):
                    self._redis_available = True
                    return True
            except RedisError as exc:
                logger.error("Cache exists error: %s", exc)
                self.metrics.record_error()
                self._redis_available = False

        value = self._read_from_memory(key, record_metrics=False)
        return value is not None

    def clear_pattern(self, pattern: str) -> int:
        if not self._enabled or not self.redis_client:
            return self._purge_memory(pattern)
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                deleted = self.redis_client.delete(*keys)
                self._redis_available = True
                return deleted
            self._redis_available = True
            return 0
        except RedisError as exc:
            logger.error("Cache clear pattern error: %s", exc)
            self.metrics.record_error()
            self._redis_available = False
            return self._purge_memory(pattern)

    def clear_namespace(self, namespace: str) -> int:
        """Clear all keys matching namespace pattern"""
        pattern = f"{namespace}:*"
        if self._enabled and self.redis_client:
            try:
                keys = self.redis_client.keys(pattern)
                if keys:
                    deleted = self.redis_client.delete(*keys)
                    self._redis_available = True
                    return deleted
                return 0
            except RedisError as exc:
                logger.error("Namespace clear error: %s", exc)
                self.metrics.record_error()
                self._redis_available = False
        return self._purge_memory(pattern)

    def ping(self) -> bool:
        if not self._enabled:
            return True
        if not self.redis_client:
            self._redis_available = False
            return bool(self._memory_cache)

        try:
            self._redis_available = bool(self.redis_client.ping())
            return self._redis_available
        except RedisError as exc:
            logger.error("Redis ping failed: %s", exc)
            self.metrics.record_error()
            self._trip_circuit()
            self._redis_available = False
            return bool(self._memory_cache)

    def metrics_snapshot(self) -> Dict[str, Any]:
        with self._lock:
            memory_entries = len(self._memory_cache)
        snapshot = self.metrics.as_dict()
        snapshot.update({
            "circuit_open": bool(self._is_circuit_open()),
            "memory_entries": memory_entries,
            "backend_enabled": self._enabled,
            "backend_available": self._redis_available,
        })
        return snapshot

    # Memory fallback helpers ------------------------------------------
    def _read_from_memory(self, key: str, record_metrics: bool = True) -> Optional[Any]:
        with self._lock:
            entry = self._memory_cache.get(key)
            if not entry:
                if record_metrics:
                    self.metrics.record_miss()
                return None

            value, expires_at = entry
            if expires_at is not None and expires_at < time.time():
                self._memory_cache.pop(key, None)
                if record_metrics:
                    self.metrics.record_miss()
                return None

        if record_metrics:
            self.metrics.record_hit()
        # Return a deep JSON-friendly copy if possible to avoid test-time mutation or mocks
        try:
            if hasattr(value, "model_dump"):
                return value.model_dump(mode="json")  # type: ignore[attr-defined]
            json_payload = json.dumps(value, default=str)
            return json.loads(json_payload)
        except Exception:
            return value

    def _write_to_memory(self, key: str, value: Any, ttl: Optional[int]) -> bool:
        expires_at = time.time() + ttl if ttl else None
        with self._lock:
            self._memory_cache[key] = (value, expires_at)
        return True

    def _delete_from_memory(self, key: str) -> bool:
        with self._lock:
            return self._memory_cache.pop(key, None) is not None

    def _purge_memory(self, pattern: str) -> int:
        removed = 0
        with self._lock:
            for key in list(self._memory_cache.keys()):
                if fnmatch.fnmatch(key, pattern):
                    self._memory_cache.pop(key, None)
                    removed += 1
        return removed


# Global cache instance
cache = RedisCache()


def cache_decorator(ttl: Optional[int] = None):
    """Decorator to cache function results."""

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            cache_key = _make_cache_key(func.__name__, args, kwargs)

            cached_result = cache.get(cache_key)
            if cached_result is not None:
                logger.debug("Cache hit for %s", cache_key)
                return cached_result

            result = func(*args, **kwargs)
            if result is not None:
                cache.set(cache_key, result, ttl)
                logger.debug("Cache set for %s", cache_key)

            return result

        return wrapper

    return decorator


def _make_cache_key(prefix: str, args: tuple, kwargs: dict) -> str:
    """Build a deterministic cache key resilient to complex argument types."""

    def _normalize(value: Any) -> Any:
        if isinstance(value, (str, int, float, bool)) or value is None:
            return value
        if isinstance(value, (list, tuple)):
            return [_normalize(item) for item in value]
        if isinstance(value, dict):
            return {str(k): _normalize(v) for k, v in sorted(value.items())}
        if hasattr(value, "to_dict"):
            try:
                return value.to_dict()
            except Exception:
                pass
        if hasattr(value, "to_json"):
            try:
                return json.loads(value.to_json())
            except Exception:
                pass
        return repr(value)

    normalized = {
        "args": _normalize(args),
        "kwargs": _normalize(kwargs),
    }

    digest = hashlib.sha1(json.dumps(normalized, sort_keys=True, default=str).encode("utf-8")).hexdigest()
    return f"cache:{prefix}:{digest}"
