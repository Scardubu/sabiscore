import os
import time
import logging
from typing import List, Optional
from urllib.parse import urljoin

try:
    # Prefer requests if available for easier retries
    import requests
    _HAS_REQUESTS = True
except Exception:
    import urllib.request as _urllib
    _HAS_REQUESTS = False

logger = logging.getLogger(__name__)

# Keep in sync with scripts/fetch-models.sh
ARTIFACTS = [
    "models/epl_ensemble.pkl",
    "models/serie_a_ensemble.pkl",
    "models/ligue_1_ensemble.pkl",
    "models/la_liga_ensemble.pkl",
    "models/bundesliga_ensemble.pkl",
    "data/processed/epl_training.csv",
    "data/processed/serie_a_training.csv",
    "data/processed/ligue_1_training.csv",
    "data/processed/la_liga_training.csv",
    "data/processed/bundesliga_training.csv",
]


def _download_with_requests(url: str, dest: str, headers: dict, timeout: int = 10, retries: int = 3) -> None:
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(url, headers=headers, timeout=timeout, stream=True)
            resp.raise_for_status()
            with open(dest, 'wb') as fh:
                for chunk in resp.iter_content(chunk_size=8192):
                    if chunk:
                        fh.write(chunk)
            return
        except Exception as e:
            logger.warning(f"Download attempt {attempt} failed for {url}: {e}")
            if attempt < retries:
                time.sleep(2 ** attempt)
                continue
            raise


def _download_with_urllib(url: str, dest: str, headers: dict, timeout: int = 10) -> None:
    req = _urllib.Request(url)
    for k, v in headers.items():
        req.add_header(k, v)
    with _urllib.urlopen(req, timeout=timeout) as resp:
        with open(dest, 'wb') as fh:
            fh.write(resp.read())


def fetch_models_if_needed(model_base_url: Optional[str], dest_root: str, fetch_token: Optional[str] = None) -> bool:
    """Ensure model artifacts exist under dest_root/models. If missing and model_base_url is provided,
    attempt to download artifacts. Returns True if artifacts exist after this call, False otherwise.
    """
    models_dir = os.path.join(dest_root, 'models')
    os.makedirs(models_dir, exist_ok=True)

    # Check for existing .pkl files of reasonable size
    existing = [f for f in os.listdir(models_dir) if f.endswith('.pkl')]
    valid_found = False
    for fname in existing:
        path = os.path.join(models_dir, fname)
        try:
            if os.path.getsize(path) >= 10_240:
                valid_found = True
                break
        except Exception:
            continue

    if valid_found:
        logger.info("Valid model artifacts already present; skipping fetch")
        return True

    if not model_base_url:
        logger.warning("No MODEL_BASE_URL set and no valid models present")
        return False

    if not model_base_url.startswith('https://'):
        logger.error("MODEL_BASE_URL must use https://")
        return False

    headers = {}
    if fetch_token:
        headers['Authorization'] = f"Bearer {fetch_token}"

    logger.info(f"Fetching model artifacts from {model_base_url} into {dest_root}")

    for rel in ARTIFACTS:
        url = urljoin(model_base_url.rstrip('/') + '/', rel)
        dest = os.path.join(dest_root, rel)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        logger.info(f"Downloading {url} -> {dest}")
        try:
            if _HAS_REQUESTS:
                _download_with_requests(url, dest, headers)
            else:
                _download_with_urllib(url, dest, headers)
        except Exception as e:
            logger.error(f"Failed to download artifact {url}: {e}")
            return False

    logger.info("All artifacts downloaded (subject to validation).")
    return True
