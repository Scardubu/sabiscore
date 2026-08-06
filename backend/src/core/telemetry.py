"""OpenTelemetry activation — ADR-0006.

No-op unless BOTH ``enable_tracing`` and ``otel_exporter_otlp_endpoint`` are
configured; nothing in this repository depends on spans/metrics existing, so
leaving either unset changes zero live behavior. Mirrors the Sentry
conditional-init pattern in ``api/main.py`` structurally.

Exporter choice (ADR-0006 open question, resolved): OTLP/HTTP, not OTLP/gRPC.
``opentelemetry-exporter-otlp-proto-grpc`` pulls in ``grpcio``, a native
extension with real memory/build cost on the single free-tier Render dyno this
platform runs on (see docs/DEBT.md item 3 and ADR-0006 §"Cost"). The HTTP
exporter needs only ``requests``, already a transitive dependency.
"""

from __future__ import annotations

import logging

from .config import settings

logger = logging.getLogger("sabiscore.telemetry")

_tracer_provider = None


def setup_telemetry() -> None:
    """No-op unless both enable_tracing and an OTLP endpoint are configured."""

    if not settings.enable_tracing or not settings.otel_exporter_otlp_endpoint:
        return

    global _tracer_provider

    from opentelemetry import metrics, trace
    from opentelemetry.exporter.otlp.proto.http.metric_exporter import (
        OTLPMetricExporter,
    )
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
        OTLPSpanExporter,
    )
    from opentelemetry.sdk.metrics import MeterProvider
    from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    endpoint = settings.otel_exporter_otlp_endpoint
    resource = Resource.create({"service.name": "sabiscore-api"})

    _tracer_provider = TracerProvider(resource=resource)
    _tracer_provider.add_span_processor(
        BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint))
    )
    trace.set_tracer_provider(_tracer_provider)

    metrics.set_meter_provider(
        MeterProvider(
            resource=resource,
            metric_readers=[
                PeriodicExportingMetricReader(OTLPMetricExporter(endpoint=endpoint))
            ],
        )
    )
    logger.info("OpenTelemetry tracing active (OTLP/HTTP, endpoint configured)")


def shutdown_telemetry() -> None:
    """Flush and shut down the tracer provider, if one was registered."""

    if _tracer_provider is None:
        return
    try:
        _tracer_provider.shutdown()
    except Exception:
        logger.exception("Failed to shut down OpenTelemetry tracer provider")


__all__ = ["setup_telemetry", "shutdown_telemetry"]
