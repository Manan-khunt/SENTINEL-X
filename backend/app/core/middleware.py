"""Request tracing + access-log middleware (adds X-Request-ID)."""

from __future__ import annotations

import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.logging_config import get_logger
from app.core.request_id import HEADER, coerce_request_id, set_request_id

log = get_logger("sentinelx.http")


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Assign/validate request IDs, echo them, and emit one access log line."""

    async def dispatch(self, request: Request, call_next):
        incoming = request.headers.get(HEADER) or request.headers.get("X-Correlation-ID")
        rid = coerce_request_id(incoming)
        set_request_id(rid)
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            log.exception(
                "request failed",
                extra={"method": request.method, "route": request.url.path, "status": 500},
            )
            raise
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        response.headers[HEADER] = rid
        # One concise line per request — not per event.
        if request.url.path not in ("/openapi.json",):
            log.info(
                "%s %s -> %s (%.2fms)",
                request.method,
                request.url.path,
                getattr(response, "status_code", "?"),
                duration_ms,
                extra={
                    "method": request.method,
                    "route": request.url.path,
                    "status": getattr(response, "status_code", 0),
                    "duration_ms": duration_ms,
                },
            )
        return response
