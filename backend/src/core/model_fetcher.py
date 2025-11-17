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

try:
    import boto3
    _HAS_BOTO3 = True
except Exception:
    _HAS_BOTO3 = False

logger = logging.getLogger(__name__)

# Environment flags for model fetching behavior
SKIP_S3 = os.getenv('SKIP_S3', 'false').lower() in ('true', '1', 'yes')
MODEL_FETCH_STRICT = os.getenv('MODEL_FETCH_STRICT', 'false').lower() in ('true', '1', 'yes')

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
    valid_models = []
    for fname in existing:
        path = os.path.join(models_dir, fname)
        try:
            size = os.path.getsize(path)
            if size >= 10_240:  # At least 10KB
                valid_models.append(fname)
        except Exception:
            continue

    if valid_models:
        logger.info(f"Found {len(valid_models)} valid local model(s): {', '.join(valid_models)}")
        logger.info("Model artifacts loaded successfully from local storage")
        return True

    if SKIP_S3:
        logger.warning("SKIP_S3=true: Model fetching disabled, no valid local models found")
        return not MODEL_FETCH_STRICT

    if not model_base_url:
        logger.warning("No MODEL_BASE_URL set and no valid models present")
        if MODEL_FETCH_STRICT:
            logger.error("MODEL_FETCH_STRICT=true: Failing due to missing models")
            return False
        logger.info("MODEL_FETCH_STRICT=false: Continuing without remote fetch")
        return True

    # Support s3:// URIs or https:// endpoints
    if not (model_base_url.startswith('https://') or model_base_url.startswith('s3://')):
        logger.error("MODEL_BASE_URL must use https:// or s3://")
        return False

    headers = {}
    if fetch_token:
        headers['Authorization'] = f"Bearer {fetch_token}"

    logger.info(f"Fetching model artifacts from {model_base_url} into {dest_root}")

    for rel in ARTIFACTS:
        dest = os.path.join(dest_root, rel)
        os.makedirs(os.path.dirname(dest), exist_ok=True)

        # If model_base_url is an S3 URI, prefer using boto3
        if model_base_url.startswith('s3://'):
            if not _HAS_BOTO3:
                logger.error("MODEL_BASE_URL is s3:// but boto3 is not installed")
                return False

            # parse s3://bucket/path_prefix
            _, _, bucket_and_prefix = model_base_url.partition('s3://')
            bucket_and_prefix = bucket_and_prefix.rstrip('/')
            # bucket_and_prefix may be bucket or bucket/prefix
            parts = bucket_and_prefix.split('/', 1)
            bucket = parts[0]
            prefix = parts[1] if len(parts) > 1 else ''
            key = f"{prefix}/{rel}" if prefix else rel
            key = key.lstrip('/')
            logger.info(f"Downloading s3://{bucket}/{key} -> {dest}")
            try:
                s3 = boto3.client('s3')
                # use streaming download
                with open(dest, 'wb') as fh:
                    s3.download_fileobj(bucket, key, fh)
            except Exception as e:
                logger.error(f"Failed to download S3 artifact s3://{bucket}/{key}: {e}")
                return False

        else:
            url = urljoin(model_base_url.rstrip('/') + '/', rel)
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
