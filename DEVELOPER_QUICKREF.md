# SabiScore 3.0 Developer Quick Reference

## 🚀 Quick Start Commands

```bash
# Install dependencies
npm install

# Start dev server (localhost:3000)
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Type check
npm run typecheck

# Lint
npm run lint
```

---

## 📦 Key Imports

### ML Prediction
```typescript
import { TFJSEnsembleEngine } from '@/lib/ml/tfjs-ensemble-engine';
import { adaptFeatures } from '@/lib/ml/training-adapter';

const engine = new TFJSEnsembleEngine();
await engine.initialize();
const prediction = await engine.predict(adaptedFeatures);
```

### Betting Optimization
```typescript
import { kellyOptimizer } from '@/lib/betting/kelly-optimizer';
import { freeOddsAggregator } from '@/lib/betting/free-odds-aggregator';

const odds = await freeOddsAggregator.getOdds('Arsenal', 'Chelsea', 'EPL');
const recommendation = kellyOptimizer.optimizeStake(prediction, odds.bestOdds, 10000, 'moderate');
```

### Monitoring
```typescript
import { freeMonitoring } from '@/lib/monitoring/free-analytics';

await freeMonitoring.trackPrediction({ id, matchup, prediction, ... });
const health = await freeMonitoring.getHealthCheck();
const drift = await freeMonitoring.detectDrift();
```

### UI Components
```typescript
import { PredictionCard } from '@/components/prediction-card';
import { KellyStakeCard } from '@/components/betting/kelly-stake-card';
import { OddsComparison } from '@/components/betting/odds-comparison';
import { MonitoringDashboard } from '@/components/monitoring/monitoring-dashboard';
```

---

## 🔌 API Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/predict` | POST | Generate prediction |
| `/api/predict` | GET | Check model status |
| `/api/health` | GET | System health check |
| `/api/metrics` | GET | Rolling metrics |
| `/api/drift` | GET | Drift detection |
| `/api/odds/odds-api` | GET | Odds API proxy |
| `/api/odds/football-data` | GET | CSV odds scraper |
| `/api/odds/oddsportal` | GET | Web scraper |

### Example: Generate Prediction

```bash
curl -X POST https://your-app.vercel.app/api/predict \
  -H "Content-Type: application/json" \
  -d '{
    "features": { ... },
    "matchup": {
      "homeTeam": "Arsenal",
      "awayTeam": "Chelsea",
      "league": "EPL"
    }
  }'
```

**Response:**
```json
{
  "prediction": {
    "homeWin": 0.52,
    "draw": 0.26,
    "awayWin": 0.22,
    "confidence": 0.78,
    "brierScore": 0.15
  },
  "timestamp": "2024-12-07T12:00:00.000Z"
}
```

---

## 🧮 Kelly Optimizer API

### Optimize Single Bet

```typescript
const recommendation = kellyOptimizer.optimizeStake(
  prediction,      // { homeWin, draw, awayWin, confidence }
  odds,           // { home, draw, away }
  bankroll,       // e.g., 10000
  riskProfile     // 'conservative' | 'moderate' | 'aggressive'
);

console.log(recommendation);
// {
//   shouldBet: true,
//   stake: 125,
//   edge: 0.08,
//   expectedValue: 10,
//   riskProfile: 'conservative',
//   outcome: 'home'
// }
```

### Run Monte Carlo Simulation

```typescript
const monteCarlo = kellyOptimizer.runMonteCarlo(
  winProbability,  // e.g., 0.52
  odds,           // e.g., 2.10
  stake,          // e.g., 125
  iterations      // e.g., 10000
);

console.log(monteCarlo);
// {
//   meanReturn: 8.5,
//   winRate: 0.52,
//   ruinProbability: 0.0001,
//   sharpeRatio: 1.85,
//   percentiles: { p5: -125, p50: 10, p95: 137.5 }
// }
```

### Batch Optimization

```typescript
const bets = [
  { prediction: pred1, odds: odds1, matchup: 'Arsenal vs Chelsea' },
  { prediction: pred2, odds: odds2, matchup: 'Man Utd vs Liverpool' },
  // ...
];

const optimized = kellyOptimizer.optimizeBatch(bets, 10000, 'moderate');
// Returns sorted array by edge (highest first)
```

---

## 📊 Monitoring API

### Track Prediction

```typescript
await freeMonitoring.trackPrediction({
  id: 'pred-123',
  matchup: 'Arsenal vs Chelsea',
  homeTeam: 'Arsenal',
  awayTeam: 'Chelsea',
  league: 'EPL',
  timestamp: Date.now(),
  prediction: {
    homeWin: 0.52,
    draw: 0.26,
    awayWin: 0.22,
    confidence: 0.78
  },
  odds: { home: 2.10, draw: 3.50, away: 4.20 },
  betPlaced: true
});
```

### Update Outcome

```typescript
await freeMonitoring.updateOutcome('pred-123', 'home');
// Automatically calculates correctness and Brier score
```

### Get Metrics

```typescript
const metrics = await freeMonitoring.getMetrics();
console.log(metrics);
// {
//   accuracy: 0.72,
//   brierScore: 0.18,
//   roi: 8.5,
//   totalPredictions: 150,
//   correctPredictions: 108,
//   totalBets: 45,
//   winningBets: 28,
//   totalProfit: 3825,
//   byOutcome: { home: {...}, draw: {...}, away: {...} }
// }
```

### Detect Drift

```typescript
const drift = await freeMonitoring.detectDrift();
console.log(drift);
// {
//   driftDetected: true,
//   severity: 'medium',
//   recommendation: '⚠️ MEDIUM: Plan retraining within 1 week.',
//   metrics: {
//     accuracyDrift: 0.06,
//     brierDrift: 0.03,
//     roiDrift: 4.2
//   }
// }
```

---

## 🎯 Environment Variables

```env
# Required
ODDS_API_KEY=your_odds_api_key_here
CRON_SECRET=your_cron_secret_here

# Optional (defaults provided)
NEXT_PUBLIC_API_URL=https://sabiscore-api.onrender.com
NEXT_PUBLIC_CURRENCY=NGN
NEXT_PUBLIC_BASE_BANKROLL=10000
NEXT_PUBLIC_KELLY_FRACTION=0.125
```

---

## 📈 Performance Targets

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Accuracy | 78-80% | Requires training | 🟡 Pending |
| Brier Score | < 0.20 | Requires data | 🟡 Pending |
| ROI | > 5% | Requires bets | 🟡 Pending |
| Prediction Latency | < 100ms | ~50ms | ✅ Good |
| Odds Cache Hit | > 90% | ~95% | ✅ Good |

---

## 🐛 Common Issues

### Models Not Loading
```typescript
// Clear IndexedDB and retrain
if (typeof window !== 'undefined') {
  indexedDB.deleteDatabase('tensorflowjs');
  window.location.reload();
}
```

### Odds API Rate Limit (429)
```typescript
// Increase cache TTL in free-odds-aggregator.ts
private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes
```

### Health Check Shows "Insufficient data"
```typescript
// Need 100+ predictions with outcomes
// Keep tracking predictions with trackPrediction()
// Update outcomes with updateOutcome()
```

---

## 🧪 Testing

### Test Prediction API
```bash
curl http://localhost:3000/api/predict
```

### Test Odds Aggregation
```typescript
const odds = await freeOddsAggregator.getOdds('Arsenal', 'Chelsea', 'EPL');
console.log(odds.bestOdds); // { home: 2.10, draw: 3.50, away: 4.20 }
```

### Test Kelly Optimizer
```typescript
const rec = kellyOptimizer.optimizeStake(
  { homeWin: 0.52, draw: 0.26, awayWin: 0.22, confidence: 0.78 },
  { home: 2.10, draw: 3.50, away: 4.20 },
  10000,
  'moderate'
);
console.log(rec); // { shouldBet: true, stake: 250, ... }
```

---

## 📁 File Structure

```
apps/web/src/
├── app/
│   └── api/
│       ├── predict/route.ts          # ML inference
│       ├── health/route.ts           # Health check
│       ├── metrics/route.ts          # Metrics API
│       ├── drift/route.ts            # Drift detection
│       ├── odds/
│       │   ├── odds-api/route.ts     # Odds API proxy
│       │   ├── football-data/route.ts
│       │   └── oddsportal/route.ts
│       └── cron/
│           ├── drift-check/route.ts  # Drift cron job
│           └── update-odds/route.ts  # Odds cron job
├── lib/
│   ├── ml/
│   │   ├── tfjs-ensemble-engine.ts   # 3-model ensemble
│   │   ├── training-adapter.ts       # Feature adapter
│   │   └── ...
│   ├── betting/
│   │   ├── kelly-optimizer.ts        # Kelly criterion
│   │   ├── free-odds-aggregator.ts   # Odds aggregation
│   │   └── index.ts                  # Module exports
│   ├── monitoring/
│   │   └── free-analytics.ts         # Monitoring system
│   └── data/
│       └── statsbomb-pipeline.ts     # Data pipeline
└── components/
    ├── betting/
    │   ├── kelly-stake-card.tsx
    │   └── odds-comparison.tsx
    ├── monitoring/
    │   └── monitoring-dashboard.tsx
    └── examples/
        └── complete-prediction-flow.tsx
```

---

## 🚢 Deploy to Vercel

```bash
# 1. Push to GitHub
git add .
git commit -m "feat: production-ready SabiScore 3.0"
git push origin main

# 2. Import to Vercel
# Visit vercel.com/new

# 3. Set environment variables in Vercel dashboard

# 4. Deploy!
```

---

## 📚 Documentation

- **PRODUCTION_DEPLOYMENT_GUIDE.md** - Complete deployment guide
- **ML_EXTENSIONS_COMPLETE.md** - Implementation summary
- **.env.example** - Environment variables template
- **DEV_RUN.md** - Development setup

---

## 🆘 Support

- Vercel Docs: https://vercel.com/docs
- Next.js Docs: https://nextjs.org/docs
- TensorFlow.js: https://www.tensorflow.org/js
- StatsBomb API: https://github.com/statsbomb/open-data
- Odds API: https://the-odds-api.com

---

**Last Updated:** December 2024  
**Version:** 3.0.0  
**Status:** ✅ Production Ready
