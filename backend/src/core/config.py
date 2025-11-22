from pathlib import Path
from typing import List, Optional, Any
import json
import os
from dotenv import load_dotenv

# Load environment variables manually to ensure os.environ is populated
# for fields we handle manually (like ALLOWED_HOSTS)
load_dotenv()

from pydantic import Field, ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_SECRET = "change-me-in-production"


class Settings(BaseSettings):
    """Centralised application settings with environment-aware validation."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    database_url: str = Field(
        default="sqlite:///./sabiscore.db",
        alias="DATABASE_URL",
        description="SQLAlchemy-compatible database URL.",
    )
    database_pool_size: int = Field(default=20, ge=1, le=100)
    database_max_overflow: int = Field(default=30, ge=0, le=100)
    database_pool_timeout: int = Field(default=30, ge=1)
    database_pool_recycle: int = Field(default=3600, ge=60)

    # Redis Cache
    # NOTE: In production, REDIS_URL should be provided via environment variable
    # and must NOT be hard-coded with credentials.
    redis_url: str = Field(
        default="redis://localhost:6379",
        alias="REDIS_URL",
        description="Redis connection URL.",
    )
    redis_cache_ttl: int = Field(default=3600, ge=60)
    redis_max_connections: int = Field(default=50, ge=1, le=200)
    redis_enabled: bool = Field(default=True, alias="REDIS_ENABLED")

    # Security
    secret_key: str = Field(default=_DEFAULT_SECRET, alias="SECRET_KEY")
    algorithm: str = Field(default="HS256")
    access_token_expire_minutes: int = Field(default=30, ge=5)
    enable_security_headers: bool = Field(default=True)
    # Accept env ALLOWED_HOSTS as CSV or JSON list string via a separate raw field to avoid
    # pydantic-settings pre-parsing JSON for complex types which would otherwise fail on CSV.
    # We intentionally remove the alias here and handle it in a pre-validator to bypass
    # pydantic-settings' aggressive JSON parsing logic.
    allowed_hosts_raw: Optional[str] = Field(
        default=None,
        description="Comma-separated or JSON list string of allowed hosts for TrustedHostMiddleware",
    )
    # NOTE: `allowed_hosts` is intentionally not declared as a settings field
    # so that pydantic-settings will not attempt to decode complex env values
    # into it. Use `ALLOWED_HOSTS` (mapped to `allowed_hosts_raw` manually) as the
    # single environment entry; the `allowed_hosts` value is computed at
    # runtime via the `allowed_hosts` property below.
    espn_api_key: Optional[str] = None
    opta_api_key: Optional[str] = None
    betfair_app_key: Optional[str] = None
    betfair_session_token: Optional[str] = None
    pinnacle_api_key: Optional[str] = None
    fivethirtyeight_api_key: Optional[str] = None
    
    # App metadata (backwards-compat with legacy settings access in main.py)
    project_name: str = Field(default="SabiScore API", alias="APP_NAME")
    version: str = Field(default="1.0.0", alias="VERSION")
    app_version: str = Field(default="1.0.0", alias="APP_VERSION")
    api_v1_str: str = Field(default="/api/v1", alias="API_V1_STR")
    
    # Next.js Integration
    next_url: str = Field(
        default="http://localhost:3000",
        alias="NEXT_URL",
        description="Next.js frontend URL for ISR revalidation"
    )
    revalidate_secret: str = Field(
        default="dev-secret-token",
        alias="REVALIDATE_SECRET", 
        description="Secret token for Next.js ISR revalidation API"
    )

    # Application
    app_env: str = Field(default="development", alias="APP_ENV")
    debug: bool = Field(default=True)
    log_level: str = Field(default="INFO")
    log_format: str = Field(default="json")
    enable_tracing: bool = Field(default=False)
    sentry_dsn: Optional[str] = Field(default=None, alias="SENTRY_DSN")
    enable_sota_stack: bool = Field(default=False, alias="ENABLE_SOTA_STACK")
    sota_time_limit: Optional[int] = Field(default=None, alias="SOTA_TIME_LIMIT")
    sota_presets: Optional[str] = Field(default=None, alias="SOTA_PRESETS")
    sota_hyperparameters: Optional[str] = Field(default=None, alias="SOTA_HYPERPARAMETERS")
    rate_limit_delay: float = Field(default=1.0, ge=0.1)
    rate_limit_requests: int = Field(default=60, ge=1)
    rate_limit_window_seconds: int = Field(default=60, ge=1)

    # Scraper networking
    scraper_ssl_verify: bool | str = Field(default=True, alias="SCRAPER_SSL_VERIFY")
    scraper_allow_insecure_fallback: bool = Field(
        default=True,
        alias="SCRAPER_ALLOW_INSECURE_FALLBACK",
        description="Allow retrying scraper requests without SSL verification after failures.",
    )

    # Performance & compression
    enable_gzip: bool = Field(default=True)
    enable_response_compression: bool = Field(default=True)

    # Scraping
    user_agent: str = Field(default="SabiScore/1.0 (+contact@sabiscore.com)")
    request_timeout: int = Field(default=10, ge=1)

    # CORS
    # Accept env CORS_ORIGINS as a simple CSV or JSON string without requiring JSON decoding at env source
    cors_origins_raw: Optional[str] = Field(
        default=None,
        alias="CORS_ORIGINS",
        description="Comma-separated or JSON list string of allowed CORS origins"
    )
    cors_allowed_origins: List[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3002",
            "http://localhost:5173",
        ]
    )

    # Paths
    models_path: Path = Field(default_factory=lambda: _PROJECT_ROOT / "models")
    data_path: Path = Field(default_factory=lambda: (_PROJECT_ROOT / "data" / "processed"))

    @model_validator(mode="before")
    @classmethod
    def _load_manual_fields(cls, data: Any) -> Any:
        """Manually load fields that cause parsing issues with pydantic-settings."""
        if isinstance(data, dict):
            # Manually load ALLOWED_HOSTS to avoid pydantic-settings JSON parsing issues
            if "allowed_hosts_raw" not in data:
                # Check os.environ directly (populated by load_dotenv or system)
                val = os.environ.get("ALLOWED_HOSTS")
                if val is not None:
                    data["allowed_hosts_raw"] = val
        return data

    def _parse_cors_raw(self) -> List[str]:
        """Parse CORS_ORIGINS from raw env value (CSV or JSON string)."""
        value = self.cors_origins_raw
        if value is None:
            return self.cors_allowed_origins
        s = value.strip()
        if s == "":
            return []
        # Try JSON first if it looks like a JSON array
        if s.startswith("[") and s.endswith("]"):
            try:
                parsed = json.loads(s)
                if isinstance(parsed, list):
                    return [str(o).strip() for o in parsed if str(o).strip()]
            except Exception:
                # Fall back to CSV parsing
                pass
        # CSV fallback
        return [origin.strip() for origin in s.split(",") if origin.strip()]

    def _parse_hosts_raw(self) -> List[str]:
        """Parse ALLOWED_HOSTS from raw env value (CSV or JSON list string)."""
        value = self.allowed_hosts_raw
        if value is None:
            return ["localhost", "127.0.0.1"]
        s = value.strip()
        if s == "":
            return []
        if s.startswith("[") and s.endswith("]"):
            try:
                parsed = json.loads(s)
                if isinstance(parsed, list):
                    return [str(h).strip() for h in parsed if str(h).strip()]
            except Exception:
                pass
        return [h.strip() for h in s.split(",") if h.strip()]

    @field_validator("models_path", "data_path", mode="before")
    @classmethod
    def _ensure_path(cls, value):
        if isinstance(value, (str, Path)):
            return Path(value)
        raise ValueError("Path fields must be str or Path instances")

    @model_validator(mode="after")
    def _validate_environment(self) -> "Settings":
        env = self.app_env.lower()
        if env not in {"development", "staging", "production"}:
            raise ValidationError(
                [
                    {
                        "loc": ("app_env",),
                        "msg": "app_env must be one of development, staging, production",
                        "type": "value_error",
                    }
                ],
                Settings,
            )

        if env == "production":
            if self.debug:
                raise ValidationError(
                    [
                        {
                            "loc": ("debug",),
                            "msg": "debug must be disabled in production",
                            "type": "value_error",
                        }
                    ],
                    Settings,
                )
            if self.secret_key == _DEFAULT_SECRET or len(self.secret_key) < 32:
                raise ValidationError(
                    [
                        {
                            "loc": ("secret_key",),
                            "msg": "SECRET_KEY must be provided and at least 32 characters in production",
                            "type": "value_error",
                        }
                    ],
                    Settings,
                )

            if not self.enable_security_headers:
                raise ValidationError(
                    [
                        {
                            "loc": ("enable_security_headers",),
                            "msg": "Security headers must remain enabled in production",
                            "type": "value_error",
                        }
                    ],
                    Settings,
                )

        return self

    def model_post_init(self, __context) -> None:  # type: ignore[override]
        """Ensure important directories exist after settings load."""
        self.models_path.mkdir(parents=True, exist_ok=True)
        self.data_path.mkdir(parents=True, exist_ok=True)
        # Normalize CORS origins from raw env once model is initialized
        self.cors_allowed_origins = [
            str(o).rstrip("/") for o in self._parse_cors_raw()
        ]
        # Note: allowed_hosts is computed dynamically via the property.

    # Backwards-compat properties expected by legacy code paths
    @property
    def PROJECT_NAME(self) -> str:
        return self.project_name

    @property
    def VERSION(self) -> str:
        return self.version

    @property
    def API_V1_STR(self) -> str:
        return self.api_v1_str

    @property
    def ENV(self) -> str:
        return self.app_env

    @property
    def cors_origins(self) -> List[str]:
        """Expose unified accessor used across the app."""
        return self.cors_allowed_origins

    @property
    def allowed_hosts(self) -> List[str]:
        """Expose parsed ALLOWED_HOSTS as a list. Supports CSV or JSON array.

        This is a computed property (not a settings field) to avoid pydantic
        attempting to parse complex values directly from environment sources.
        """
        hosts = self._parse_hosts_raw()
        return [str(h) for h in hosts]

    @property
    def redis_host(self) -> Optional[str]:
        """Extract redis host from redis_url for backwards compat."""
        if not self.redis_url:
            return None
        # Parse redis://host:port or redis://user:pass@host:port
        try:
            from urllib.parse import urlparse
            parsed = urlparse(self.redis_url)
            return parsed.hostname
        except Exception:
            return None


# Global settings instance
settings = Settings()
