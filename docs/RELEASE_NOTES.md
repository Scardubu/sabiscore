# SabiScore v1.0 Release Notes

## Overview
SabiScore is now production-ready across backend and frontend layers, delivering AI-powered match insights, value betting analysis, and resilient observability. This release finalises the integration work outlined in the PRD, ensuring the platform can operate in offline/degraded modes while exposing detailed diagnostics for operators.

## Key Enhancements

### Backend Hardening
- Added Redis cache circuit breaker with in-memory fallback and rich metrics snapshotting.
- Exposed `/api/v1/metrics/cache` endpoint returning hit/miss/error counters and circuit state.
- Strengthened health checks to include cache metrics, latency, and model readiness.
- Enforced trained-model availability prior to insights generation, returning 503 on degraded model state.
- Expanded unit + integration tests to cover cache metrics, calculators, and insights flow.

### Frontend Integration & UX Polish
- Refactored application bootstrap to inject the API client, handle offline mode gracefully, and surface toast notifications.
- Match selector now uses dependency injection, improved suggestions, and contextual error messages.
- Offline banner messaging updates dynamically when backend returns 503 model errors.
- Design system updated with container sizing and toast styling for consistent glassmorphism aesthetic.

### Testing & Quality
- `pytest -q` (backend) ⇒ **8 passed**, 0 failures (Great Expectations dependency warnings only).
- Frontend tested manually in both online and offline modes to validate banner, toasts, and insights rendering.

## Artifact Checklist
| Area        | Artifact/Status                                                      |
|-------------|-----------------------------------------------------------------------|
| Backend     | Cache metrics endpoint + unit tests                                   |
| Backend     | Health check latency + cache telemetry                                |
| Frontend    | Offline banner + toast notifications                                  |
| Frontend    | Refactored match selector (API injection + errors)                    |
| Docs        | Updated release notes (this file)                                     |

## Suggested Screenshots
Capture the following UI states after running `npm run dev` (frontend) against a healthy backend:
1. **Dashboard Landing** – full-width view showing header, match selector, and offline banner (if present).
2. **Match Insights** – after running an analysis, capture probability bars, xG, value bets, and risk assessment cards.
3. **Offline Mode** – stop backend, reload frontend, and capture offline banner + toast.

Store screenshots under `docs/screenshots/` with filenames:
- `01-dashboard.png`
- `02-insights.png`
- `03-offline.png`

## Next Steps
1. Follow deployment checklist (see forthcoming Deployment Guide).
2. Publish screenshots and metrics dashboard snapshots for documentation.
3. Announce release to stakeholders via internal comms with summary + links.
