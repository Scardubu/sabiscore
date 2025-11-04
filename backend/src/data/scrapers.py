import json
import logging
import random
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Tuple
from urllib.parse import quote_plus

import pandas as pd
import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from requests.exceptions import SSLError

from ..core.config import settings


logger = logging.getLogger(__name__)


def _create_retry_session() -> requests.Session:
    session = requests.Session()
    retry_strategy = Retry(
        total=3,
        backoff_factor=0.5,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    session.headers.update({"User-Agent": settings.user_agent})
    return session


class BaseScraper:
    """Base scraper with retry, rate limiting, and polite headers."""

    def __init__(self) -> None:
        self.session = _create_retry_session()
        self.base_delay = settings.rate_limit_delay
        self.last_scrape_at: Optional[datetime] = None
        self._default_verify = settings.scraper_ssl_verify

    def _throttle(self, attempt: int = 0) -> None:
        jitter = random.uniform(0, 0.3 * self.base_delay)
        delay = self.base_delay * (2 ** attempt) + jitter
        logger.debug("Throttling for %.2fs", delay)
        time.sleep(delay)

    def _make_request(self, url: str, retries: int = 3) -> Optional[requests.Response]:
        last_exception: Optional[Exception] = None
        verify: bool | str = self._default_verify
        for attempt in range(retries):
            try:
                response = self.session.get(
                    url,
                    timeout=settings.request_timeout,
                    verify=verify,
                )
                if response.status_code >= 500:
                    raise requests.HTTPError(f"Server error {response.status_code}")
                response.raise_for_status()
                self.last_scrape_at = datetime.utcnow()
                return response
            except SSLError as exc:
                last_exception = exc
                if settings.scraper_allow_insecure_fallback and verify:
                    logger.warning(
                        "SSL verification failed for %s (%s/%s). Retrying without verification.",
                        url,
                        attempt + 1,
                        retries,
                    )
                    verify = False
                    self._throttle(attempt)
                    continue
                logger.warning(
                    "SSL failure for %s (%s/%s): %s",
                    url,
                    attempt + 1,
                    retries,
                    exc,
                )
            except Exception as exc:
                last_exception = exc
                logger.warning(
                    "Request to %s failed (%s/%s): %s",
                    url,
                    attempt + 1,
                    retries,
                    exc,
                )
                self._throttle(attempt)
        logger.error("All retries failed for %s: %s", url, last_exception)
        return None

    def _parse_table_to_df(self, soup: BeautifulSoup, table_selector: str) -> pd.DataFrame:
        table = soup.select_one(table_selector)
        if not table:
            return pd.DataFrame()

        headers = [th.get_text(strip=True) for th in table.select("thead th")]
        rows = []
        for tr in table.select("tbody tr"):
            cells = [td.get_text(strip=True) for td in tr.find_all("td")]
            if cells:
                rows.append(cells)

        return pd.DataFrame(rows, columns=headers or None)


def _slugify_team(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or name.lower().replace(" ", "-")


def _normalize_team_name(name: str) -> str:
    normalized = re.sub(r"[^a-z0-9]", "", name.lower())
    for suffix in ("fc", "cf", "sc", "club", "ac", "afc"):
        normalized = normalized.replace(suffix, "")
    return normalized


def _extract_ft_score(match: Dict[str, any]) -> Optional[Tuple[int, int]]:
    score_block = match.get("score") or {}
    full_time = score_block.get("ft")
    if isinstance(full_time, (list, tuple)) and len(full_time) >= 2:
        try:
            return int(full_time[0]), int(full_time[1])
        except (TypeError, ValueError):
            return None
    return None


class FlashscoreScraper(BaseScraper):
    BASE_URL = "https://www.flashscore.com"
    _team_path_cache: Dict[str, str] = {}

    def _load_fallback_data(self, team: str, league: str) -> pd.DataFrame:
        """Load historical match data from processed JSON files as fallback."""
        try:
            league_map = {
                "EPL": "epl_matches.json",
                "La Liga": "la_liga_matches.json",
                "Serie A": "serie_a_matches.json",
                "Bundesliga": "bundesliga_matches.json",
                "Ligue 1": "ligue_1_matches.json",
            }
            filename = league_map.get(league)
            if not filename:
                return pd.DataFrame()

            file_path = settings.data_path / filename
            if not file_path.exists():
                return pd.DataFrame()

            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            matches = data.get("matches", [])
            df_data = []
            target_normalized = _normalize_team_name(team)

            for match in matches:
                teams = (match.get("team1", ""), match.get("team2", ""))
                normalized = [_normalize_team_name(t) for t in teams]
                if target_normalized not in normalized:
                    continue

                score = _extract_ft_score(match)
                if score is None:
                    continue

                df_data.append(
                    {
                        "date": match.get("date"),
                        "competition": data.get("name", league),
                        "home_team": teams[0],
                        "away_team": teams[1],
                        "home_score": score[0],
                        "away_score": score[1],
                        "status": "FT",
                    }
                )

            df = pd.DataFrame(df_data)
            if not df.empty:
                df["home_score"] = pd.to_numeric(df["home_score"], errors="coerce")
                df["away_score"] = pd.to_numeric(df["away_score"], errors="coerce")
                df = df.dropna(subset=["home_score", "away_score"])
                logger.info("Loaded %d fallback matches for %s from %s", len(df), team, filename)
            return df

        except Exception as e:
            logger.warning("Failed to load fallback data for %s: %s", team, e)
            return pd.DataFrame()

    def _resolve_team_path(self, team: str, league: str) -> Optional[str]:
        key = (league or "").lower() + ":" + _normalize_team_name(team)
        if key in self._team_path_cache:
            return self._team_path_cache[key]

        search_url = f"{self.BASE_URL}/search/?q={quote_plus(team)}"
        response = self._make_request(search_url)
        if response is None:
            logger.warning("Unable to resolve Flashscore path for %s", team)
            return None

        soup = BeautifulSoup(response.text, "lxml")
        slug = _slugify_team(team)
        for anchor in soup.select("a"):
            href = anchor.get("href") or ""
            if "/team/" not in href or slug not in href:
                continue

            normalized_text = _normalize_team_name(anchor.get_text(strip=True))
            if normalized_text != _normalize_team_name(team):
                continue

            parts = href.strip("/").split("/")
            if len(parts) >= 3 and parts[0] == "team":
                base_path = "/".join(parts[:3])
                self._team_path_cache[key] = base_path
                return base_path

        logger.warning("Flashscore search did not yield a valid team path for %s", team)
        return None

    def scrape_match_results(self, team: str, league: str) -> pd.DataFrame:
        logger.info("Scraping Flashscore results for %s (%s)", team, league)
        path = self._resolve_team_path(team, league)
        if not path:
            logger.warning("Falling back to local data for %s due to unresolved path", team)
            return self._load_fallback_data(team, league)

        url = f"{self.BASE_URL}/{path}/results"
        response = self._make_request(url)
        if response is None:
            logger.warning("Scraping failed for %s, using fallback data", team)
            return self._load_fallback_data(team, league)

        soup = BeautifulSoup(response.text, "lxml")
        table = self._parse_table_to_df(soup, "table.wld")
        if table.empty:
            logger.warning("No data scraped for %s, using fallback data", team)
            return self._load_fallback_data(team, league)

        table.columns = [
            "date",
            "competition",
            "home_team",
            "away_team",
            "score",
            "status",
        ][: len(table.columns)]

        score_split = table["score"].str.extract(r"(?P<home_score>\d+)\s*:\s*(?P<away_score>\d+)")
        table = pd.concat([table, score_split], axis=1)
        table["home_score"] = pd.to_numeric(table["home_score"], errors="coerce")
        table["away_score"] = pd.to_numeric(table["away_score"], errors="coerce")

        result = table.dropna(subset=["home_score", "away_score"])
        if result.empty:
            logger.warning("No valid scores scraped for %s, using fallback data", team)
            return self._load_fallback_data(team, league)

        return result


class OddsPortalScraper(BaseScraper):
    BASE_URL = "https://www.oddsportal.com"

    def scrape_odds(self, home_team: str, away_team: str) -> Dict[str, float]:
        logger.info("Scraping odds for %s vs %s", home_team, away_team)
        url = f"{self.BASE_URL}/match/{_slugify_team(home_team)}-{_slugify_team(away_team)}/#1X2;2"
        response = self._make_request(url)
        if response is None:
            logger.warning("Odds scraping failed for %s vs %s, using mock odds", home_team, away_team)
            return self._mock_odds()

        soup = BeautifulSoup(response.text, "lxml")
        odds_table = soup.select_one("table.table-main")
        if not odds_table:
            logger.warning("No odds table found for %s vs %s, using mock odds", home_team, away_team)
            return self._mock_odds()

        odds_cells = odds_table.select("tbody tr:first-child td.odds")
        if len(odds_cells) < 3:
            logger.warning("Insufficient odds data for %s vs %s, using mock odds", home_team, away_team)
            return self._mock_odds()

        try:
            home, draw, away = [float(cell.get_text(strip=True)) for cell in odds_cells[:3]]
        except ValueError:
            logger.warning("Failed to parse odds for %s vs %s, using mock odds", home_team, away_team)
            return self._mock_odds()

        return {
            "home_win": home,
            "draw": draw,
            "away_win": away,
        }

    def _mock_odds(self) -> Dict[str, float]:
        """Return mock odds for demonstration purposes."""
        return {
            "home_win": 2.1,
            "draw": 3.4,
            "away_win": 3.8,
        }


class TransfermarktScraper(BaseScraper):
    BASE_URL = "https://www.transfermarkt.com"
    _team_id_cache: Dict[str, str] = {}

    def _resolve_team_id(self, team: str) -> Optional[str]:
        normalized_name = _normalize_team_name(team)
        if normalized_name in self._team_id_cache:
            return self._team_id_cache[normalized_name]

        search_url = f"{self.BASE_URL}/schnellsuche/ergebnis/schnellsuche?query={quote_plus(team)}"
        response = self._make_request(search_url)
        if response is None:
            logger.warning("Unable to resolve Transfermarkt ID for %s", team)
            return None

        soup = BeautifulSoup(response.text, "lxml")
        for anchor in soup.select("a"):
            href = anchor.get("href") or ""
            if "/verein/" not in href:
                continue

            text_normalized = _normalize_team_name(anchor.get_text(strip=True))
            if text_normalized != normalized_name:
                continue

            match = re.search(r"/verein/(\d+)", href)
            if match:
                team_id = match.group(1)
                self._team_id_cache[normalized_name] = team_id
                return team_id

        logger.warning("Transfermarkt search did not return a team id for %s", team)
        return None

    def scrape_injuries(self, team: str) -> pd.DataFrame:
        logger.info("Scraping Transfermarkt injuries for %s", team)
        team_id = self._resolve_team_id(team)
        if not team_id:
            return pd.DataFrame(columns=["player", "injury", "expected_return", "status"])

        url = f"{self.BASE_URL}/{_slugify_team(team)}/verletzte/verein/{team_id}"
        response = self._make_request(url)
        if response is None:
            return pd.DataFrame(columns=["player", "injury", "expected_return", "status"])

        soup = BeautifulSoup(response.text, "lxml")
        table = self._parse_table_to_df(soup, "table.items")
        if table.empty:
            return pd.DataFrame(columns=["player", "injury", "expected_return", "status"])

        table.columns = [
            "player",
            "injury",
            "since",
            "expected_return",
            "status",
        ][: len(table.columns)]

        return table[[col for col in table.columns if col in {"player", "injury", "expected_return", "status"}]]

    def scrape_player_values(self, team: str) -> pd.DataFrame:
        logger.info("Scraping Transfermarkt values for %s", team)
        team_id = self._resolve_team_id(team)
        if not team_id:
            return pd.DataFrame(columns=["name", "position", "value", "age"])

        url = f"{self.BASE_URL}/{_slugify_team(team)}/kader/verein/{team_id}"
        response = self._make_request(url)
        if response is None:
            return pd.DataFrame(columns=["name", "position", "value", "age"])

        soup = BeautifulSoup(response.text, "lxml")
        table = self._parse_table_to_df(soup, "table.items")
        if table.empty:
            return pd.DataFrame(columns=["name", "position", "value", "age"])

        table.columns = [
            "number",
            "name",
            "position",
            "age",
            "nationality",
            "market_value",
        ][: len(table.columns)]

        clean = pd.DataFrame()
        clean["name"] = table.get("name")
        clean["position"] = table.get("position")
        clean["age"] = pd.to_numeric(table.get("age"), errors="coerce")
        clean["value"] = table.get("market_value")

        return clean.dropna(subset=["name"])


# Convenience functions ------------------------------------------------
def scrape_flashscore(team: str, league: str) -> pd.DataFrame:
    return FlashscoreScraper().scrape_match_results(team, league)


def scrape_oddsportal(home_team: str, away_team: str) -> Dict[str, float]:
    return OddsPortalScraper().scrape_odds(home_team, away_team)


def scrape_transfermarkt_injuries(team: str) -> pd.DataFrame:
    return TransfermarktScraper().scrape_injuries(team)
