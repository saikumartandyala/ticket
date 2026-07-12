import os
from typing import List, Optional
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "LastMinutePass"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = "supersecretkeythatshouldbechangedinproduction12345"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week (convenient for local dev testing)
    
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
    MSG91_TEMPLATE_ID: Optional[str] = None
    SENDGRID_API_KEY: Optional[str] = None
    EMAIL_FROM: str = "noreply@lastminutepass.in"
    
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000"]
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
