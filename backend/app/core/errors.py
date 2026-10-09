"""Consistent error responses.

Contract (frontend-compatible): every error body keeps FastAPI's
``detail`` string field (``src/api.ts`` reads ``data.detail``) and adds
machine-readable ``code`` plus the ``request_id`` for log correlation.
Bodies never contain stack traces, secrets, or tokens.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging_config import get_logger
from app.core.request_id import HEADER, get_request_id

log = get_logger("sentinelx.errors")


class ErrorResponse(BaseModel):
    detail: str = Field(examples=["not found"])
    code: str = Field(examples=["not_found"])
    request_id: str = Field(examples=["a1b2c3d4e5f60718"])


def code_for_status(status_code: int) -> str:
    return {
        400: "bad_request",
        401: "unauthenticated",
        403: "forbidden",
        404: "not_found",
        409: "conflict",
        422: "validation_failed",
        423: "locked",
        429: "rate_limited",
        500: "internal_error",
    }.get(status_code, "error")


def _body(detail: str, status_code: int, extra: dict[str, Any] | None = None) -> dict:
    body: dict[str, Any] = {
        "detail": detail,
        "code": code_for_status(status_code),
        "request_id": get_request_id(),
    }
    if extra:
        body["errors"] = extra.get("errors", [])
    return body


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def _http_exc(_: Request, exc: HTTPException) -> JSONResponse:
        detail = str(exc.detail) if not isinstance(exc.detail, str) else exc.detail
        resp = JSONResponse(status_code=exc.status_code, content=_body(detail, exc.status_code))
        resp.headers[HEADER] = get_request_id()
        return resp

    @app.exception_handler(StarletteHTTPException)
    async def _starlette_exc(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        resp = JSONResponse(
            status_code=exc.status_code, content=_body(str(exc.detail), exc.status_code)
        )
        resp.headers[HEADER] = get_request_id()
        return resp

    @app.exception_handler(RequestValidationError)
    async def _validation_exc(_: Request, exc: RequestValidationError) -> JSONResponse:
        safe: list[dict[str, Any]] = []
        for err in exc.errors():
            loc = ".".join(str(p) for p in err.get("loc", ()))
            safe.append({"field": loc, "message": err.get("msg", "invalid value")})
        resp = JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_body("request validation failed", 422, {"errors": safe}),
        )
        resp.headers[HEADER] = get_request_id()
        return resp

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        # Never leak internals: log the type, return a generic message.
        log.exception("unhandled error: %s", type(exc).__name__)
        resp = JSONResponse(status_code=500, content=_body("internal server error", 500))
        resp.headers[HEADER] = get_request_id()
        return resp
