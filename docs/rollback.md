# SabiScore — Rollback Instructions (C-25)

This document satisfies certification gate C-25 of the SABI-CORE vΩ.1 directive.

## Quick rollback (git)

```bash
# Identify the last known-good commit
git log --oneline -10

# Rollback to a specific commit (DESTRUCTIVE — loses local uncommitted changes)
git reset --hard <known-good-sha>

# Or, safer: create a revert commit that undoes a bad commit
git revert <bad-sha> --no-edit
```

## Current certified commit

```
a6c4fe6  feat: SABI-CORE production hardening — zero-fabrication, provider ceilings, league policy
```

Previous stable commit: `a5a94f9 feat: finalize production data intelligence workflow`

---

## Service-level rollback

### Backend (FastAPI)

```bash
# Railway / any PaaS
railway rollback            # rolls back to previous deploy

# Docker Compose (self-hosted)
docker compose -f docker-compose.prod.yml down
docker pull sabiscore-backend:<previous-tag>
IMAGE_TAG=<previous-tag> docker compose -f docker-compose.prod.yml up -d
```

### Frontend (Vercel)

1. Open Vercel dashboard → your project → **Deployments**
2. Find the last green deployment before the bad one
3. Click **⋮ → Promote to Production**

This requires no code changes and takes ~30 seconds.

### Database

Alembic migrations are additive and backward-compatible. A code rollback does **not** require a database rollback unless a migration added a column that the rolled-back code rejects.

To check: `alembic history` — compare against the new code's expectations.

If a downgrade is needed:

```bash
cd backend
alembic downgrade -1          # one step back
alembic downgrade <revision>  # specific revision
```

**Never** run `alembic downgrade base` in production. Alembic migrations are designed to be applied forward only in production; reserve full downgrades for staging.

---

## Environment variable rollback

If a credential or feature flag change caused the rollback, revert only those variables in your hosting environment without redeploying code:

| Provider issue | Fix |
|---|---|
| FDO 400 errors | Rotate `FOOTBALL_DATA_API_KEY` in provider console; update env |
| API-Football quota | Set `API_FOOTBALL_DAILY_REQUEST_LIMIT` lower; or set `ENABLE_API_FOOTBALL_PROVIDER=false` |
| Odds API credit burn | Set `THE_ODDS_API_MONTHLY_CREDIT_LIMIT`; or disable with `ENABLE_THE_ODDS_API_PROVIDER=false` |
| All providers failing | Set `PROVIDER_FAIL_CLOSED=false` temporarily to diagnose (NEVER in production beyond 15 min) |
| Mock data in prod | Confirm `MOCK_MODE=false` and `DEBUG=false` |

---

## Rollback decision matrix

| Symptom | Rollback? | Action |
|---|---|---|
| 5xx rate spikes on `/api/v1/providers/*` | Maybe | Check provider health first; may be upstream |
| Verdicts all returning PARTIAL | No | Check `verified_evidence_providers` in request payload |
| Kelly stakes suddenly 2× expected | Investigate | LeaguePolicy kelly_cap may have changed; check `league_policy.py` |
| Frontend shows all providers ✗ | No | Backend startup issue; check `/health/ready` |
| `test_no_synthetic_scrapers` fails in CI | Code rollback | Revert any scraper changes that re-introduced `_simulate_` |
| Alembic drift detected | Schema rollback | Run `alembic downgrade -1` then fix migration |

---

## Health check endpoints (production monitoring)

```
GET /health/live    → 200 if process is running
GET /health/ready   → 200 if DB + critical deps are up
GET /health         → full health JSON
GET /api/v1/providers/health  → per-provider status
```

A successful rollback should restore `/health/ready` to 200 and `/api/v1/providers/health` to show at least one provider as `VERIFIED` or `CONFIGURED_UNVERIFIED`.

---

## Post-rollback checklist

- [ ] `/health/ready` returns 200
- [ ] At least one provider returns non-`UNAVAILABLE` status
- [ ] A test verdict request returns a valid `MatchAnalysisResult` (not 500)
- [ ] Frontend loads `/intelligence` without CSP or hydration errors
- [ ] No new Gitleaks findings in the rolled-back commit
- [ ] Alembic reports no drift: `alembic check`
