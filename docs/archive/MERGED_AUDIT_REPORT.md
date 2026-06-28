# Merged Forensic Audit Report — SabiScore Platform (v6.8)

**Date:** 01 Dec 2025  \
**Scope:** Unified backend, scraping, ML, frontend, DevOps, and compliance posture across live Render (API) and Vercel (web) deployments.  \
**Methodology:** Integrated code-walkthrough (backend `src/`, scrapers, ML configs), telemetry review (Brier, ROI, latency, scraper error rates), infrastructure scripts, and UI/UX review. Findings prioritize production impact on accuracy, ROI, compliance, and latency.

## Executive Summary
- Production is stable but key subsystems (scrapers, AutoGluon ensemble, consent UX) lag behind desired 90%+ confidence accuracy and 4-6s edge capture goals.
- Legacy scraper patterns (per-source fetchers, no robots gating) risk compliance incidents and slow aggregation (9-14s).
- Ensemble pipeline lacks stacking + calibration, explaining current Brier ~0.150 and missed ROI upside.
- Frontend lacks explicit GDPR/Responsible Gambling gates and still allows CLS drift in loading flows.

## Severity Legend
| Severity | Definition |
| --- | --- |
| Critical | Immediate production/business risk (accuracy, compliance, uptime). |
| High | Material impact on KPIs/SLAs; fix in current sprint. |
| Medium | Noticeable degradation but with workarounds. |
| Low | Cosmetic or long-term improvements. |

## Findings & Recommendations

### 1. Scraping & Data Ingestion
| Severity | Finding | Impact | Recommendation |
| --- | --- | --- | --- |
| **Critical** | Scrapers bypass robots.txt, lack rate limiting/circuit breakers. | Legal/compliance exposure; higher ban rate; observed 429 spikes. | Introduce `BaseScraper` with robots checker, `AsyncLimiter`, tenacity retry, circuit-breaker, and local dataset fallback. |
| **High** | Sequential aggregation `aggregator.py` causes 9-14s latency and single-point failures. | Slower model refresh, higher cache miss latency. | Parallelize via `asyncio.gather`; add fallback helper + priority merge. |
| **Medium** | WhoScored scraper still referenced despite target blocking bots. | Sustained 403s & wasted retries. | Remove WhoScored, route stats to Soccerway/Understat fallback pipeline. |
| **Medium** | Historical CSV fallback not merged with live stream, leading to schema drift. | Occasional missing features => inference drop. | Ensure `_load_local/_save_local` merges delta snapshots; add checksum logging. |

### 2. ML Models & Features
| Severity | Finding | Impact | Recommendation |
| --- | --- | --- | --- |
| **Critical** | AutoGluon config lacks stacking, bagging folds, and calibration. | Brier stuck at ~0.150, accuracy plateau 76-78%. | Add `num_stack_levels=2`, `num_bag_folds=8`, 7200s train window, and isotonic calibration. |
| **High** | Advanced features (form momentum, liquidity spreads, PPDA differentials, referee bias) absent. | +5-8% potential accuracy left on table. | Implement `engineer_advanced_features` with merged feature set. |
| **High** | Models stored only under `/models` without deploy copy step. | Render dynos miss `enhanced_v2` artifacts after redeploy. | Update `render.yaml`/build scripts to copy into `backend/models/` during build. |
| **Medium** | Calibration drift not tracked post-deploy. | No alerting when Brier >0.13. | Emit Brier/accuracy per release to Prometheus + Sentry breadcrumbs. |

### 3. Security & Compliance
| Severity | Finding | Impact | Recommendation |
| --- | --- | --- | --- |
| **High** | No GDPR consent banner, Responsible Gambling prompt, or age gate. | Regulatory risk for EU users. | Implement `ConsentBanner`, age verification hook, update privacy copy. |
| **Medium** | JWT endpoints lack per-IP throttling; login scraping risk. | Elevated abuse risk. | Add rate limit middleware + WAF rules. |
| **Medium** | Scraper data stored without anonymization or retention policy. | Compliance gaps. | Add retention config + hashed identifiers in persisted logs. |

### 4. Frontend Performance & UX
| Severity | Finding | Impact | Recommendation |
| --- | --- | --- | --- |
| **High** | Match loading/interstitials still allow layout shift (dynamic height, unlocked body scroll). | CLS 0.08 vs 0 target; user perception of jitter. | Lock heights, maintain overflow control already scaffolded in `match-selector`. |
| **High** | Interstitial v2, polls, onboarding flows incomplete. | Less engagement; no fan pulse data. | Finish `MatchLoadingExperience`, integrate fan pulse state sharing. |
| **Medium** | Missing ARIA roles + keyboard traps in dialogs. | Accessibility compliance risk. | Add ARIA attrs + focus management. |

### 5. Testing & Monitoring
| Severity | Finding | Impact | Recommendation |
| --- | --- | --- | --- |
| **High** | Coverage 53%, especially low around scrapers & predictions. | Hard to prevent regressions for mission-critical logic. | Expand pytest/jest suites incl. mocked scrapers, feature flags, consent flows. Target ≥70%. |
| **Medium** | Smoke test still hits deprecated `/api/matches`. | False negatives, slow verification. | Update to `/api/v1/matches/teams/search` and align with real backend contract. |
| **Medium** | No automated blue-green validation script or rollback triggers. | Manual errors during deploys. | Script Render/Vercel canary rollout with automatic KPI guardrails. |

## Next Steps
1. Implement compliant `BaseScraper`, parallel aggregator, and fallback chain (Phase 1).
2. Introduce enhanced training pipeline + feature engineering (`enhanced_training.py`), copy models into deploy artifact, wrap behind `FeatureFlag.ENHANCED_MODELS_V2` (Phase 2).
3. Finish interstitial UX + consent tooling and asset validation (Phase 3).
4. Update deployment scripts + docs, integrate Prometheus/Sentry watchers (Phase 4).
