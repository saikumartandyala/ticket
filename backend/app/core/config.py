import logging
import secrets
from typing import List, Literal, Optional
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_KEYS = {"", "supersecretkeythatshouldbechangedinproduction12345", "change-me"}

class Settings(BaseSettings):
    PROJECT_NAME: str = "TickOrbit"
    API_V1_STR: str = "/api/v1"

    # Comma-separated emails that are promoted to admin on startup.
    ADMIN_EMAILS: str = ""
    # Primary admin login, created/kept in sync on startup (see services/admin_bootstrap.py).
    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""
    ADMIN_NAME: str = "TickOrbit Admin"

    # Wall-clock timezone for user-entered dates/times (departures, events).
    APP_TIMEZONE: str = "Asia/Kolkata"
    # Terminal log verbosity: DEBUG, INFO, WARNING, ERROR.
    LOG_LEVEL: str = "INFO"
    
    # "production" turns on HSTS, hides /docs, refuses mock OTP delivery and
    # refuses to start without a real SECRET_KEY.
    ENVIRONMENT: Literal["development", "production"] = "development"

    # Security
    # Signs session tokens. Must be a long random value from .env, never the repo.
    SECRET_KEY: str = ""
    ALGORITHM: Literal["HS256"] = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week
    # Reject plain-HTTP API requests (checked against X-Forwarded-Proto behind a proxy).
    FORCE_HTTPS: bool = True
    # Only true behind a proxy that overwrites X-Forwarded-For / X-Forwarded-Proto
    # (Vercel, Render, nginx). Locally these headers could be spoofed.
    TRUST_PROXY_HEADERS: bool = False
    # Browser origins allowed to call the API with credentials (comma-separated, https only).
    FRONTEND_ORIGINS: str = "https://localhost:3000,https://127.0.0.1:3000"
    
    # DB Connections (Default fallback to local SQLite for easier local running/testing)
    DATABASE_URL: str = "sqlite+aiosqlite:///./lastminutepass.db"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    REDIS_URL: Optional[str] = None  # e.g., redis://localhost:6379/0
    
    # Search Engine
    MEILISEARCH_URL: Optional[str] = None
    MEILISEARCH_MASTER_KEY: Optional[str] = None
    
    # Third party integrations (optional, fallback to mock in local environment)
    S3_BUCKET_NAME: Optional[str] = None
    S3_REGION: Optional[str] = None
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    
    MSG91_API_KEY: Optional[str] = None
    MSG91_TEMPLATE_ID: Optional[str] = None  # SMS OTP template (not currently used - email only)

    # Brevo (formerly Sendinblue) transactional email API — used to send OTP
    # emails. Create an API key at https://app.brevo.com/settings/keys/api and
    # add a verified sender at https://app.brevo.com/senders (the BREVO_FROM_EMAIL
    # must be a verified sender or belong to a verified/authenticated domain,
    # otherwise Brevo rejects the send). Falls back to a console/file mock when
    # BREVO_API_KEY is unset, so local testing needs no credentials.
    BREVO_API_KEY: Optional[str] = None
    BREVO_FROM_EMAIL: str = "noreply@lastminutepass.in"
    EMAIL_FROM_NAME: str = "LastMinutePass"

    # Lookup APIs (autocomplete). The backend proxies these so the credentials
    # never reach the browser. Values come from .env.
    #  - GeoNames: city/town suggestions (free web service username).
    #  - RailRadar: railway station suggestions (bearer API key).
    GEONAMES_USERNAME: Optional[str] = None
    RAILRADAR_API_KEY: Optional[str] = None
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def frontend_origins(self) -> List[str]:
        return [o.strip().rstrip("/") for o in self.FRONTEND_ORIGINS.split(",") if o.strip()]

    @model_validator(mode="after")
    def _check_security(self) -> "Settings":
        if self.SECRET_KEY in _DEFAULT_KEYS or len(self.SECRET_KEY) < 32:
            if self.is_production:
                raise ValueError("SECRET_KEY must be set to a random value of 32+ characters in production")
            # Dev without a key: use a throwaway one so nothing forgeable ships by accident.
            self.SECRET_KEY = secrets.token_urlsafe(48)
            logging.getLogger("app.startup").warning(
                "SECRET_KEY is not set - using a temporary key; sessions end when the server restarts")
        bad = [o for o in self.frontend_origins if not o.startswith("https://")]
        if bad and self.is_production:
            raise ValueError(f"FRONTEND_ORIGINS must be https in production: {bad}")
        return self


settings = Settings()
