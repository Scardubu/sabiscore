# SabiScore 3.0 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SABISCORE 3.0 ARCHITECTURE                          │
│                    Zero-Cost Neural Prediction Engine                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ CLIENT LAYER (Browser)                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  Next.js 15 App  │  │  React 18.3.1    │  │  TypeScript 5.6  │          │
│  │  (App Router)    │  │  (RSC + Client)  │  │  (Full Type Safety)│         │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        UI COMPONENTS                                    │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                          │ │
│  │  • PredictionCard (Framer Motion animations)                            │ │
│  │  • ConfidenceMeter (Chart.js doughnut with Brier score)                │ │
│  │  • KellyStakeCard (Betting recommendations + Monte Carlo)              │ │
│  │  • OddsComparison (Multi-source odds with best price)                  │ │
│  │  • MonitoringDashboard (Health, metrics, drift visualization)          │ │
│  │                                                                          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     ML INFERENCE ENGINE                                 │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                          │ │
│  │  TensorFlow.js 4.21.0 (Browser-Native)                                 │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ │
│  │                                                                          │ │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                  │ │
│  │  │  Dense NN   │   │    LSTM     │   │     CNN     │                  │ │
│  │  │  (45% wt)   │   │  (30% wt)   │   │  (25% wt)   │                  │ │
│  │  │  4 layers   │   │  2 layers   │   │  3 layers   │                  │ │
│  │  │  48 inputs  │   │  10×4 seq   │   │  12×8×2 map │                  │ │
│  │  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘                  │ │
│  │         │                  │                  │                          │ │
│  │         └──────────────────┴──────────────────┘                          │ │
│  │                            │                                             │ │
│  │                   ┌────────▼────────┐                                   │ │
│  │                   │ Weighted Average │                                   │ │
│  │                   └────────┬────────┘                                   │ │
│  │                            │                                             │ │
│  │                   ┌────────▼────────┐                                   │ │
│  │                   │ Isotonic        │                                   │ │
│  │                   │ Calibration     │                                   │ │
│  │                   └────────┬────────┘                                   │ │
│  │                            │                                             │ │
│  │                   Calibrated Probabilities                              │ │
│  │                   (Home/Draw/Away + Confidence)                         │ │
│  │                                                                          │ │
│  │  Storage: IndexedDB (sabiscore-*-model)                                │ │
│  │  Calibrator: localStorage (calibrator-state)                           │ │
│  │                                                                          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    BETTING OPTIMIZATION                                 │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                          │ │
│  │  Kelly Optimizer (kelly-optimizer.ts)                                  │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ │
│  │                                                                          │ │
│  │  • optimizeStake(prediction, odds, bankroll, risk)                     │ │
│  │  • runMonteCarlo(winProb, odds, stake, 10000)                          │ │
│  │  • calculateCLV(placedOdds, closingOdds)                               │ │
│  │  • optimizeBatch(bets[], bankroll, risk)                               │ │
│  │                                                                          │ │
│  │  Safety Caps:                                                           │ │
│  │  - MIN_EDGE: 2%                                                         │ │
│  │  - MIN_CONFIDENCE: 60%                                                  │ │
│  │  - MAX_STAKE: 5% of bankroll                                            │ │
│  │                                                                          │ │
│  │  Risk Profiles:                                                         │ │
│  │  - Conservative: 1/8 Kelly                                              │ │
│  │  - Moderate: 1/4 Kelly                                                  │ │
│  │  - Aggressive: 1/2 Kelly                                                │ │
│  │                                                                          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     MONITORING SYSTEM                                   │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                          │ │
│  │  Free Analytics (free-analytics.ts)                                    │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ │
│  │                                                                          │ │
│  │  • trackPrediction(record)                                              │ │
│  │  • updateOutcome(id, actual)                                            │ │
│  │  • getMetrics() → accuracy, Brier, ROI                                  │ │
│  │  • detectDrift() → severity + recommendation                            │ │
│  │                                                                          │ │
│  │  Storage: localStorage (last 1000 predictions)                         │ │
│  │  Baseline: Set after 100+ predictions with outcomes                    │ │
│  │                                                                          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘

                                       │
                                       │ HTTPS
                                       │
                                       ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│ EDGE LAYER (Vercel Edge Functions)                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        API ROUTES                                       │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                          │ │
│  │  POST /api/predict              → Generate prediction                  │ │
│  │  GET  /api/predict              → Model status                         │ │
│  │  GET  /api/health               → System health check                  │ │
│  │  GET  /api/metrics              → Rolling metrics                      │ │
│  │  GET  /api/drift                → Drift detection                      │ │
│  │  GET  /api/odds/odds-api        → Odds API proxy                       │ │
│  │  GET  /api/odds/football-data   → CSV odds scraper                     │ │
│  │  GET  /api/odds/oddsportal      → Web scraper                          │ │
│  │                                                                          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        CRON JOBS                                        │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                          │ │
│  │  GET /api/cron/drift-check      → Every 6 hours (0 */6 * * *)         │ │
│  │  GET /api/cron/update-odds      → Every 30 minutes (*/30 * * * *)     │ │
│  │                                                                          │ │
│  │  Security: Authorization: Bearer ${CRON_SECRET}                        │ │
│  │                                                                          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘

                                       │
                                       │ HTTP(S)
                                       │
                                       ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│ DATA SOURCES (100% Free)                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  StatsBomb API   │  │   Odds API       │  │  Football-Data   │          │
│  │  (GitHub-hosted) │  │   (500 req/mo)   │  │  (CSV exports)   │          │
│  │                  │  │                  │  │                  │          │
│  │  • 10k+ matches  │  │  • H2H odds      │  │  • Historical    │          │
│  │  • Event data    │  │  • 3-way markets │  │  • Bet365 odds   │          │
│  │  • Line-ups      │  │  • UK/EU books   │  │  • Free          │          │
│  │  • Unlimited     │  │  • Reliable      │  │  • Unlimited     │          │
│  │                  │  │                  │  │                  │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                                 │
│  │    FBref         │  │   Oddsportal     │                                 │
│  │  (Scraping)      │  │   (Scraping)     │                                 │
│  │                  │  │                  │                                 │
│  │  • Advanced      │  │  • Live odds     │                                 │
│  │  • Stats         │  │  • Movement      │                                 │
│  │  • Free          │  │  • Free          │                                 │
│  │  • Public        │  │  • Public        │                                 │
│  │                  │  │                  │                                 │
│  └──────────────────┘  └──────────────────┘                                 │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ DATA FLOW                                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  1. Training Phase (Offline)                                                │
│     StatsBomb → Feature Extraction → Training Adapter → TensorFlow.js       │
│     → Train Ensemble → Calibrate → Save to IndexedDB                        │
│                                                                               │
│  2. Prediction Phase (Real-time)                                            │
│     User Input → Load Models → Extract Features → Predict → Calibrate       │
│     → Display Results                                                        │
│                                                                               │
│  3. Betting Phase (Real-time)                                               │
│     Prediction → Fetch Odds → Aggregate → Kelly Optimize → Monte Carlo      │
│     → Display Recommendation                                                 │
│                                                                               │
│  4. Monitoring Phase (Continuous)                                           │
│     Track Predictions → Update Outcomes → Calculate Metrics → Detect Drift  │
│     → Alert if needed                                                        │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ STORAGE BREAKDOWN                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ IndexedDB (Browser)                                           ~15-20 MB│ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │ • sabiscore-dense-model             ~5 MB                              │ │
│  │ • sabiscore-lstm-model              ~8 MB                              │ │
│  │ • sabiscore-cnn-model               ~5 MB                              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ localStorage (Browser)                                         ~500 KB │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │ • calibrator-state                  ~50 KB                             │ │
│  │ • sabiscore-monitoring              ~450 KB (1000 predictions)         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Memory Cache (Runtime)                                          ~5 MB  │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │ • Odds cache (5-min TTL)            ~100 KB                            │ │
│  │ • Model instances                   ~4 MB                              │ │
│  │ • Prediction buffer                 ~1 MB                              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  TOTAL CLIENT-SIDE STORAGE: ~25 MB                                           │
│  TOTAL VERCEL BANDWIDTH: ~5-10 GB/month (well under 100 GB free limit)      │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ COST BREAKDOWN (Monthly)                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  Vercel Hosting (Free Tier)                                            $0   │
│  StatsBomb API (Unlimited)                                             $0   │
│  Odds API (500 requests)                                               $0   │
│  Football-Data (Unlimited CSV)                                         $0   │
│  FBref Scraping (Public)                                               $0   │
│  TensorFlow.js (Client-side)                                           $0   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  TOTAL MONTHLY COST:                                                   $0   │
│                                                                               │
│  Projected User Capacity (Free Tier):                                       │
│  • Concurrent Users: ~500-1000                                               │
│  • Monthly Predictions: ~10,000                                              │
│  • Bandwidth: 100 GB (models cached client-side)                            │
│  • Edge Invocations: 100,000                                                 │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PERFORMANCE METRICS                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  Cold Start (First Load):                    2-3 seconds                    │
│  Warm Prediction:                            < 100 ms                       │
│  Odds Fetch:                                 < 500 ms (cached: 5 min)       │
│  Kelly Optimization:                         < 10 ms                        │
│  Monte Carlo (10k iterations):               < 50 ms                        │
│  Drift Detection:                            < 20 ms                        │
│                                                                               │
│  Model Accuracy Target:                      78-80%                         │
│  Brier Score Target:                         < 0.20                         │
│  ROI Target:                                 > 5%                           │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ SECURITY FEATURES                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ✅ HTTPS Only (Vercel enforced)                                            │
│  ✅ CSP Headers (Content Security Policy)                                   │
│  ✅ XSS Protection                                                           │
│  ✅ CORS Configuration                                                       │
│  ✅ Cron Secret Authentication                                               │
│  ✅ Environment Variable Encryption                                          │
│  ✅ No Database Exposure (client-side storage)                              │
│  ✅ Rate Limiting (Odds cache)                                               │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Architecture Decisions

### 1. Browser-Native ML
- **Why:** Zero backend cost, instant predictions, offline-capable
- **Trade-off:** Larger initial download (~20 MB), client-side computation
- **Mitigation:** IndexedDB caching, Progressive loading, WebAssembly optimization

### 2. Edge-First API Design
- **Why:** Low latency worldwide, auto-scaling, no cold starts
- **Trade-off:** Limited execution time (10s), stateless functions
- **Mitigation:** Client-side caching, Efficient algorithms, Async processing

### 3. Client-Side Monitoring
- **Why:** Zero database cost, instant metrics, privacy-focused
- **Trade-off:** No centralized analytics, storage limits (1000 predictions)
- **Mitigation:** localStorage persistence, Export functionality, Metrics rollups

### 4. Multi-Source Odds Aggregation
- **Why:** Best price selection, redundancy, CLV tracking
- **Trade-off:** Multiple API calls, potential rate limits
- **Mitigation:** 5-min cache TTL, Reliability weighting, Graceful degradation

### 5. Fractional Kelly Sizing
- **Why:** Bankroll protection, realistic risk management, proven strategy
- **Trade-off:** Lower potential returns vs full Kelly
- **Mitigation:** Risk profiles (3 levels), Safety caps (5% max), Monte Carlo validation

---

## Scaling Strategy (Future)

### To 10,000+ Users (Free Tier)
1. Enable Vercel Edge Config (KV storage)
2. Implement server-side model caching
3. Add CDN for static assets
4. Optimize bundle size (<500 KB)

### To 100,000+ Users (Paid Tier: ~$20/mo)
1. Upgrade Odds API ($9/mo for 10k req)
2. Add Vercel Pro ($20/mo)
3. Implement Redis caching
4. Add load balancing

### To 1M+ Users (Enterprise: ~$200/mo)
1. Dedicated compute instances
2. Multi-region deployment
3. Custom ML serving infrastructure
4. Real-time data streaming

---

**Current Status:** ✅ Production-ready for 1,000+ users on 100% free tier  
**Deployment Time:** < 15 minutes  
**Total Cost:** $0/month
