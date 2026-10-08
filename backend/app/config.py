"""SENTINEL-X backend application settings (env-driven, no hardcoded secrets)."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "sqlite:///./sentinelx.db"
    JWT_SECRET: str = "dev-only-change-me-min-32-chars-1234"
    JWT_EXPIRY: int = 3600
    LLM_PROVIDER: str = "mock"  # mock | replay | anthropic
    LLM_MODEL: str = "mock-structured-v1"
    LLM_TEMPERATURE: float = 0
    ANTHROPIC_API_KEY: str = ""
    FRONTEND_ORIGIN: str = "http://localhost:3000"
    APP_ENV: str = "development"
    DEMO_MODE: bool = True
    SSE_TICKET_TTL: int = 120
    RATE_LIMIT_PER_INCIDENT: int = 10
    MAX_REPLANS: int = 10
    NO_PROGRESS_LIMIT: int = 3


@lru_cache
def get_settings() -> Settings:
    # Allow tests to override via env vars directly.
    return Settings()


VERSION = "3.0.0"
