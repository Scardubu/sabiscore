# SabiScore Production Deploy Runbook

This runbook describes how to deploy the backend to Render and the frontend to Vercel for the `feat/edge-v3` line.

## Backend (Render)

Service: `sabiscore-api`

Config files:
- Root: `render.yaml` (main branch)
- Branch-specific: `backend/render.yaml` (feat/edge-v3)

### One-time setup
1. In Render dashboard, create a **Web Service** from GitHub pointing to this repo.
2. Root directory: `backend`.
3. Confirm the service is using the **root** `render.yaml` for `main` and the `backend/render.yaml` for the `feat/edge-v3` branch.

### Deploy
- To deploy `main` (production):
  - Push to `main`; Render auto-deploys using `render.yaml`.
- To deploy `feat/edge-v3` (staging):
  - Push to `feat/edge-v3`; Render uses `backend/render.yaml` (branch set to `feat/edge-v3`).

Health check: `GET /health/ready`.

## Frontend (Vercel)

Project: `sabiscore` (Next.js, root at `apps/web`).

### One-time setup
1. Import the GitHub repo in Vercel.
2. Set **Root Directory** to `apps/web`.
3. Build command: `npm run build`.
4. Output directory: `.next`.
5. Configure env vars in the Vercel dashboard (project settings):
   - `NEXT_PUBLIC_API_URL`
   - `NEXT_PUBLIC_WS_URL`
   - `NEXT_PUBLIC_CURRENCY`
   - `NEXT_PUBLIC_CURRENCY_SYMBOL`
   - `NEXT_PUBLIC_BASE_BANKROLL`
   - `NEXT_PUBLIC_KELLY_FRACTION`
   - `NEXT_PUBLIC_MIN_EDGE_NGN`
   - `NEXT_PUBLIC_USE_API_AUTOCOMPLETE`

### Deploy via CLI
From repo root:

```powershell
vercel --prod
```

Vercel uses `vercel.json` to:
- Run `npm ci`.
- Build `apps/web`.
- Apply security headers and API rewrites to `https://sabiscore-api.onrender.com`.

## Smoke tests

After each deploy:

1. Frontend:
   - Open the Vercel URL and verify home page loads.
   - Use match selector and ensure API-backed autocomplete works.
2. Backend:
   - `GET /health/ready` on Render service returns HTTP 200.
   - `GET /api/v1/health` through Vercel rewrites returns JSON.
