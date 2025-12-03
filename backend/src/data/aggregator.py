import asyncio
import concurrent.futures
import json
import logging
from typing import Any, Callable, Dict, List, Optional, TypeVar
from datetime import datetime

import numpy as np
import pandas as pd

from ..core.cache import cache
from ..core.config import settings

# Import from old scrapers module for backward compatibility
from .scrapers import (
    FlashscoreScraper,
    OddsPortalScraper,
    TransfermarktScraper,
)

# Import new enhanced scrapers
from .scrapers import (
    FootballDataEnhancedScraper,
    BetfairExchangeScraper,
    SoccerwayScraper,
    UnderstatScraper,
)


logger = logging.getLogger(__name__)


class DataAggregator:
    """Aggregate match data from multiple public sources."""

    def __init__(self, matchup: str, league: str) -> None:
        self.matchup = matchup
        self.league = league
        self.teams = self._parse_matchup(matchup)
        self.flashscore = FlashscoreScraper()
        self.oddsportal = OddsPortalScraper()
        self.transfermarkt = TransfermarktScraper()
        self._history_cache: Optional[pd.DataFrame] = None

    @staticmethod
    def _parse_matchup(matchup: str) -> Dict[str, str]:
        parts = matchup.split(" vs ")
        if len(parts) != 2:
            raise ValueError(f"Invalid matchup format: {matchup}")
        return {"home": parts[0].strip(), "away": parts[1].strip()}

    def fetch_match_data(self) -> Dict[str, Any]:
        cache_key = f"match_data:{self.matchup}:{self.league}".lower()
        cached_data = cache.get(cache_key)
        if cached_data:
            logger.info("Using cached aggregate for %s", self.matchup)
            try:
                data = _deserialize_from_cache(cached_data)
                metadata = data.setdefault("metadata", {})
                cache_meta = metadata.setdefault("cache", {})
                cache_meta["status"] = "cached"
                cache_meta["cached_at"] = datetime.utcnow().isoformat()
                freshness = metadata.get("freshness")
                if not isinstance(freshness, dict):
                    metadata["freshness"] = {"cached_at": cache_meta["cached_at"]}

                # Ensure consistent structure even for cached data
                data.setdefault("odds", {})
                data.setdefault("injuries", pd.DataFrame())
                data.setdefault("head_to_head", pd.DataFrame())
                data.setdefault("team_stats", {})
                data.setdefault("current_form", {})

                return data
            except Exception as e:
                logger.warning(f"Failed to deserialize cached data: {e}")
                # Continue to fetch fresh data

        # Fetch data with error handling for each component
        try:
            historical_stats = self.fetch_historical_stats()
        except Exception as e:
            logger.warning(f"Failed to fetch historical stats: {e}")
            historical_stats = pd.DataFrame()

        try:
            current_form = self.fetch_current_form()
        except Exception as e:
            logger.warning(f"Failed to fetch current form: {e}")
            current_form = {}

        try:
            odds = self.fetch_odds()
        except Exception as e:
            logger.warning(f"Failed to fetch odds: {e}")
            odds = {"home_win": 2.0, "draw": 3.2, "away_win": 3.5}

        try:
            injuries = self.fetch_injuries()
        except Exception as e:
            logger.warning(f"Failed to fetch injuries: {e}")
            injuries = pd.DataFrame()

        try:
            head_to_head = self.fetch_head_to_head()
        except Exception as e:
            logger.warning(f"Failed to fetch head to head: {e}")
            head_to_head = pd.DataFrame()

        try:
            team_stats = self.fetch_team_stats()
        except Exception as e:
            logger.warning(f"Failed to fetch team stats: {e}")
            team_stats = self._create_mock_team_stats()

        data = {
            "historical_stats": historical_stats,
            "current_form": current_form,
            "odds": odds,
            "injuries": injuries,
            "head_to_head": head_to_head,
            "team_stats": team_stats,
            "metadata": {
                "matchup": self.matchup,
                "league": self.league,
                "home_team": self.teams["home"],
                "away_team": self.teams["away"],
                "generated_at": datetime.utcnow().isoformat(),
                "freshness": {
                    "historical_stats": getattr(self.flashscore, 'last_scrape_at', datetime.utcnow().isoformat()),
                    "odds": getattr(self.oddsportal, 'last_scrape_at', datetime.utcnow().isoformat()),
                    "injuries": getattr(self.transfermarkt, 'last_scrape_at', datetime.utcnow().isoformat()),
                },
            },
        }

        # Ensure consistent structure even if scrapers return empty
        data.setdefault("odds", {})
        data.setdefault("injuries", pd.DataFrame())
        data.setdefault("head_to_head", pd.DataFrame())
        data.setdefault("team_stats", {})
        data.setdefault("current_form", {})

        try:
            cache_safe = _serialize_for_cache(data)
            cache.set(cache_key, cache_safe, settings.redis_cache_ttl)
        except Exception as e:
            logger.warning(f"Failed to cache data: {e}")

        return data

    def _create_mock_team_stats(self) -> Dict[str, Any]:
        """Create mock team statistics when scraping fails"""
        return {
            "home": {
                "attacking_strength": 0.8,
                "defensive_strength": 0.7,
                "win_rate": 0.6,
                "goals_per_game": 1.8,
                "clean_sheet_rate": 0.3
            },
            "away": {
                "attacking_strength": 0.7,
                "defensive_strength": 0.8,
                "win_rate": 0.5,
                "goals_per_game": 1.5,
                "clean_sheet_rate": 0.25
            }
        }

    # ------------------------------------------------------------------
    def fetch_historical_stats(self) -> pd.DataFrame:
        if self._history_cache is not None:
            return self._history_cache.copy()

        try:
            home_df = self.flashscore.scrape_match_results(self.teams["home"], self.league)
            away_df = self.flashscore.scrape_match_results(self.teams["away"], self.league)

            combined = pd.concat([home_df, away_df])
            if combined.empty:
                logger.warning("Historical stats empty for %s, attempting local fallback", self.matchup)
                fallback_df = self._load_local_history()
                self._history_cache = fallback_df
                return fallback_df

            combined = combined.assign(
                home_possession=np.nan,
                away_possession=np.nan,
                home_shots=np.nan,
                away_shots=np.nan,
                home_shots_on_target=np.nan,
                away_shots_on_target=np.nan,
                home_corners=np.nan,
                away_corners=np.nan,
            )
            self._history_cache = combined
            return combined.copy()
        except Exception as e:
            logger.warning(f"Failed to fetch historical stats: {e}")
            fallback_df = self._load_local_history()
            self._history_cache = fallback_df
            return fallback_df

    def fetch_current_form(self) -> Dict[str, Any]:
        try:
            history = self.fetch_historical_stats()
            if history.empty:
                return {"home": {}, "away": {}}

            def form_for(team: str) -> Dict[str, Any]:
                if "home_team" not in history.columns or "away_team" not in history.columns:
                    return {}
                team_games = history["home_team"].eq(team) | history["away_team"].eq(team)
                recent = history[team_games].head(5)
                results = []
                goals_scored = 0
                goals_conceded = 0
                clean_sheets = 0
                
                for _, row in recent.iterrows():
                    is_home = row["home_team"] == team
                    team_goals = row["home_score"] if is_home else row["away_score"]
                    opp_goals = row["away_score"] if is_home else row["home_score"]
                    if team_goals > opp_goals:
                        results.append("W")
                    elif team_goals == opp_goals:
                        results.append("D")
                    else:
                        results.append("L")
                    goals_scored += team_goals
                    goals_conceded += opp_goals
                    if opp_goals == 0:
                        clean_sheets += 1

                return {
                    "last_5_games": results,
                    "goals_scored": goals_scored,
                    "goals_conceded": goals_conceded,
                    "clean_sheets": clean_sheets,
                }

            return {
                "home": form_for(self.teams["home"]),
                "away": form_for(self.teams["away"]),
            }
        except Exception as e:
            logger.warning(f"Failed to fetch current form for {self.matchup}: {e}")
            return {"home": {}, "away": {}}

    def fetch_odds(self) -> Dict[str, float]:
        try:
            odds = self.oddsportal.scrape_odds(self.teams["home"], self.teams["away"])
            if not odds:
                logger.warning("No odds found for %s, using default odds", self.matchup)
                return {"home_win": 2.0, "draw": 3.2, "away_win": 3.5}
            return odds
        except Exception as e:
            logger.warning(f"Failed to fetch odds for {self.matchup}: {e}")
            return {"home_win": 2.0, "draw": 3.2, "away_win": 3.5}

    def fetch_injuries(self) -> pd.DataFrame:
        try:
            home_injuries = self.transfermarkt.scrape_injuries(self.teams["home"])
            home_injuries["team"] = self.teams["home"]

            away_injuries = self.transfermarkt.scrape_injuries(self.teams["away"])
            away_injuries["team"] = self.teams["away"]

            return pd.concat([home_injuries, away_injuries], ignore_index=True)
        except Exception as e:
            logger.warning(f"Failed to fetch injuries for {self.matchup}: {e}")
            return pd.DataFrame()

    def fetch_head_to_head(self) -> pd.DataFrame:
        try:
            history = self.fetch_historical_stats()
            if history.empty:
                return history
            mask = (
                (history["home_team"].eq(self.teams["home"]) & history["away_team"].eq(self.teams["away"]))
                | (history["home_team"].eq(self.teams["away"]) & history["away_team"].eq(self.teams["home"]))
            )
            return history[mask]
        except Exception as e:
            logger.warning(f"Failed to fetch head-to-head stats for {self.matchup}: {e}")
            return pd.DataFrame()

    def fetch_team_stats(self) -> Dict[str, Dict[str, Any]]:
        try:
            player_values_home = self.transfermarkt.scrape_player_values(self.teams["home"])
            player_values_away = self.transfermarkt.scrape_player_values(self.teams["away"])

            def summarize(values: pd.DataFrame) -> Dict[str, Any]:
                avg_value = values["value"].str.replace("€", "").str.replace("m", "").astype(float, errors="ignore")
                avg_value = pd.to_numeric(avg_value, errors="coerce")
                return {
                    "average_age": float(values["age"].mean()) if "age" in values else None,
                    "squad_value_mean": float(avg_value.mean()) if not avg_value.empty else None,
                    "squad_size": int(len(values)),
                }

            return {
                "home": summarize(player_values_home),
                "away": summarize(player_values_away),
            }
        except Exception as e:
            logger.warning(f"Failed to fetch team stats for {self.matchup}: {e}")
            return self._create_mock_team_stats()


    def _load_local_history(self) -> pd.DataFrame:
        """Load fallback historical matches from processed data."""

        league_map = {
            "EPL": "epl_matches.json",
            "La Liga": "la_liga_matches.json",
            "Serie A": "serie_a_matches.json",
            "Bundesliga": "bundesliga_matches.json",
            "Ligue 1": "ligue_1_matches.json",
        }

        filename = league_map.get(self.league)
        if not filename:
            return pd.DataFrame()

        file_path = settings.data_path / filename
        if not file_path.exists():
            return pd.DataFrame()

        try:
            with open(file_path, "r", encoding="utf-8") as handle:
                data = json.load(handle)
        except (OSError, json.JSONDecodeError) as exc:
            logger.warning("Failed to load local history for %s: %s", self.matchup, exc)
            return pd.DataFrame()

        matches = data.get("matches", [])
        if not matches:
            return pd.DataFrame()

        normalized_home = self.teams["home"].lower()
        normalized_away = self.teams["away"].lower()
        rows = []
        for match in matches:
            home = match.get("team1")
            away = match.get("team2")
            if not home or not away:
                continue
            if normalized_home not in home.lower() and normalized_home not in away.lower():
                continue
            if normalized_away not in home.lower() and normalized_away not in away.lower():
                continue

            score = match.get("score", {})
            full_time = score.get("ft") or []
            if len(full_time) < 2:
                continue

            rows.append(
                {
                    "date": match.get("date"),
                    "competition": data.get("name", self.league),
                    "home_team": home,
                    "away_team": away,
                    "home_score": full_time[0],
                    "away_score": full_time[1],
                    "status": "FT",
                }
            )

        if not rows:
            return pd.DataFrame()

        df = pd.DataFrame(rows)
        df["home_score"] = pd.to_numeric(df["home_score"], errors="coerce")
        df["away_score"] = pd.to_numeric(df["away_score"], errors="coerce")
        df = df.dropna(subset=["home_score", "away_score"])
        return df


def _serialize_for_cache(data: Dict[str, Any]) -> Dict[str, Any]:
    """Convert complex objects into cache-friendly structures."""

    def _clean(value: Any) -> Any:
        if isinstance(value, pd.DataFrame):
            return value.to_dict(orient="records")
        if isinstance(value, dict):
            return {key: _clean(val) for key, val in value.items()}
        if isinstance(value, (list, tuple, set)):
            return [_clean(item) for item in value]
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, np.generic):
            return value.item()
        if isinstance(value, np.ndarray):
            return value.tolist()
        if isinstance(value, (str, int, float, bool)) or value is None:
            return value
        return str(value)

    return {key: _clean(value) for key, value in data.items()}


def _deserialize_from_cache(data: Dict[str, Any]) -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    for key, value in data.items():
        if key in {"historical_stats", "head_to_head"} and isinstance(value, list):
            result[key] = pd.DataFrame(value)
        elif key == "injuries" and isinstance(value, list):
            result[key] = pd.DataFrame(value)
        else:
            result[key] = value
    return result


# ============================================================================
# Enhanced Data Aggregator with New Scrapers
# ============================================================================

class EnhancedDataAggregator:
    """
    Enhanced aggregator using new scraper infrastructure.
    
    Combines data from:
    - football-data.co.uk (historical matches with Pinnacle odds)
    - Betfair (exchange odds with back/lay spreads)
    - Soccerway (standings, fixtures, recent form)
    - Understat (xG statistics)
    - Transfermarkt (market values)
    - OddsPortal (historical closing lines)
    - Flashscore (live scores, H2H)
    """
    
    def __init__(self):
        """Initialize all enhanced scrapers."""
        self.football_data = FootballDataEnhancedScraper()
        self.betfair = BetfairExchangeScraper()
        self.soccerway = SoccerwayScraper()
        self.understat = UnderstatScraper()
        
        # Also keep references to old scrapers for compatibility
        self.flashscore = FlashscoreScraper()
        self.oddsportal = OddsPortalScraper()
        self.transfermarkt = TransfermarktScraper()
        
        logger.info("EnhancedDataAggregator initialized")
    
    def get_comprehensive_features(
        self,
        home_team: str,
        away_team: str,
        league: str = "EPL"
    ) -> Dict[str, Any]:
        """
        Get comprehensive feature set for ML prediction.
        
        Aggregates features from all sources with proper prefixing
        to avoid name collisions.
        
        Args:
            home_team: Home team name
            away_team: Away team name  
            league: League identifier
            
        Returns:
            Dict with all aggregated features
        """
        features = {
            "home_team": home_team,
            "away_team": away_team,
            "league": league,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        # Collect features from each source
        features.update(self._get_odds_features(home_team, away_team, league))
        features.update(self._get_form_features(home_team, away_team, league))
        features.update(self._get_position_features(home_team, away_team, league))
        features.update(self._get_xg_features(home_team, away_team, league))
        features.update(self._get_value_features(home_team, away_team, league))
        
        return features
    
    def _get_odds_features(
        self,
        home_team: str,
        away_team: str,
        league: str
    ) -> Dict[str, float]:
        """Get odds from Betfair exchange."""
        features = {}
        try:
            betfair_data = self.betfair.calculate_exchange_features(
                home_team, away_team, league
            )
            for k, v in betfair_data.items():
                features[f"bf_{k}"] = v
        except Exception as e:
            logger.warning(f"Betfair odds error: {e}")
        return features
    
    def _get_form_features(
        self,
        home_team: str,
        away_team: str,
        league: str
    ) -> Dict[str, float]:
        """Build recent form metrics from Soccerway and Understat."""
        features = {}
        try:
            form_snapshot = self._build_form_snapshot(home_team, away_team, league)
            features.update(form_snapshot)
        except Exception as e:
            logger.warning(f"Form snapshot error: {e}")
        return features
    
    def _get_position_features(
        self,
        home_team: str,
        away_team: str,
        league: str
    ) -> Dict[str, float]:
        """Get standings from Soccerway."""
        features = {}
        try:
            sw_data = self.soccerway.calculate_position_features(
                home_team, away_team, league
            )
            for k, v in sw_data.items():
                features[f"sw_{k}"] = v
        except Exception as e:
            logger.warning(f"Soccerway position error: {e}")
        return features
    
    def _get_xg_features(
        self,
        home_team: str,
        away_team: str,
        league: str
    ) -> Dict[str, float]:
        """Get xG from Understat."""
        features = {}
        try:
            us_data = self.understat.calculate_xg_features(
                home_team, away_team, league
            )
            for k, v in us_data.items():
                features[f"us_{k}"] = v
        except Exception as e:
            logger.warning(f"Understat xG error: {e}")
        return features
    
    def _get_value_features(
        self,
        home_team: str,
        away_team: str,
        league: str
    ) -> Dict[str, float]:
        """Get market values from Transfermarkt."""
        features = {}
        try:
            tm_data = self.transfermarkt.calculate_value_features(home_team, away_team, league)
            for k, v in tm_data.items():
                features[f"tm_{k}"] = v
        except Exception as e:
            logger.warning(f"Transfermarkt value error: {e}")
        return features

    def _build_form_snapshot(
        self,
        home_team: str,
        away_team: str,
        league: str
    ) -> Dict[str, float]:
        """Compose numeric form metrics for both clubs."""
        try:
            results_payload = self.soccerway.get_results(league) or {}
            all_results = results_payload.get("results", [])
        except Exception as exc:
            logger.warning(f"Soccerway form fetch error: {exc}")
            all_results = []

        snapshot: Dict[str, float] = {}
        for label, team in (("home", home_team), ("away", away_team)):
            team_form = self._extract_team_form(team, all_results)
            team_form.update(self._extract_understat_form(team, league))
            for key, value in team_form.items():
                snapshot[f"form_{label}_{key}"] = value
        return snapshot

    def _extract_team_form(
        self,
        team: str,
        all_results: List[Dict[str, Any]]
    ) -> Dict[str, float]:
        """Summarize last five results for a given team."""
        normalized_team = team.lower()
        relevant_matches = [
            match for match in all_results
            if normalized_team in match.get("home_team", "").lower()
            or normalized_team in match.get("away_team", "").lower()
        ]

        recent_matches = sorted(
            relevant_matches,
            key=lambda m: m.get("date", ""),
            reverse=True,
        )[:5]

        if not recent_matches:
            return {
                "matches_sampled": 0.0,
                "points_last5": 0.0,
                "wins_last5": 0.0,
                "draws_last5": 0.0,
                "losses_last5": 0.0,
                "avg_goals_for": 0.0,
                "avg_goals_against": 0.0,
                "goal_diff_last5": 0.0,
                "clean_sheets_last5": 0.0,
                "points_per_match": 0.0,
                "win_rate_last5": 0.0,
            }

        wins = draws = losses = points = 0
        goals_for = goals_against = clean_sheets = 0

        def _safe_int(value: Any) -> int:
            try:
                if value is None:
                    return 0
                if isinstance(value, (int, float)):
                    return int(value)
                return int(float(value))
            except (TypeError, ValueError):
                return 0

        for match in recent_matches:
            home_name = match.get("home_team", "")
            away_name = match.get("away_team", "")
            is_home = normalized_team in home_name.lower()
            team_goals = _safe_int(match.get("home_goals")) if is_home else _safe_int(match.get("away_goals"))
            opp_goals = _safe_int(match.get("away_goals")) if is_home else _safe_int(match.get("home_goals"))

            goals_for += team_goals
            goals_against += opp_goals
            if team_goals > opp_goals:
                wins += 1
                points += 3
            elif team_goals == opp_goals:
                draws += 1
                points += 1
            else:
                losses += 1
            if opp_goals == 0:
                clean_sheets += 1

        sample_size = len(recent_matches)
        return {
            "matches_sampled": float(sample_size),
            "points_last5": float(points),
            "wins_last5": float(wins),
            "draws_last5": float(draws),
            "losses_last5": float(losses),
            "avg_goals_for": round(goals_for / sample_size, 2),
            "avg_goals_against": round(goals_against / sample_size, 2),
            "goal_diff_last5": float(goals_for - goals_against),
            "clean_sheets_last5": float(clean_sheets),
            "points_per_match": round(points / sample_size, 2),
            "win_rate_last5": round(wins / sample_size, 2),
        }

    def _extract_understat_form(self, team: str, league: str) -> Dict[str, float]:
        """Merge Understat xG trend information into form metrics."""
        try:
            xg_payload = self.understat.get_team_xg(team, league)
        except Exception as exc:
            logger.warning(f"Understat form fetch error: {exc}")
            xg_payload = None

        if not xg_payload:
            return {
                "xg_recent_avg": 0.0,
                "xga_recent_avg": 0.0,
                "xg_trend_score": 0.0,
                "xga_trend_score": 0.0,
            }

        recent = xg_payload.get("recent_form", {})
        return {
            "xg_recent_avg": float(recent.get("last_5_xg_avg", 0.0)),
            "xga_recent_avg": float(recent.get("last_5_xga_avg", 0.0)),
            "xg_trend_score": float(self._trend_to_score(recent.get("xg_trend"))),
            "xga_trend_score": float(self._trend_to_score(recent.get("xga_trend"))),
        }

    @staticmethod
    def _trend_to_score(trend: Optional[str]) -> int:
        """Map qualitative trend labels to numeric scores."""
        mapping = {
            "improving": 1,
            "declining": -1,
            "stable": 0,
            "insufficient_data": 0,
            None: 0,
        }
        return mapping.get(trend, 0)

    # ------------------------------------------------------------------
    # Parallel feature gathering
    # ------------------------------------------------------------------

    def get_comprehensive_features_parallel(
        self,
        home_team: str,
        away_team: str,
        league: str = "EPL",
    ) -> Dict[str, Any]:
        """
        Gather all feature sources in parallel using ThreadPoolExecutor.

        Falls back gracefully if any single source times out or fails.
        """
        features: Dict[str, Any] = {
            "home_team": home_team,
            "away_team": away_team,
            "league": league,
            "timestamp": datetime.utcnow().isoformat(),
        }

        tasks: List[Callable[[], Dict[str, float]]] = [
            lambda: self._get_odds_features(home_team, away_team, league),
            lambda: self._get_form_features(home_team, away_team, league),
            lambda: self._get_position_features(home_team, away_team, league),
            lambda: self._get_xg_features(home_team, away_team, league),
            lambda: self._get_value_features(home_team, away_team, league),
        ]

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(task) for task in tasks]
            for future in concurrent.futures.as_completed(futures, timeout=20):
                try:
                    result = future.result(timeout=10)
                    features.update(result)
                except Exception as exc:
                    logger.warning(f"Parallel feature fetch failed: {exc}")

        return features

    async def get_comprehensive_features_async(
        self,
        home_team: str,
        away_team: str,
        league: str = "EPL",
    ) -> Dict[str, Any]:
        """
        Async version that runs scraper calls concurrently.

        Usage:
            features = await aggregator.get_comprehensive_features_async(...)
        """
        features: Dict[str, Any] = {
            "home_team": home_team,
            "away_team": away_team,
            "league": league,
            "timestamp": datetime.utcnow().isoformat(),
        }

        loop = asyncio.get_running_loop()

        async def _run_in_thread(func: Callable[[], Dict[str, float]]) -> Dict[str, float]:
            return await loop.run_in_executor(None, func)

        results = await asyncio.gather(
            _run_in_thread(lambda: self._get_odds_features(home_team, away_team, league)),
            _run_in_thread(lambda: self._get_form_features(home_team, away_team, league)),
            _run_in_thread(lambda: self._get_position_features(home_team, away_team, league)),
            _run_in_thread(lambda: self._get_xg_features(home_team, away_team, league)),
            _run_in_thread(lambda: self._get_value_features(home_team, away_team, league)),
            return_exceptions=True,
        )

        for res in results:
            if isinstance(res, dict):
                features.update(res)
            elif isinstance(res, Exception):
                logger.warning(f"Async feature fetch error: {res}")

        return features

    def get_historical_training_data(
        self,
        league: str = "EPL",
        seasons: list = None
    ) -> pd.DataFrame:
        """
        Get historical data for model training.
        
        Uses football-data.co.uk CSVs with Pinnacle odds.
        """
        if seasons is None:
            seasons = ["2324", "2223", "2122", "2021", "1920"]
        
        try:
            data = self.football_data.get_historical_odds(league, seasons)
            if data:
                return pd.DataFrame(data)
        except Exception as e:
            logger.error(f"Error fetching training data: {e}")
        
        return pd.DataFrame()


# Singleton instance
_enhanced_aggregator: Optional[EnhancedDataAggregator] = None


def get_enhanced_aggregator() -> EnhancedDataAggregator:
    """Get singleton EnhancedDataAggregator instance."""
    global _enhanced_aggregator
    if _enhanced_aggregator is None:
        _enhanced_aggregator = EnhancedDataAggregator()
    return _enhanced_aggregator


def get_match_features(
    home_team: str,
    away_team: str,
    league: str = "EPL"
) -> Dict[str, Any]:
    """
    Convenience function to get comprehensive match features.
    
    Args:
        home_team: Home team name
        away_team: Away team name
        league: League identifier
        
    Returns:
        Dict with aggregated features from all sources
    """
    return get_enhanced_aggregator().get_comprehensive_features(
        home_team, away_team, league
    )
