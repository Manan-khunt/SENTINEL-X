"""Request-ID tracing helpers (contextvars, no cross-request leakage)."""

from __future__ import annotations

import re
import uuid
from contextvars import ContextVar

HEADER = "X-Request-ID"

# Client-provided IDs are only echoed when they look safe: 8-64 chars,
# alphanumerics plus dash/underscore/dot. Anything else is replaced.
_SAFE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9\-_.]{7,63}$")

_request_id_var: ContextVar[str] = ContextVar("sentinelx_request_id", default="-")


def get_request_id() -> str:
    return _request_id_var.get()


def set_request_id(value: str) -> None:
    _request_id_var.set(value)


def new_request_id() -> str:
    return uuid.uuid4().hex[:16]


def coerce_request_id(candidate: str | None) -> str:
    """Return a safe request ID: echo valid client IDs, else generate one."""
    if candidate and _SAFE_ID.match(candidate.strip()):
        return candidate.strip()
    return new_request_id()
