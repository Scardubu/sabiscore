# SabiScore Deployment Guide

This guide outlines the steps required to deploy the SabiScore platform (backend FastAPI service, frontend Vite SPA, and supporting infrastructure) to a production environment.

---

## 1. Prerequisites

- **Infrastructure**
  - Container runtime: Docker 24+ or Kubernetes 1.27+
  - Managed PostgreSQL database (e.g., AWS RDS, GCP Cloud SQL) with SSL enabled
  - Redis instance for caching and rate limiting (e.g., AWS Elasticache)
  - Object storage for model artifacts (optional, e.g., S3 bucket)
- **Secrets Management**
  - Store sensitive values in a secrets manager or environment variables (database URL, Redis URL, SECRET_KEY, API keys)
- **CI/CD Pipeline**
  - GitHub Actions or equivalent with access to container registry (GHCR, ECR, GCR)

---

## 2. Configuration

1. Copy `.env.example` to `.env` and set production values:

   ```env
   APP_ENV=production
   DEBUG=false
   SECRET_KEY=<unique-32-char-secret>
   DATABASE_URL=postgresql+psycopg2://user:pass@host:5432/sabiscore
   REDIS_URL=redis://default:ASfKAAIncDJmZjE2OGZjZDA3OTM0ZTY5YTRiNzZhNjMwMjM1YzZiZnAyMTAxODY@known-amoeba-10186.upstash.io:6379
   CORS_ORIGINS=https://app.sabiscore.com
   RATE_LIMIT_REQUESTS=120
   RATE_LIMIT_WINDOW_SECONDS=60
   MODELS_PATH=/app/models
   ```
2. Confirm directories exist (models, data) or mount them via volumes.

---

## 3. Backend Deployment

1. **Build API image**

   ```bash
   docker build -t ghcr.io/<org>/sabiscore-backend:latest ./backend
   docker push ghcr.io/<org>/sabiscore-backend:latest
   ```
2. **Run database migrations (if any)**

   ```bash
   docker run --rm --env-file .env ghcr.io/<org>/sabiscore-backend:latest python scripts/init_db.py
   ```
3. **Launch backend service** (Docker example)

   ```bash
   docker run -d \
     --name sabiscore-api \
     --env-file .env \
     -p 8000:8000 \
     ghcr.io/<org>/sabiscore-backend:latest uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --workers 4
   ```
4. **Kubernetes deployment**
   - Create a `Deployment` with `readinessProbe` hitting `/api/v1/health`
   - Configure `HorizontalPodAutoscaler` targeting CPU < 70%
   - Expose via `Service` + `Ingress` (TLS via cert-manager or ALB)

---

## 4. Frontend Deployment

1. **Configure environment**
   - Set `VITE_API_BASE_URL=https://api.sabiscore.com/api`
2. **Build static assets**

   ```bash
   cd frontend
   npm ci
   npm run build
   ```
3. **Upload artifacts**
   - Deploy `dist/` to CDN or web host (Netlify, Vercel, S3+CloudFront)
4. **Verify**
   - Access frontend URL and ensure API requests hit production backend

---

## 5. Model Artifacts

- Upload trained ensemble `.pkl` and metadata JSON files to the `/models` volume/path
- Ensure file permissions allow read access to the API container user

---

## 6. Monitoring & Observability

- **Health Endpoint**: `/api/v1/health` returns database, cache, and model status plus latency
- **Cache Metrics**: `/api/v1/metrics/cache` for hit/miss/circuit stats
- **Logging**: Configure JSON logs to forward to ELK/CloudWatch/Stackdriver
- **Alerts**: Set up alerts for:
  - Health endpoint degraded status
  - Cache circuit open > 1 minute
  - High 5xx rate

---

## 7. Post-Deployment Validation

1. Hit `/api/v1/health` to confirm status = `healthy`
2. Run smoke test: POST `/api/v1/insights` with a known matchup
3. Load frontend and confirm:
   - Landing page renders
   - Match analysis completes
   - Offline banner hidden
4. Capture screenshots (see `docs/RELEASE_NOTES.md`)

---

## 8. Rollback Strategy

- Maintain previous container tags for quick redeploy
- Database migrations should be reversible or use backups
- Store model artifacts with version suffixes (`*_vNN.pkl`)

---

## 9. Automation Tips

- Integrate backend `pytest` run in CI before publishing images
- Use infrastructure-as-code (Terraform/Helm) for reproducible environments
- Schedule cron job for cache warmup or daily health report if desired

---

## 10. Contact & Ownership

- Engineering: platform@sabiscore.com
- On-call: #sabiscore-ops Slack channel
- Status page: [https://status.sabiscore.com](https://status.sabiscore.com)

---

## 11. Windows Startup Automation

Use the PowerShell helper at `scripts/start-platform.ps1` to launch the full stack (PostgreSQL, Redis, backend API, frontend SPA) with Docker Compose. Examples:

```powershell
# from repo root
pwsh -File .\scripts\start-platform.ps1 -Detached -Rebuild -FollowLogs
```

> **Note:** Run the command with PowerShell 7+ and `pwsh`. Executing the script via `python` will raise a syntax error because it is not a Python entry point.

### Flags

| Flag | Description |
|------|-------------|
| `-Detached` | Run `docker compose up` in detached mode (recommended for local dev). |
| `-Rebuild` | Force rebuild of backend/frontend images before startup. |
| `-SeedData` | Execute `scripts/init_db.py` and `scripts/populate_db.py` inside the backend container. |
| `-FollowLogs` | Stream compose logs (only when not detached). |
| `-StartupTimeoutSeconds` | Seconds to wait for `/api/v1/health` to return 200 (default 180). |

The script validates Docker availability, creates the `models/` directory if missing, and polls `http://localhost:8000/api/v1/health`. Stop the stack using `docker compose down` from the repository root.
