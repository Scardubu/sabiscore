# SOTA Stacking Quick Reference

## TL;DR
```bash
# Enable SOTA stacking for +0.5-1% accuracy boost
pip install 'autogluon.tabular>=1.0.0'
python -m src.cli.train_models --leagues EPL --enable-sota-stack --sota-time-limit 300
```

## Quick Commands

### Training
```bash
# Basic (recommended for production)
python -m src.cli.train_models --leagues EPL --enable-sota-stack --sota-time-limit 300 --sota-presets best_quality

# Fast (development/testing)
python -m src.cli.train_models --leagues EPL --enable-sota-stack --sota-time-limit 60 --sota-presets medium_quality

# All leagues with GPU
python -m src.cli.train_models --enable-sota-stack --sota-time-limit 600 --prefer-gpu
```

### Environment Variables
```bash
export ENABLE_SOTA_STACK=1
export SOTA_TIME_LIMIT=300
export SOTA_PRESETS=best_quality
python -m src.cli.train_models --leagues EPL
```

### Testing
```bash
# Unit tests
pytest tests/unit/test_sota_stack.py -v

# Integration tests
pytest tests/integration/test_sota_ensemble_integration.py -v

# Full suite
pytest tests/ -v -k sota
```

## Key Configuration

| Parameter | Development | Production | Notes |
|-----------|------------|------------|-------|
| `time_limit` | 60s | 300-600s | Training budget |
| `presets` | `medium_quality` | `best_quality` | Quality vs speed |
| `blend_weight` | 0.5 | Auto-tuned | SOTA vs Super Learner |

## Performance Targets

| Metric | Baseline | Target | Improvement |
|--------|----------|--------|-------------|
| Accuracy | 67% | 68% | +1% |
| Brier Score | 0.185 | 0.172 | -7% |
| Log Loss | 0.90 | 0.85 | -5% |

## Troubleshooting

### AutoGluon not installed
```bash
pip install 'autogluon.tabular>=1.0.0'
```

### Out of memory
```bash
# Reduce time limit
--sota-time-limit 120

# Use lighter preset
--sota-presets medium_quality
```

### Check if enabled
```python
from src.models.ensemble import load_ensemble
model = load_ensemble('models/epl.pkl')
print(model.sota_stack)  # Should not be None
print(model.get_metadata()['sota_accuracy'])  # Should show metric
```

## Architecture

```
Input Features (X)
        ↓
┌───────────────────┐
│  Super Learner    │  ← Base ensemble (always trained)
│  (RF/XGB/LGBM)    │
└───────────────────┘
        ↓
  Base Predictions
        ↓
┌───────────────────┐
│  SOTA Stack       │  ← Optional AutoGluon layer
│  (AutoGluon)      │
└───────────────────┘
        ↓
  Dynamic Blending
        ↓
  Final Predictions
```

## Files Modified

- `backend/requirements.txt` - Added autogluon.tabular
- `backend/src/models/sota_stack.py` - SOTA ensemble implementation
- `backend/src/models/ensemble.py` - Integration with SabiScoreEnsemble
- `backend/src/models/training.py` - ModelTrainer SOTA configuration
- `backend/src/core/config.py` - Environment variable support
- `backend/src/cli/train_models.py` - CLI flags (already present)

## Documentation

- 📘 [Full Guide](./SOTA_STACKING_GUIDE.md) - Complete documentation
- 📋 [Production Checklist](./PRODUCTION_READINESS_CHECKLIST.md) - Deployment guide
- 🏗️ [Architecture](./ARCHITECTURE_V3.md) - System design

## Next Steps

1. ✅ Install AutoGluon
2. ✅ Train test model with SOTA
3. ✅ Validate metrics improvement
4. ✅ Deploy to staging
5. ✅ A/B test vs baseline
6. ✅ Deploy to production

---

For detailed usage, see [SOTA_STACKING_GUIDE.md](./SOTA_STACKING_GUIDE.md)
