# 0006 — OpenTelemetry activation

**Status:** Proposed · 2026-08-05

## Context

`docs/DEBT.md` item 3 documents this gap: no `TracerProvider`, `MeterProvider`, or
OTLP exporter exists anywhere in the tree despite `opentelemetry-sdk` and
`opentelemetry-instrumentation-fastapi` already being pinned dependencies
(`backend/requirements.txt:175-177`). Two files already hold dormant
instrumentation that has never once emitted data: `backend/src/models/
prediction.py:51-55` (a soft-imported tracer wrapping prediction-latency spans) and
`backend/src/monitoring/drift.py:21` (metrics instruments created at import time,
for a module that itself currently has zero production callers — a separate,
already-tracked gap). `settings.enable_tracing` (`backend/src/core/config.py:129`)
is a boolean gate defined and never read.

Registering a real provider is safe code to write (it can be a no-op unless
explicitly configured), but three things need an explicit decision before turning
it on for real, which is why `docs/DEBT.md` gates this behind an ADR rather than a
code drop:

1. **Exporter target** — no observability backend (Grafana/Jaeger/SigNoz/a hosted
   OTLP collector) is currently provisioned or referenced anywhere for SabiScore.
   Shipping the wiring with the endpoint unset is safe; picking where spans
   actually go once someone does configure it is a real decision.
2. **Sampling policy** — full sampling costs nothing at today's off-season, near-zero
   traffic, but the decision should be revisited once real traffic exists rather
   than silently inherited as a default forever.
3. **Cost on a free-tier Render dyno** — the platform currently runs on a memory-
   constrained free instance (confirmed by the operator-action note in `docs/
   DEBT.md`'s closing section, describing the same dyno). Span-batching processors
   and OTLP export add CPU/memory overhead and, if the endpoint is remote, egress
   traffic — worth a deliberate acknowledgment, not an assumption.

## Decision (ready to execute once approved — not built yet)

`backend/src/core/config.py` — reuse `enable_tracing` (line 129) as the boolean
gate; add the export-target field a boolean alone can't express:
```python
otel_exporter_otlp_endpoint: Optional[str] = Field(default=None, alias="OTEL_EXPORTER_OTLP_ENDPOINT")
```

New `backend/src/core/telemetry.py`, mirroring the existing Sentry conditional-init
pattern in `api/main.py:19-37` structurally:
```python
from .config import settings

def setup_telemetry() -> None:
    """No-op unless both enable_tracing and an OTLP endpoint are configured."""
    if not settings.enable_tracing or not settings.otel_exporter_otlp_endpoint:
        return
    from opentelemetry import trace, metrics
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.sdk.metrics import MeterProvider
    from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
    from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
    from opentelemetry.sdk.resources import Resource

    resource = Resource.create({"service.name": "sabiscore-api"})
    trace.set_tracer_provider(TracerProvider(resource=resource))
    trace.get_tracer_provider().add_span_processor(
        BatchSpanProcessor(OTLPSpanExporter(endpoint=settings.otel_exporter_otlp_endpoint))
    )
    metrics.set_meter_provider(MeterProvider(
        resource=resource,
        metric_readers=[PeriodicExportingMetricReader(
            OTLPMetricExporter(endpoint=settings.otel_exporter_otlp_endpoint)
        )],
    ))

def shutdown_telemetry() -> None:
    if not settings.enable_tracing or not settings.otel_exporter_otlp_endpoint:
        return
    from opentelemetry import trace
    trace.get_tracer_provider().shutdown()
```
**Open question this ADR must answer before implementation, not defer again:**
`opentelemetry-exporter-otlp-proto-grpc` is NOT yet in `requirements.txt` — either
that gets added (one new pinned dependency) or the design switches to
`-proto-http` if a decision is made to avoid adding a gRPC dependency. Pick one
explicitly when this ADR is approved.

`backend/src/api/main.py` wiring (two insertion points, both inert until the env
var is set): module level, `setup_telemetry()` call near the existing Sentry block
(before line 62); `FastAPIInstrumentor.instrument_app(app)` right after `app =
FastAPI(...)` (after line 298, before `setup_middleware(app)` at line 315) —
matches "registered before router mounts." `shutdown_telemetry()` added to the
lifespan shutdown block (after line 203) so it flushes last.

No changes needed to `prediction.py` or `drift.py` — once a real provider is
registered, their existing dormant instrumentation starts working with zero
changes to those files. `drift.py`'s metrics still need its own callers wired
before they matter (already a separate, tracked gap — not resolved by this ADR).

## Alternatives considered

**(a) Ship the code now, leave the endpoint unset, treat "inert by default" as
sufficient safety without an ADR.** This is what the stream looked like before this
correction. Rejected: `docs/DEBT.md` explicitly asks for the exporter/sampling/cost
decision before any implementation, and overriding that silently — even for
genuinely-safe code — would be a real, quiet deviation from a decision the project
already made in writing, not this session's call to make unilaterally.

**(b) Structured-log-only counters for the one concrete near-term risk
(`docs/DEBT.md` item 3's fixture-sync-failure blind spot), skipping full OTel for
now.** Cheaper, no ADR needed, ships independently. Worth doing regardless of this
ADR's outcome — flagged as a small adjacent item, not built as part of this stream
(scope discipline).

## Consequences

- Until this ADR is approved, `prediction.py`'s and `drift.py`'s instrumentation
  stays exactly as dormant as it is today — no regression, no change.
- Once approved and implemented, cost/overhead lands on the free-tier dyno
  immediately upon setting the env var — the ADR's sampling-policy answer directly
  controls how much.
- Approving this also answers `docs/DEBT.md` item 3's fixture-sync-failure-signal
  half for free, once a `MeterProvider` exists to increment a counter into.

## Reversal

**Cost:** low. `setup_telemetry()`/`FastAPIInstrumentor.instrument_app()` are both
no-ops with the env var unset; removing them removes zero live behavior since
nothing depends on spans/metrics existing today.
**Trigger:** if the chosen exporter target changes, or if overhead on the free-tier
dyno proves non-trivial even at a conservative sampling rate — in which case revisit
sampling policy before removing the wiring entirely.
