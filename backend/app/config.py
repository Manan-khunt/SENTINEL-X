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
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    APP_ENV: str = "development"
    DEMO_MODE: bool = True
    SSE_TICKET_TTL: int = 120
    RATE_LIMIT_PER_INCIDENT: int = 10
    MAX_REPLANS: int = 10
    NO_PROGRESS_LIMIT: int = 3
    ANCHOR_PATH: str = "./audit_anchors.jsonl"
    AUDIT_ANCHOR_EVERY: int = 10


# Signing secrets that must never be used outside local development.
# The first is this module's dev default; the second is the .env.example
# placeholder. Both satisfy the length check on purpose, so production
# validation must reject them by value, not just by length.
KNOWN_DEFAULT_SECRETS = frozenset(
    {
        "dev-only-change-me-min-32-chars-1234",
        "change-me-in-production-min-32-chars",
    }
)


@lru_cache
def get_settings() -> Settings:
    # Allow tests to override via env vars directly.
    return Settings()


VERSION = "3.0.0"


def describe_settings_safe(s: Settings) -> dict:
    """Log-safe settings summary: names + shapes only, never secret values."""
    db = s.DATABASE_URL or ""
    dialect = db.split("://", 1)[0] if "://" in db else "unknown"
    return {
        "app_env": s.APP_ENV,
        "demo_mode": s.DEMO_MODE,
        "database_dialect": dialect,
        "jwt_expiry": s.JWT_EXPIRY,
        "jwt_secret_len": len(s.JWT_SECRET or ""),
        "llm_provider": s.LLM_PROVIDER,
        "llm_model": s.LLM_MODEL,
        "frontend_origin": s.FRONTEND_ORIGIN,
        "sse_ticket_ttl": s.SSE_TICKET_TTL,
    }


def validate_settings(s: Settings) -> None:
    """Fail fast with a clear message when required settings are missing/weak.

    Development mode keeps the documented demo convenient (default dev
    secret allowed). Production mode additionally requires an explicitly
    configured, non-default secret: length alone is not enough because the
    documented placeholders already satisfy it.
    """
    problems: list[str] = []
    if not s.JWT_SECRET or len(s.JWT_SECRET) < 32:
        problems.append("JWT_SECRET must be set to a string of at least 32 characters")
    if s.LLM_PROVIDER.lower() == "anthropic" and not s.ANTHROPIC_API_KEY:
        problems.append("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic")
    if s.APP_ENV.lower() == "production":
        if s.DEMO_MODE:
            problems.append("DEMO_MODE must be false when APP_ENV=production")
        if s.JWT_SECRET in KNOWN_DEFAULT_SECRETS:
            problems.append(
                "JWT_SECRET uses a known development default; "
                "set a unique secret via environment configuration"
            )
        elif s.JWT_SECRET == Settings.model_fields["JWT_SECRET"].default:
            problems.append(
                "JWT_SECRET must be supplied explicitly via environment configuration "
                "in production (no defaulted secret)"
            )
    if problems:
        raise RuntimeError("Invalid SENTINEL-X configuration: " + "; ".join(problems))
