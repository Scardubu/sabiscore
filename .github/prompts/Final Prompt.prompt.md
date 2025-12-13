---
agent: You are an expert full-stack engineer tasked with transforming the Sabiscore football prediction platform (https://sabiscore.vercel.app/) into a production-grade, portfolio-worthy application.
---
ANALYSIS PHASE:
1. Clone and analyze the codebase structure
2. Run: `npx next build --profile && npx @next/bundle-analyzer` - document bundle size
3. Run: `npx eslint . --ext .ts,.tsx` - list all code quality issues
4. Run: `npm audit` - identify security vulnerabilities
5. Create ANALYSIS_REPORT.md with findings: architecture overview, performance baseline, security gaps, optimization opportunities

REFACTORING PHASE:
1. Restructure folders to: src/{app,components,lib,types,services,config}
2. Enable TypeScript strict mode, remove all 'any' types
3. Create comprehensive types in src/types/index.ts (Match, Team, Prediction, ApiResponse)
4. Setup environment validation with Zod in src/config/env.ts
5. Add path aliases: @/components, @/lib, @/types

ML ENHANCEMENT PHASE:
1. Download Kaggle datasets: European Soccer Database, Football Events
2. Create feature engineering pipeline (80+ features): form, momentum, H2H, sentiment, weather
3. Train ensemble: XGBoost + LightGBM + CatBoost with 5-fold CV
4. Fine-tune DistilBERT on football news for sentiment analysis
5. Deploy ML service to Render as FastAPI microservice
6. Target: 78-84% prediction accuracy (current: 73.7%)

INTEGRATION PHASE:
1. Setup Redis caching (Upstash free tier) - multi-layer cache strategy
2. Integrate Football-Data.org API (10 req/min) for live data
3. Add WebSocket real-time updates with Socket.io
4. Implement Firebase push notifications
5. Create upcoming matchups dashboard with AI-generated previews (Llama 3.1 via Replicate)
6. Add prediction challenge + leaderboard with Supabase

OPTIMIZATION PHASE:
1. Code splitting: dynamic imports for heavy components
2. Image optimization: next/image with blur placeholders
3. Add service worker for offline support
4. Database: create indexes, materialized views for team stats
5. API routes: implement rate limiting, response caching
6. Target: <2s load time, 95+ Lighthouse score

TESTING & DEPLOYMENT:
1. Write unit tests: Jest + React Testing Library (80% coverage)
2. Integration tests: Playwright for E2E flows
3. Setup GitHub Actions CI/CD pipeline
4. Deploy frontend to Vercel with env vars
5. Deploy ML service to Render
6. Setup Supabase database with migrations

For each task:
- Show complete working code (no truncation)
- Add error handling with try-catch
- Include TypeScript types
- Add comments explaining complex logic
- Create a commit message

Start with Task 1: Clone repo and run analysis commands. Show me the complete ANALYSIS_REPORT.md