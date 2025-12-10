# SabiScore ML Module

Browser-native TensorFlow.js ensemble for football match prediction.

## Overview

This module implements a zero-cost ML pipeline using:
- **StatsBomb Open Data** - 10,000+ matches with event-level data
- **TensorFlow.js** - Browser-native ML with WebGL acceleration
- **3-Model Ensemble** - Dense NN + LSTM + CNN for robust predictions
- **Isotonic Calibration** - Probability calibration for accurate confidence scores

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Training Pipeline                         │
├─────────────────────────────────────────────────────────────┤
│  StatsBomb API  →  Feature Extraction  →  Training Adapter  │
│       ↓                    ↓                    ↓           │
│  Raw Events      ModelFeatures         EnsembleMatchFeatures │
│                                               ↓              │
│                                    TFJSEnsembleEngine        │
│                                    ├── Dense NN (45%)        │
│                                    ├── LSTM (30%)            │
│                                    └── CNN (25%)             │
│                                               ↓              │
│                                    IsotonicCalibrator        │
│                                               ↓              │
│                                    IndexedDB Storage         │
└─────────────────────────────────────────────────────────────┘
```

## Files

| File | Description |
|------|-------------|
| `tfjs-ensemble-engine.ts` | Core ensemble with Dense/LSTM/CNN models |
| `training-adapter.ts` | Converts StatsBomb features to ensemble format |
| `train-tfjs-free.ts` | Training orchestrator using free data |
| `index.ts` | Module exports |

## Usage

### Training (Dev Only)

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Navigate to `/dev/train-tfjs` in your browser

3. Configure training parameters:
   - **Min Matches**: Number of matches to train on (default: 300)
   - **Epochs**: Training iterations (default: 30)
   - **Batch Size**: Samples per batch (default: 32)

4. Click "Start Training" and wait for completion

### Making Predictions

```typescript
import { ensembleEngine, type EnsembleMatchFeatures } from '@/lib/ml';

// Initialize (loads from IndexedDB if available)
await ensembleEngine.initialize();

// Prepare match features
const features: EnsembleMatchFeatures = {
  homeForm: [0.8, 0.6, 1.0, 0.4, 0.6],
  awayForm: [0.6, 0.4, 0.8, 0.6, 0.4],
  homeXG: [1.8, 2.1, 1.5, 1.2, 2.4, 1.9, 1.6, 2.0, 1.7, 1.4],
  awayXG: [1.2, 1.5, 1.8, 1.1, 1.3, 1.6, 1.4, 1.2, 1.5, 1.3],
  homeXGA: [0.8, 1.2, 0.9, 1.1, 0.7],
  awayXGA: [1.4, 1.1, 1.3, 1.5, 1.2],
  homeAdvantage: 0.46,
  restDays: 0.5,
  injuries: 0.1,
  h2hHistory: [0.5, 0.2, 0.3],
  homeShotMap: /* 12x8 grid */,
  awayShotMap: /* 12x8 grid */,
  homePressureMap: /* 12x8 grid */,
  awayPressureMap: /* 12x8 grid */,
};

// Get prediction
const prediction = await ensembleEngine.predict(features);

console.log({
  homeWin: prediction.homeWin,      // 0.45
  draw: prediction.draw,            // 0.28
  awayWin: prediction.awayWin,      // 0.27
  confidence: prediction.confidence, // 0.72
  agreement: prediction.ensembleAgreement // 0.85
});
```

### Using with StatsBomb Data

```typescript
import { freeDataPipeline } from '@/lib/data';
import { adaptModelFeatures } from '@/lib/ml';

// Get live features for a match
const rawFeatures = await freeDataPipeline.getLiveFeatures(
  'Manchester City',
  'Liverpool'
);

// Adapt to ensemble format
const ensembleFeatures = adaptModelFeatures(rawFeatures);

// Predict
const prediction = await ensembleEngine.predict(ensembleFeatures);
```

## Model Details

### Dense Neural Network
- **Purpose**: General pattern recognition
- **Architecture**: 128 → 64 → 32 → 3 (softmax)
- **Features**: Flattened match statistics (50 inputs)
- **Weight**: 45% of ensemble

### LSTM Network
- **Purpose**: Temporal patterns (form, momentum)
- **Architecture**: LSTM(64) → LSTM(32) → Dense(16) → 3
- **Features**: 10-game sequences, 20 features each
- **Weight**: 30% of ensemble

### CNN Network
- **Purpose**: Spatial patterns (shot maps, pressure zones)
- **Architecture**: Conv2D(32) → Pool → Conv2D(64) → Dense(64) → 3
- **Features**: 12x8 spatial grids, 2 channels
- **Weight**: 25% of ensemble

## Storage

Models are persisted in browser storage:
- **IndexedDB**: Model weights (`sabiscore-dense-model`, `sabiscore-lstm-model`, `sabiscore-cnn-model`)
- **localStorage**: Calibrator state (`sabiscore-calibrator`)

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Ensemble Accuracy | 78-80% | TBD |
| Brier Score | < 0.20 | TBD |
| Inference Time | < 50ms | ~20ms |
| Model Size | < 5MB | ~2MB |

## Data Sources

### StatsBomb Open Data (Training)
- La Liga (2004-2020)
- FA Women's Super League
- FIFA World Cup
- Premier League (limited)
- NWSL
- Women's World Cup

### FBref (Live Features)
- Team statistics via API route
- Player xG and assists
- Recent form data

## Development

### Clear Models
```typescript
import { clearAllModels } from '@/lib/ml';
await clearAllModels();
```

### Check Model Status
```typescript
import { checkExistingModels } from '@/lib/ml';
const hasModels = await checkExistingModels();
```

### Memory Management
```typescript
const memInfo = ensembleEngine.getMemoryInfo();
console.log(`Tensors: ${memInfo.numTensors}, Bytes: ${memInfo.numBytes}`);
```

## Troubleshooting

### "No training samples collected"
- Check network connectivity
- StatsBomb API may be rate-limited
- Try reducing `minMatches` parameter

### Slow Training
- Reduce `epochs` (try 20 instead of 50)
- Reduce `minMatches` (try 200 instead of 500)
- Ensure WebGL is enabled in browser

### Models Not Loading
- Clear IndexedDB: `await clearAllModels()`
- Check browser storage quota
- Retrain models

## Future Improvements

- [ ] Add model versioning
- [ ] Implement incremental training
- [ ] Add more data sources (Understat, WhoScored)
- [ ] Implement shadow predictions (compare with backend)
- [ ] Add A/B testing framework
