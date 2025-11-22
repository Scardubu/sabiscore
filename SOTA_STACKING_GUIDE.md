# SOTA Stacking Integration Guide

**Version:** 1.0.0  
**Date:** November 21, 2025  
**Status:** ✅ Production Ready

---

## Overview

SabiScore now features **SOTA (State-of-the-Art) Stacking** powered by AutoGluon's TabularPredictor, providing a cutting-edge ensemble layer on top of our existing GodStack Super Learner. This integration targets **+0.5–1% accuracy improvement** through advanced AutoML stacking while maintaining backward compatibility.

### Architecture

```
┌─────────────────────────────────────────────┐
│          SabiScore Ensemble                  │
├─────────────────────────────────────────────┤
│                                             │
│  ┌────────────────────────────────────┐   │
│  │   SOTA Stacking Layer (Optional)    │   │
│  │   - AutoGluon TabularPredictor      │   │
│  │   - Dynamic Blending                │   │
│  │   - Brier-based Weight Adjustment   │   │
│  └────────────────────────────────────┘   │
│                    ↓                        │
│  ┌────────────────────────────────────┐   │
│  │   GodStack Super Learner (Base)     │   │
│  │   - Multi-level Stacking            │   │
│  │   - sklearn/H2O Backend             │   │
│  │   - Isotonic Calibration            │   │
│  └────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Features

### ✨ Key Capabilities

- **🚀 AutoML Stacking**: Leverages AutoGluon's ensemble of 10+ algorithms (XGBoost, LightGBM, CatBoost, Neural Networks, etc.)
- **⚖️ Dynamic Blending**: Automatically adjusts blend weights based on validation Brier scores
- **🔧 Configurable**: Time limits, quality presets, and hyperparameters fully customizable
- **🛡️ Graceful Degradation**: System works seamlessly even if AutoGluon not installed
- **📊 Rich Metrics**: Tracks accuracy, Brier score, log loss for both Super Learner and SOTA layers
- **💾 Persistence**: Full serialization support with joblib

### 🎯 Performance Targets

| Metric | Super Learner Baseline | SOTA Target | Improvement |
|--------|----------------------|-------------|-------------|
| Accuracy | 65-68% | 66-69% | +0.5-1% |
| Brier Score | 0.18-0.20 | 0.16-0.18 | -10% |
| Log Loss | 0.85-0.95 | 0.80-0.90 | -5% |

---

## Installation

### Basic Installation (No SOTA)

```bash
cd backend
pip install -r requirements.txt
```

### With SOTA Stacking (Recommended for Production)

```bash
cd backend
pip install -r requirements.txt
pip install 'autogluon.tabular>=1.0.0'
```

**Note:** AutoGluon is a large dependency (~2GB). Only install if you plan to use `--enable-sota-stack`.

### Docker Installation

AutoGluon is included in production Docker images:

```dockerfile
# Automatically installed via requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
```

---

## Usage

### CLI Training

#### Basic Training (Super Learner Only)

```bash
python -m src.cli.train_models --leagues EPL Bundesliga
```

#### With SOTA Stacking (Recommended)

```bash
python -m src.cli.train_models \
  --leagues EPL Bundesliga "La Liga" \
  --enable-sota-stack \
  --sota-time-limit 300 \
  --sota-presets best_quality
```

#### Full Configuration Example

```bash
python -m src.cli.train_models \
  --leagues EPL Bundesliga "La Liga" "Serie A" "Ligue 1" \
  --enable-sota-stack \
  --sota-time-limit 600 \
  --sota-presets best_quality \
  --sota-hyperparameters '{"GBM": {"num_boost_round": 500}, "NN": {"epochs": 100}}' \
  --prefer-gpu \
  --engine h2o \
  --h2o-max-mem 16G
```

### Environment Variables

Configure SOTA stacking via environment variables:

```bash
# Enable SOTA stacking
export ENABLE_SOTA_STACK=1

# Time budget (seconds)
export SOTA_TIME_LIMIT=300

# Quality preset
export SOTA_PRESETS=best_quality

# Custom hyperparameters (JSON)
export SOTA_HYPERPARAMETERS='{"GBM": {"num_boost_round": 500}}'
```

Then run training:

```bash
python -m src.cli.train_models --leagues EPL
```

### Python API

#### Direct Integration

```python
from src.models.ensemble import SabiScoreEnsemble
from src.models.training import ModelTrainer

# Option 1: Via ModelTrainer (Recommended)
trainer = ModelTrainer(
    enable_sota_stack=True,
    sota_time_limit=300,
    sota_presets='best_quality',
)
results = trainer.train_league_models(['EPL', 'Bundesliga'])

# Option 2: Direct Ensemble Usage
ensemble = SabiScoreEnsemble(
    league='EPL',
    enable_sota_stack=True,
    sota_kwargs={
        'time_limit': 300,
        'presets': 'best_quality',
        'blend_weight': 0.6,
    }
)
ensemble.build_ensemble(X_train, y_train)
predictions = ensemble.predict(X_test)
```

#### Standalone SOTA Stack

```python
from src.models.sota_stack import SotaStackingEnsemble
import pandas as pd

# Check availability
if not SotaStackingEnsemble.is_available():
    print("AutoGluon not installed")
    exit(1)

# Create and train
sota = SotaStackingEnsemble(
    model_path='./models/epl_sota',
    time_limit=600,
    presets='best_quality',
    calibrate=True,
)

sota.fit(X_train, y_train, X_val=X_val, y_val=y_val)

# Predict
proba = sota.predict_proba(X_test)

# Blend with Super Learner
blended = sota.blend_with_super_learner(X_test, super_learner_proba)

# Access metrics
print(f"Accuracy: {sota.metrics['accuracy']:.2%}")
print(f"Brier Score: {sota.metrics['brier_score']:.4f}")
```

---

## Configuration Reference

### CLI Arguments

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--enable-sota-stack` | flag | False | Enable SOTA stacking layer |
| `--sota-time-limit` | int | None | Training time budget (seconds) |
| `--sota-presets` | str | None | AutoGluon quality preset |
| `--sota-hyperparameters` | JSON | None | Custom hyperparameter config |

### Quality Presets

| Preset | Training Time | Models | Ensembling | Best For |
|--------|--------------|--------|------------|----------|
| `best_quality` | Longest | All | Full | Production (recommended) |
| `high_quality` | Long | Most | Aggressive | Production |
| `good_quality` | Medium | Standard | Moderate | Development |
| `medium_quality` | Short | Core | Light | Testing |
| `optimize_for_deployment` | Minimal | Efficient | Single | Edge/Mobile |

### Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ENABLE_SOTA_STACK` | bool | False | Master toggle for SOTA |
| `SOTA_TIME_LIMIT` | int | None | Training time budget |
| `SOTA_PRESETS` | str | None | Quality preset name |
| `SOTA_HYPERPARAMETERS` | JSON | None | Hyperparameter config |

### SotaStackingEnsemble Parameters

```python
SotaStackingEnsemble(
    model_path: str,                    # Path for AutoGluon artifacts
    time_limit: Optional[int] = None,   # Training time budget (seconds)
    presets: Optional[str] = None,      # Quality preset
    hyperparameters: Optional[dict] = None,  # Custom hyperparameters
    blend_weight: float = 0.5,          # Initial SOTA weight (0-1)
    calibrate: bool = True,             # Enable probability calibration
)
```

---

## Monitoring & Metrics

### Training Output

When SOTA stacking is enabled, you'll see extended training output:

```
=== Training EPL Model ===
✓ Super Learner trained
  - Level-1 Accuracy: 66.5%
  - Level-2 Accuracy: 67.2%
  - Brier Score: 0.185

🚀 Training SOTA stacking layer...
  - Time budget: 300s
  - Quality preset: best_quality
  
✓ SOTA stacking complete
  - 🚀 SOTA Accuracy: 68.1%
  - 🚀 SOTA Brier: 0.168
  - 🚀 SOTA Log Loss: 0.82
  - 🚀 Best Model: WeightedEnsemble_L2
  
📊 Final Blended Performance:
  - Accuracy: 68.5% (+1.3% vs baseline)
  - Brier Score: 0.172 (-7% vs baseline)
```

### Model Metadata

SOTA metrics are included in model metadata:

```python
ensemble = load_ensemble('epl_model.pkl')
metadata = ensemble.get_metadata()

print(metadata['sota_accuracy'])    # 0.685
print(metadata['sota_brier'])       # 0.172
print(metadata['sota_log_loss'])    # 0.82
print(metadata['sota_engine'])      # 'AutoGluon'
```

### API Response

Prediction API includes SOTA metadata:

```json
{
  "match_id": "epl_123",
  "predictions": {
    "home_win": 0.55,
    "draw": 0.28,
    "away_win": 0.17
  },
  "metadata": {
    "engine": "god_stack_superlearner_with_sota",
    "sota_enabled": true,
    "sota_accuracy": 0.685,
    "sota_brier": 0.172
  }
}
```

---

## Performance Optimization

### Time Budget Guidelines

| League Size | Development | Production | Best Quality |
|------------|-------------|-----------|--------------|
| Small (100-500) | 60s | 180s | 300s |
| Medium (500-2000) | 120s | 300s | 600s |
| Large (2000+) | 300s | 600s | 1200s |

### Memory Requirements

- **Super Learner Only**: 2-4 GB RAM
- **With SOTA Stacking**: 6-12 GB RAM (depends on preset)
- **GPU Support**: Optional, enables faster tree boosting

### Recommended Production Settings

```bash
# Production deployment (Render.com)
export ENABLE_SOTA_STACK=1
export SOTA_TIME_LIMIT=600
export SOTA_PRESETS=best_quality
export RENDER_INSTANCE_TYPE=standard-plus  # 4GB RAM minimum
```

---

## Troubleshooting

### AutoGluon Not Installed

**Symptom:**
```
⚠️  SOTA stacking requested but AutoGluon not available
⚠️  Proceeding with Super Learner only
```

**Solution:**
```bash
pip install 'autogluon.tabular>=1.0.0'
```

### Out of Memory (OOM)

**Symptom:**
```
AutoGluon training killed (OOM)
```

**Solutions:**
1. Reduce time limit: `--sota-time-limit 120`
2. Use lighter preset: `--sota-presets medium_quality`
3. Increase instance RAM
4. Disable SOTA: Remove `--enable-sota-stack`

### Long Training Times

**Symptom:** Training takes hours

**Solutions:**
1. Reduce time budget: `--sota-time-limit 180`
2. Use faster preset: `--sota-presets good_quality`
3. Enable GPU: `--prefer-gpu`
4. Train leagues in parallel (separate processes)

### Blend Weight Issues

**Symptom:** SOTA predictions seem ignored

**Check:**
```python
print(ensemble.sota_stack.blend_weight)  # Should be 0.5-0.8
print(ensemble.sota_stack.metrics)       # Check Brier score
```

**Fix:** Manually set blend weight:
```python
sota_kwargs={'blend_weight': 0.7}
```

---

## Testing

### Unit Tests

```bash
# Test SOTA module
pytest tests/unit/test_sota_stack.py -v

# Test ensemble integration
pytest tests/unit/test_ensemble.py -v -k sota
```

### Integration Tests

```bash
# Full pipeline test
pytest tests/integration/test_sota_ensemble_integration.py -v

# With coverage
pytest tests/integration/ -v --cov=src.models.sota_stack
```

### Manual Validation

```bash
# Train small test model
python -m src.cli.train_models \
  --leagues EPL \
  --enable-sota-stack \
  --sota-time-limit 60 \
  --sota-presets medium_quality

# Check metadata
python -c "
from src.models.ensemble import load_ensemble
model = load_ensemble('backend/models/epl.pkl')
print(model.get_metadata())
"
```

---

## Migration Guide

### Existing Models

Existing Super Learner models continue to work without changes. To add SOTA stacking:

1. **Retrain with SOTA enabled:**
```bash
python -m src.cli.train_models --leagues EPL --enable-sota-stack
```

2. **A/B test performance:**
```python
# Load both models
old_model = load_ensemble('epl_old.pkl')
new_model = load_ensemble('epl_sota.pkl')

# Compare metrics
compare_models(old_model, new_model, test_data)
```

3. **Deploy new model:**
```bash
# Replace old model
mv models/epl.pkl models/epl_backup.pkl
mv models/epl_sota.pkl models/epl.pkl

# Restart service
supervisorctl restart sabiscore-api
```

### Rollback Procedure

If SOTA causes issues:

```bash
# 1. Disable SOTA in environment
unset ENABLE_SOTA_STACK

# 2. Restore backup models
mv models/epl_backup.pkl models/epl.pkl

# 3. Restart service
supervisorctl restart sabiscore-api
```

---

## Best Practices

### ✅ Do

- **Use in Production**: SOTA stacking is production-ready
- **Set Time Limits**: Always specify `--sota-time-limit` to prevent runaway training
- **Monitor Metrics**: Track `sota_brier` to validate improvement
- **A/B Test**: Compare SOTA vs non-SOTA before full deployment
- **Use GPU**: Enable `--prefer-gpu` for faster training
- **Tune Blend Weight**: Adjust based on validation performance

### ❌ Don't

- **Don't Skip Validation**: Always validate on holdout data
- **Don't Use Tiny Datasets**: SOTA requires 500+ samples for best results
- **Don't Ignore Memory**: Monitor RAM usage during training
- **Don't Over-tune**: Start with `best_quality` preset before customizing
- **Don't Deploy Untested**: Always test in staging first

---

## Roadmap

### Completed ✅

- [x] AutoGluon integration
- [x] Dynamic blending
- [x] CLI configuration
- [x] Environment variables
- [x] Unit tests
- [x] Integration tests
- [x] Documentation

### Upcoming 🚀

- [ ] Online learning with River integration
- [ ] Multi-objective optimization (accuracy + latency)
- [ ] Explainability features (SHAP values)
- [ ] Automated hyperparameter tuning
- [ ] Distributed training support

---

## Support

### Issues & Questions

- **GitHub Issues**: https://github.com/Scardubu/sabiscore/issues
- **Documentation**: See `docs/` directory
- **Performance Tuning**: Contact ML team

### Related Documentation

- [Training Pipeline Guide](./BACKEND_SETUP_GUIDE.md)
- [Deployment Guide](./DEPLOY_NOW.md)
- [Production Checklist](./PRODUCTION_READINESS_CHECKLIST.md)
- [API Documentation](./docs/API.md)

---

**Last Updated:** November 21, 2025  
**Contributors:** GitHub Copilot, SabiScore ML Team
