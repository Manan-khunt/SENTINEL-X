"""Structured application logging for SENTINEL-X.

- Human-readable console output in development.
- JSON lines when APP_ENV=production (machine processing).
- Every record carries ``request_id`` from :mod:`app.core.request_id`.
- Secrets (passwords, tokens, authorization headers, API keys) are redacted
  from ``extra`` payloads before logging.
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone

from app.core.request_id import get_request_id

_REDACT_KEYS = {
    "password",
    "passwd",
    "authorization",
    "access_token",
    "refresh_token",
    "jwt",
    "secret",
    "api_key",
    "anthropic_api_key",
    "token",
}

_configured = False


def _redact(obj):
    if isinstance(obj, dict):
        return {
            k: ("***REDACTED***" if k.lower() in _REDACT_KEYS else _redact(v))
            for k, v in obj.items()
        }
    if isinstance(obj, (list, tuple)):
        return [_redact(v) for v in obj]
    return obj


class _ContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id") or not record.request_id:  # type: ignore[attr-defined]
            try:
                record.request_id = get_request_id()
            except Exception:
                record.request_id = "-"
        return True


def _console_formatter() -> logging.Formatter:
    return logging.Formatter(
        "%(asctime)s | %(levelname)-7s | %(name)s | rid=%(request_id)s | %(message)s"
    )


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "severity": record.levelname,
            "logger": record.name,
            "request_id": getattr(record, "request_id", None) or get_request_id(),
            "message": record.getMessage(),
        }
        # Structured fields logged via logger.info(..., extra={...}).
        for key in (
            "method",
            "route",
            "status",
            "duration_ms",
            "incident_id",
            "scenario_id",
            "agent_step",
            "tool",
            "action_outcome",
        ):
            if hasattr(record, key):
                payload[key] = _redact(getattr(record, key))
        if record.exc_info and record.exc_info[0] is not None:
            payload["exc_type"] = record.exc_info[0].__name__
        return json.dumps(payload, default=str)


def configure_logging() -> None:
    """Idempotent root logging setup. Reads APP_ENV lazily (no import cycle)."""
    global _configured
    if _configured:
        return
    try:
        from app.config import get_settings

        env = get_settings().APP_ENV.lower()
    except Exception:
        env = "development"
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(_JsonFormatter() if env == "production" else _console_formatter())
    handler.addFilter(_ContextFilter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)
    # Quiet noisy third-party loggers; keep our request logs readable.
    for noisy in ("uvicorn.access",):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    _configured = True


def get_logger(name: str) -> logging.Logger:
    configure_logging()
    return logging.getLogger(name)
