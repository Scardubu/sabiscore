"""Production monitoring and metrics collection for SabiScore."""

import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta
from functools import wraps
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


class MetricsCollector:
    """Lightweight metrics aggregation for production monitoring."""

    def __init__(self):
        self._counters: Dict[str, int] = defaultdict(int)
        self._gauges: Dict[str, float] = {}
        self._histograms: Dict[str, List[float]] = defaultdict(list)
        self._timers: Dict[str, List[float]] = defaultdict(list)
        self._errors: List[Dict[str, Any]] = []
        self._start_time = time.time()
        self._last_reset = datetime.utcnow()
        
        # Scraper-specific metrics
        self._scraper_calls: Dict[str, int] = defaultdict(int)
        self._scraper_errors: Dict[str, int] = defaultdict(int)
        self._scraper_latencies: Dict[str, List[float]] = defaultdict(list)
        
        # Prediction-specific metrics
        self._prediction_latencies: List[float] = []
        self._cache_hits = 0
        self._cache_misses = 0
        
        # Value bet tracking
        self._value_bets_found = 0
        self._edge_values: List[float] = []

    def increment(self, metric: str, value: int = 1) -> None:
        """Increment a counter metric."""
        self._counters[metric] += value

    def set_gauge(self, metric: str, value: float) -> None:
        """Set a gauge metric to a specific value."""
        self._gauges[metric] = value

    def record_histogram(self, metric: str, value: float) -> None:
        """Record a value in a histogram."""
        self._histograms[metric].append(value)
        # Keep only last 1000 values to prevent memory bloat
        if len(self._histograms[metric]) > 1000:
            self._histograms[metric] = self._histograms[metric][-1000:]

    def record_timer(self, metric: str, duration_ms: float) -> None:
        """Record timing data."""
        self._timers[metric].append(duration_ms)
        if len(self._timers[metric]) > 1000:
            self._timers[metric] = self._timers[metric][-1000:]

    def record_error(
        self,
        error_type: str,
        message: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Log error for monitoring dashboard."""
        error_record = {
            "timestamp": datetime.utcnow().isoformat(),
            "type": error_type,
            "message": message,
            "context": context or {},
        }
        self._errors.append(error_record)
        # Keep only last 100 errors
        if len(self._errors) > 100:
            self._errors = self._errors[-100:]

    def record_scraper_call(
        self,
        scraper_name: str,
        duration_ms: float,
        success: bool = True,
    ) -> None:
        """Track scraper performance and reliability."""
        self._scraper_calls[scraper_name] += 1
        self._scraper_latencies[scraper_name].append(duration_ms)
        
        if not success:
            self._scraper_errors[scraper_name] += 1
            
        # Limit latency tracking
        if len(self._scraper_latencies[scraper_name]) > 500:
            self._scraper_latencies[scraper_name] = (
                self._scraper_latencies[scraper_name][-500:]
            )

    def record_prediction(
        self,
        duration_ms: float,
        confidence: float,
        value_bets: int = 0,
        edge: Optional[float] = None,
        cache_hit: bool = False,
    ) -> None:
        """Track prediction service performance."""
        self._prediction_latencies.append(duration_ms)
        
        if cache_hit:
            self._cache_hits += 1
        else:
            self._cache_misses += 1
            
        if value_bets > 0:
            self._value_bets_found += value_bets
            
        if edge is not None:
            self._edge_values.append(edge)
            
        # Limit tracking
        if len(self._prediction_latencies) > 1000:
            self._prediction_latencies = self._prediction_latencies[-1000:]
        if len(self._edge_values) > 500:
            self._edge_values = self._edge_values[-500:]

    def get_summary(self) -> Dict[str, Any]:
        """Generate summary statistics for monitoring dashboard."""
        uptime_seconds = time.time() - self._start_time
        
        summary = {
            "uptime_seconds": uptime_seconds,
            "uptime_human": str(timedelta(seconds=int(uptime_seconds))),
            "last_reset": self._last_reset.isoformat(),
            "counters": dict(self._counters),
            "gauges": dict(self._gauges),
            "recent_errors": self._errors[-10:],  # Last 10 errors
        }
        
        # Add histogram percentiles
        if self._histograms:
            summary["histograms"] = {}
            for metric, values in self._histograms.items():
                if values:
                    sorted_values = sorted(values)
                    summary["histograms"][metric] = {
                        "count": len(values),
                        "min": min(values),
                        "max": max(values),
                        "mean": sum(values) / len(values),
                        "p50": sorted_values[len(sorted_values) // 2],
                        "p95": sorted_values[int(len(sorted_values) * 0.95)],
                        "p99": sorted_values[int(len(sorted_values) * 0.99)],
                    }
        
        # Add timer statistics
        if self._timers:
            summary["timers"] = {}
            for metric, durations in self._timers.items():
                if durations:
                    sorted_durations = sorted(durations)
                    summary["timers"][metric] = {
                        "count": len(durations),
                        "min_ms": min(durations),
                        "max_ms": max(durations),
                        "mean_ms": sum(durations) / len(durations),
                        "p50_ms": sorted_durations[len(sorted_durations) // 2],
                        "p95_ms": sorted_durations[int(len(sorted_durations) * 0.95)],
                        "p99_ms": sorted_durations[int(len(sorted_durations) * 0.99)],
                    }
        
        # Scraper health
        if self._scraper_calls:
            summary["scrapers"] = {}
            for scraper, calls in self._scraper_calls.items():
                errors = self._scraper_errors.get(scraper, 0)
                latencies = self._scraper_latencies.get(scraper, [])
                
                scraper_stats = {
                    "calls": calls,
                    "errors": errors,
                    "error_rate": errors / calls if calls > 0 else 0,
                    "success_rate": 1 - (errors / calls) if calls > 0 else 1.0,
                }
                
                if latencies:
                    sorted_latencies = sorted(latencies)
                    scraper_stats.update({
                        "avg_latency_ms": sum(latencies) / len(latencies),
                        "p95_latency_ms": sorted_latencies[int(len(sorted_latencies) * 0.95)],
                    })
                
                summary["scrapers"][scraper] = scraper_stats
        
        # Prediction metrics
        if self._prediction_latencies:
            sorted_pred = sorted(self._prediction_latencies)
            summary["predictions"] = {
                "total": len(self._prediction_latencies),
                "cache_hits": self._cache_hits,
                "cache_misses": self._cache_misses,
                "cache_hit_rate": (
                    self._cache_hits / (self._cache_hits + self._cache_misses)
                    if (self._cache_hits + self._cache_misses) > 0
                    else 0
                ),
                "avg_latency_ms": sum(self._prediction_latencies) / len(self._prediction_latencies),
                "p95_latency_ms": sorted_pred[int(len(sorted_pred) * 0.95)],
                "value_bets_found": self._value_bets_found,
            }
            
            if self._edge_values:
                summary["predictions"]["avg_edge"] = (
                    sum(self._edge_values) / len(self._edge_values)
                )
        
        return summary

    def reset(self) -> None:
        """Reset all metrics (useful for testing or daily resets)."""
        self._counters.clear()
        self._gauges.clear()
        self._histograms.clear()
        self._timers.clear()
        self._errors.clear()
        self._scraper_calls.clear()
        self._scraper_errors.clear()
        self._scraper_latencies.clear()
        self._prediction_latencies.clear()
        self._cache_hits = 0
        self._cache_misses = 0
        self._value_bets_found = 0
        self._edge_values.clear()
        self._last_reset = datetime.utcnow()
        logger.info("Metrics collector reset")


# Global metrics collector instance
metrics_collector = MetricsCollector()


def monitor_latency(metric_name: str) -> Callable:
    """Decorator to monitor function execution time."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start = time.time()
            try:
                result = await func(*args, **kwargs)
                duration_ms = (time.time() - start) * 1000
                metrics_collector.record_timer(metric_name, duration_ms)
                return result
            except Exception as exc:
                duration_ms = (time.time() - start) * 1000
                metrics_collector.record_timer(f"{metric_name}_error", duration_ms)
                metrics_collector.record_error(
                    error_type=type(exc).__name__,
                    message=str(exc),
                    context={"function": func.__name__},
                )
                raise
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start = time.time()
            try:
                result = func(*args, **kwargs)
                duration_ms = (time.time() - start) * 1000
                metrics_collector.record_timer(metric_name, duration_ms)
                return result
            except Exception as exc:
                duration_ms = (time.time() - start) * 1000
                metrics_collector.record_timer(f"{metric_name}_error", duration_ms)
                metrics_collector.record_error(
                    error_type=type(exc).__name__,
                    message=str(exc),
                    context={"function": func.__name__},
                )
                raise
        
        # Return appropriate wrapper based on function type
        if hasattr(func, "__code__") and func.__code__.co_flags & 0x80:
            return async_wrapper
        return sync_wrapper
    
    return decorator


def monitor_scraper(scraper_name: str) -> Callable:
    """Decorator to monitor scraper performance."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start = time.time()
            success = True
            try:
                result = await func(*args, **kwargs)
                return result
            except Exception as exc:
                success = False
                raise
            finally:
                duration_ms = (time.time() - start) * 1000
                metrics_collector.record_scraper_call(
                    scraper_name,
                    duration_ms,
                    success,
                )
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start = time.time()
            success = True
            try:
                result = func(*args, **kwargs)
                return result
            except Exception as exc:
                success = False
                raise
            finally:
                duration_ms = (time.time() - start) * 1000
                metrics_collector.record_scraper_call(
                    scraper_name,
                    duration_ms,
                    success,
                )
        
        if hasattr(func, "__code__") and func.__code__.co_flags & 0x80:
            return async_wrapper
        return sync_wrapper
    
    return decorator
