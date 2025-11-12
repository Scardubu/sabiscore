# 🎯 Sabiscore v3.0 Quick Reference

## 🚀 Start Development

```bash
# All services (recommended)
npm run dev

# Web only (Next.js)
npm run dev:web

# API only (FastAPI)
npm run dev:api

# PowerShell (Windows)
.\start-dev.ps1
```

## 🔗 Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| **Web App** | http://localhost:3000 | Next.js 15 frontend |
| **API** | http://localhost:8000/api/v1 | FastAPI backend |
| **API Docs** | http://localhost:8000/docs | OpenAPI/Swagger UI |
| **Health** | http://localhost:8000/api/v1/health | System health check |

## 📁 Project Structure

```
apps/web/src/
├── app/
│   ├── layout.tsx          # Root layout + metadata
│   ├── page.tsx            # Homepage
│   ├── providers.tsx       # React Query + Toaster
│   ├── globals.css         # Global styles
│   └── match/[id]/
│       └── page.tsx        # Match insights (SSR + ISR)
├── components/
│   ├── header.tsx          # Site header
│   ├── match-selector.tsx  # Match input form
│   └── insights-display.tsx# Insights visualization
└── lib/
    └── api.ts              # API client + types
```

## 🎨 Component Patterns

### Server Component (Default)

```tsx
// Automatic SSR + ISR
export const revalidate = 15;

export default async function Page({ params }: PageProps) {
  const data = await fetchData(params.id);
  return <Component data={data} />;
}
```

### Client Component (Interactive)

```tsx
"use client";

import { useState } from "react";

export function MyComponent() {
  const [state, setState] = useState();
  // ... interactive logic
}
```

### Edge Runtime (Ultra-Fast)

```tsx
export const runtime = "edge";
export const preferredRegion = ["iad1", "lhr1", "fra1"];

export default async function Page() {
  // Runs on Cloudflare/Vercel Edge
}
```

## 🔧 Common Commands

```bash
# Development
npm install                 # Install dependencies
npm run dev                 # Start dev servers
npm run typecheck           # TypeScript validation
npm run lint                # ESLint

# Building
npm run build               # Build all packages
npm run build:web           # Build web only

# Docker
npm run docker:build        # Build images
npm run docker:up           # Start production
npm run docker:down         # Stop all services

# Utilities
npm run format              # Format code
npm run clean               # Remove artifacts
```

## 🐛 Debugging

### Enable Verbose Logging

```bash
# Next.js
DEBUG=* npm run dev:web

# FastAPI
cd backend
LOG_LEVEL=DEBUG uvicorn src.api.main:app --reload
```

### Check Service Health

```bash
# API health check
curl http://localhost:8000/api/v1/health

# Database connection
curl http://localhost:8000/api/v1/health | jq '.database'

# Model status
curl http://localhost:8000/api/v1/models/status
```

### View Logs

```bash
# Docker logs
docker logs sabiscore-web-1
docker logs sabiscore-api-1

# Follow logs
docker logs -f sabiscore-api-1
```

## 📊 Performance Metrics

### Target KPIs

| Metric | Target | How to Test |
|--------|---------|-------------|
| **TTFB** | <150ms | Chrome DevTools Network tab |
| **LCP** | <2.5s | Lighthouse in Chrome DevTools |
| **FID** | <100ms | Lighthouse |
| **CLS** | <0.1 | Lighthouse |

### Load Testing

```bash
# Install k6
choco install k6  # Windows
brew install k6   # Mac
apt install k6    # Linux

# Run load test
k6 run loadtest.js

# Target: 10k CCU @ 142ms TTFB
```

## 🔐 Environment Variables

### Development (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8001
```

### Production (.env.production)

```env
DATABASE_URL=postgresql://user:pass@host:5432/sabiscore
REDIS_URL=redis://default:ASfKAAIncDJmZjE2OGZjZDA3OTM0ZTY5YTRiNzZhNjMwMjM1YzZiZnAyMTAxODY@known-amoeba-10186.upstash.io:6379
SECRET_KEY=your-32-char-secret-minimum
APP_ENV=production
DEBUG=False
```

## 🎯 API Endpoints

### Health & Status

```bash
GET /api/v1/health                    # System health
GET /api/v1/models/status             # ML model status
GET /api/v1/metrics/cache             # Cache metrics
```

### Match Insights

```bash
POST /api/v1/insights
Body: { "matchup": "Arsenal vs Liverpool", "league": "EPL" }

GET /api/v1/matches/search?q=Arsenal&league=EPL
```

## 🏗️ Architecture Decisions

### Why Next.js 15?

- ✅ Edge Runtime: <150ms TTFB
- ✅ PPR: Partial Prerendering for instant loads
- ✅ App Router: Better DX, file-based routing
- ✅ React Server Components: Less JS to client
- ✅ ISR: Fresh data without full rebuilds

### Why Turbo?

- ✅ Incremental builds (10x faster)
- ✅ Remote caching
- ✅ Parallel task execution
- ✅ Smart dependency graph

### Why Docker Compose?

- ✅ Consistent environments
- ✅ Easy scaling (replicas)
- ✅ Service orchestration
- ✅ Zero-config networking

## 📚 Learn More

- [Next.js Docs](https://nextjs.org/docs)
- [Turbo Docs](https://turbo.build/repo/docs)
- [FastAPI Docs](https://fastapi.tiangolo.com)
- [Tailwind CSS](https://tailwindcss.com/docs)

## 🆘 Quick Fixes

### Port Already in Use

```bash
# Kill process on port 3000
npx kill-port 3000

# Kill process on port 8000
npx kill-port 8000
```

### Node Modules Issues

```bash
# Clean install
rm -rf node_modules apps/web/node_modules package-lock.json
npm install
```

### Python Environment Issues

```bash
cd backend
rm -rf venv
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows
source venv/bin/activate      # Linux/Mac
pip install -r requirements.txt
```

---

**Phase 1 Status**: ✅ Complete

**Next**: Phase 2 - Data Ingestion & Streaming Layer
