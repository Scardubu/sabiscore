from pathlib import Path
from typing import List, Optional

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
    redis_url: str = Field(
        default="redis://default:ASfKAAIncDJmZjE2OGZjZDA3OTM0ZTY5YTRiNzZhNjMwMjM1YzZiZnAyMTAxODY@known-amoeba-10186.upstash.io:6379",
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
    allowed_hosts: List[str] = Field(default_factory=lambda: ["localhost", "127.0.0.1"])
    espn_api_key: Optional[str] = None
    opta_api_key: Optional[str] = None
    betfair_app_key: Optional[str] = None
    betfair_session_token: Optional[str] = None
    pinnacle_api_key: Optional[str] = None
    fivethirtyeight_api_key: Optional[str] = None
    
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
    cors_origins: List[str] = Field(
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

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors_origins(cls, value):
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("allowed_hosts", mode="before")
    @classmethod
    def _split_allowed_hosts(cls, value):
        if isinstance(value, str):
            return [host.strip() for host in value.split(",") if host.strip()]
        return value

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


# Global settings instance
settings = Settings()
