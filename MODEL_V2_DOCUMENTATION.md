# SabiScore Production Model V2 Documentation

**Version**: 2.0  
**Training Date**: December 20, 2025  
**Status**: Production Ready ✅

---

## Executive Summary

The SabiScore Production Model V2 is a stacked ensemble machine learning model trained on 10,707 real historical football matches from Europe's top 5 leagues. It achieves 52.80% accuracy on 3-way match outcome prediction (Home/Draw/Away), which is considered professional-grade given:

- Random baseline: 33.3%
- Betting market implied accuracy: ~48-52%
- Professional tipster range: 50-55%

---

## Training Data

### Source
- **Primary**: football-data.co.uk (historical odds and results)
- **Data Quality**: Real match results with official betting odds

### Coverage
| League | Seasons | Matches |
|--------|---------|---------|
| English Premier League (EPL) | 2019-2025 | ~2,280 |
| La Liga | 2019-2025 | ~2,280 |
| Serie A | 2019-2025 | ~2,280 |
| Bundesliga | 2019-2025 | ~1,836 |
| Ligue 1 | 2019-2025 | ~2,280 |
| **Total** | **6 seasons** | **10,707** |

### Data Split
- **Training**: 9,101 matches (85%)
- **Testing**: 1,606 matches (15%)
- **Validation**: 5-fold time-series cross-validation

---

## Model Architecture

### Stacked Ensemble
```
Level 0 (Base Learners):
├── XGBoost Classifier (gradient boosting)
├── LightGBM Classifier (leaf-wise boosting)
├── CatBoost Classifier (ordered boosting)
├── Random Forest Classifier (bagging)
├── Extra Trees Classifier (random splits)
└── Gradient Boosting Classifier (stage-wise)

Level 1 (Meta-Learner):
└── Logistic Regression (probability calibration)
```

### Why Stacking?
- Combines diverse learning approaches (boosting, bagging, random splits)
- Meta-learner calibrates probabilities from base predictions
- Reduces overfitting compared to single complex model
- Industry standard for tabular prediction tasks

---

## Feature Engineering

### Feature Categories (58 total)

#### 1. Form Metrics (8 features)
| Feature | Description |
|---------|-------------|
| `home_form_last5_home` | Home team's form in last 5 home games |
| `home_wins_last5_home` | Wins in last 5 home games |
| `home_draws_last5_home` | Draws in last 5 home games |
| `home_losses_last5_home` | Losses in last 5 home games |
| `away_form_last5_away` | Away team's form in last 5 away games |
| `away_wins_last5_away` | Wins in last 5 away games |
| `away_draws_last5_away` | Draws in last 5 away games |
| `away_losses_last5_away` | Losses in last 5 away games |

#### 2. Goals Analysis (9 features)
| Feature | Description |
|---------|-------------|
| `home_goals_for_avg` | Home team avg goals scored |
| `home_goals_against_avg` | Home team avg goals conceded |
| `away_goals_for_avg` | Away team avg goals scored |
| `away_goals_against_avg` | Away team avg goals conceded |
| `total_goals_expected` | Combined expected goals |
| `home_gd_recent` | Home team recent goal difference |
| `away_gd_recent` | Away team recent goal difference |
| `combined_attack` | Attack strength combination |
| `combined_defense_weakness` | Defense vulnerability score |

#### 3. Market Signals (13 features)
| Feature | Description |
|---------|-------------|
| `market_prob_home` | Implied probability from home odds |
| `market_prob_draw` | Implied probability from draw odds |
| `market_prob_away` | Implied probability from away odds |
| `market_edge_home` | Calculated edge on home bet |
| `market_favorite` | Which outcome is favored |
| `odds_ratio` | Home/Away odds ratio |
| `log_odds_home/draw/away` | Log-transformed odds |
| `draw_probability` | Enhanced draw probability |
| `market_confidence` | Market certainty indicator |
| `ev_home/draw/away` | Expected value calculations |

#### 4. Head-to-Head (6 features)
| Feature | Description |
|---------|-------------|
| `h2h_home_wins` | Historical home wins in H2H |
| `h2h_away_wins` | Historical away wins in H2H |
| `h2h_draws` | Historical draws in H2H |
| `h2h_matches` | Total H2H matches |
| `h2h_dominance` | Dominance score in rivalry |
| `h2h_market_agreement` | H2H vs market alignment |

#### 5. Venue Statistics (5 features)
| Feature | Description |
|---------|-------------|
| `home_venue_win_rate` | Home win rate at venue |
| `home_venue_draw_rate` | Draw rate at venue |
| `home_venue_loss_rate` | Loss rate at venue |
| `home_advantage_strength` | Quantified home advantage |
| `venue_market_combo` | Venue-adjusted market signal |

#### 6. Temporal Features (4 features)
| Feature | Description |
|---------|-------------|
| `day_of_week` | Match day (0-6) |
| `is_weekend` | Weekend flag |
| `month` | Month of season |
| `season_phase` | Early/Mid/Late season |

#### 7. League Context (3 features)
| Feature | Description |
|---------|-------------|
| `league_home_rate` | League average home win rate |
| `league_avg_goals` | League average goals per game |
| `league_draw_rate` | League draw frequency |

#### 8. Combined Features (5 features)
| Feature | Description |
|---------|-------------|
| `form_market_agreement_home` | Form aligns with market |
| `form_market_disagreement` | Form diverges from market |
| `home_attack_vs_away_defense` | Attack/defense matchup |
| `away_attack_vs_home_defense` | Reverse matchup |
| `league_*` (one-hot) | League indicators |

---

## Feature Importance (Top 20)

| Rank | Feature | Importance |
|------|---------|------------|
| 1 | `ev_home` | 454.5 |
| 2 | `form_market_disagreement` | 385.9 |
| 3 | `home_attack_vs_away_defense` | 353.2 |
| 4 | `away_attack_vs_home_defense` | 331.7 |
| 5 | `form_market_agreement_home` | 300.9 |
| 6 | `h2h_market_agreement` | 295.2 |
| 7 | `venue_market_combo` | 279.8 |
| 8 | `combined_defense_weakness` | 227.7 |
| 9 | `log_odds_draw` | 225.9 |
| 10 | `total_goals_expected` | 217.8 |
| 11 | `market_prob_draw` | 204.1 |
| 12 | `home_gd_recent` | 185.9 |
| 13 | `away_gd_recent` | 183.8 |
| 14 | `month` | 174.5 |
| 15 | `market_prob_away` | 167.1 |
| 16 | `market_prob_home` | 143.7 |
| 17 | `away_form_last5_away` | 141.0 |
| 18 | `away_goals_against_avg` | 135.9 |
| 19 | `home_venue_draw_rate` | 134.8 |
| 20 | `home_goals_against_avg` | 129.3 |

### Key Insights
- **Expected Value (EV) features** are most predictive
- **Form vs Market disagreement** reveals value opportunities
- **Attack vs Defense matchups** capture tactical dynamics
- **Market signals** encode collective wisdom effectively
- **Temporal features** capture seasonal patterns

---

## Performance Metrics

### Cross-Validation (5-Fold Time-Series)
| Fold | Train Size | Val Size | Accuracy | Log Loss |
|------|------------|----------|----------|----------|
| 1 | 1,521 | 1,516 | 47.43% | 1.081 |
| 2 | 3,037 | 1,516 | 51.06% | 1.017 |
| 3 | 4,553 | 1,516 | 51.91% | 1.004 |
| 4 | 6,069 | 1,516 | 52.44% | 0.993 |
| 5 | 7,585 | 1,516 | 52.04% | 0.981 |
| **Mean** | - | - | **50.98%** | **1.015** |
| **Std** | - | - | **±1.83%** | **±0.04** |

### Test Set Performance
| Metric | Value |
|--------|-------|
| **Accuracy** | 52.80% |
| **Log Loss** | 0.973 |
| **Test Samples** | 1,606 |

### Confusion Matrix
```
                Predicted
              H     D     A
Actual  H   544    23   108   (675 total)
        D   245    24   126   (395 total)
        A   224    32   280   (536 total)
```

### Class Distribution
| Class | Actual | Predicted |
|-------|--------|-----------|
| Home (0) | 42.0% | 63.1% |
| Draw (1) | 24.6% | 4.9% |
| Away (2) | 33.4% | 32.0% |

### Betting Simulation (Test Set)
| Strategy | Profit | Bets | ROI |
|----------|--------|------|-----|
| Flat Betting | +3,550 | 1,606 | +221% |
| Value Betting (5% edge) | +3,574 | 1,528 | +234% |

---

## Model Files

### Production Artifacts
```
models/
├── sabiscore_production_v2.joblib    # Main model file (~15MB)
└── sabiscore_production_v2.json      # Metadata & feature names

backend/models/
├── sabiscore_production_v2.joblib    # Backup copy
├── sabiscore_production_v2.json      # Backup metadata
└── training_report.json              # Full training report
```

### Model Loading
```python
from src.models.ensemble import SabiScoreEnsemble

# Load latest model (V2 preferred, legacy fallback)
model = SabiScoreEnsemble.load_latest_model(models_path)

# Check model version
print(f"Is V2: {model.is_v2}")
print(f"Features: {len(model.v2_feature_names)}")
```

---

## API Integration

### Prediction Endpoint
```python
POST /api/v1/predict
Content-Type: application/json

{
  "home_team": "Arsenal",
  "away_team": "Chelsea",
  "league": "EPL",
  "date": "2025-12-21"
}
```

### Response
```json
{
  "prediction": {
    "home_win": 0.45,
    "draw": 0.28,
    "away_win": 0.27,
    "recommended": "home",
    "confidence": 0.72,
    "value_bet": true,
    "edge": 0.08
  },
  "model_version": "v2",
  "features_used": 58
}
```

---

## Deployment

### Local Testing
```powershell
cd backend
python -c "
from src.models.ensemble import SabiScoreEnsemble
from src.core.config import settings
model = SabiScoreEnsemble.load_latest_model(str(settings.models_path))
print(f'V2 Loaded: {model.is_v2}')
print(f'Features: {len(model.v2_feature_names)}')
"
```

### Production (Render)
1. Push changes to `main` branch
2. Render auto-deploys from GitHub
3. Model loaded from `models/` directory
4. Health check verifies model status

---

## Limitations & Future Work

### Current Limitations
- Draw prediction is weakest class (model bias toward Home/Away)
- Requires minimum 5 games of history for form features
- No live/in-play prediction support yet
- Limited to 5 European leagues

### Planned Improvements
1. **Draw Calibration**: Specific handling for draw probability
2. **Player-Level Features**: Injuries, suspensions, lineup data
3. **Real-Time Updates**: In-play probability adjustments
4. **League Expansion**: Championship, Eredivisie, Portuguese Liga
5. **Ensemble Tuning**: Per-league model weights

---

## Changelog

### V2.0 (December 2025)
- Initial production release
- 10,707 match training dataset
- 58 engineered features
- Stacked ensemble architecture
- 52.80% test accuracy

### V1.0 (Legacy)
- Per-league separate models
- 86 features (many sparse)
- ~48% accuracy
- Deprecated, fallback only

---

## References

- Training Script: `backend/train_production_model_v2.py`
- Feature Engineering: `backend/src/models/features.py`
- Model Loading: `backend/src/models/ensemble.py`
- API Service: `backend/src/api/main.py`
- Data Source: https://football-data.co.uk
