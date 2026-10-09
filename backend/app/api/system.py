"""Auth + health + scenarios + system endpoints."""

from __future__ import annotations

import secrets
import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.agent.orchestrator import SYSTEM_STATE  # noqa: F401  (deprecated shim)
from app.api.auth import current_user, make_token, require_min_role, verify_pw
from app.config import VERSION, get_settings
from app.core.audit import append_event
from app.core.logging_config import get_logger
from app.core.models import (
    DiagnosticCheck,
    DiagnosticsOut,
    HealthOut,
    LoginRequest,
    TokenResponse,
    UserOut,
)
from app.core.system_state import (
    get_system_mode,
    get_system_status,
    set_system_mode,
    set_system_status,
)
from app.db.session import get_db
from app.db.tables import Scenario, SSETicket, User

router = APIRouter()
log = get_logger("sentinelx.system")


@router.post(
    "/auth/login",
    response_model=TokenResponse,
    tags=["Authentication"],
    summary="Log in with a demo account",
    description="Exchange username/password for a JWT bearer token. Public endpoint (no role required). "  # noqa: E501
    "Demo accounts: viewer, analyst, approver, admin. The token must be sent as `Authorization: Bearer <token>`.",  # noqa: E501
    responses={
        401: {"description": "Invalid credentials."},
        422: {"description": "Request validation failed."},
    },
)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(username=body.username).first()
    if not user or not verify_pw(body.password, user.password_hash):
        log.info("login failed username=%s", body.username)
        raise HTTPException(status_code=401, detail="invalid credentials")
    log.info("login ok username=%s role=%s", user.username, user.role)
    return TokenResponse(access_token=make_token(user.username, user.role))


@router.get(
    "/me",
    response_model=UserOut,
    tags=["Authentication"],
    summary="Current user identity",
    description="Returns the caller's id, username, and role. Requires any valid bearer token.",
    responses={401: {"description": "Missing or invalid token."}},
)
def me(user: User = Depends(current_user)):
    return UserOut(id=user.id, username=user.username, role=user.role)  # type: ignore[arg-type]


@router.get(
    "/health",
    response_model=HealthOut,
    tags=["System Health"],
    summary="Liveness probe (stable contract)",
    description="Lightweight liveness check. Shape is frozen for the frontend "
    "`Health` type: `{api, database, environment, agent, version}`. "
    "For per-subsystem readiness see `GET /api/health/detailed`. No authentication required.",
)
def health(db: Session = Depends(get_db)):
    from sqlalchemy import text as _text

    db_ok = True
    try:
        db.execute(_text("SELECT 1"))
    except Exception:
        db_ok = False
    return {
        "api": "ok",
        "database": "ok" if db_ok else "error",
        "environment": "ok",
        "agent": get_system_status(db),
        "version": VERSION,
    }


@router.get(
    "/health/detailed",
    response_model=DiagnosticsOut,
    tags=["System Health"],
    summary="Readiness diagnostics per subsystem",
    description="Non-destructive readiness checks for: API process, SQLite connectivity, "
    "agent readiness (kill-switch state + LLM adapter), environment-simulator smoke test, "
    "and event-streaming bus. Overall status: `healthy` (all ok), `degraded` "
    "(non-database issue or HALTED), `unavailable` (database unreachable). "
    "Exposes no secrets, tokens, or filesystem paths. No authentication required.",
)
def health_detailed(db: Session = Depends(get_db)):
    from sqlalchemy import text as _text

    checks: dict[str, DiagnosticCheck] = {}

    checks["api"] = DiagnosticCheck(status="healthy", detail="process serving requests")

    t0 = time.perf_counter()
    try:
        db.execute(_text("SELECT 1"))
        latency = round((time.perf_counter() - t0) * 1000, 2)
        checks["database"] = DiagnosticCheck(
            status="healthy", detail=f"SELECT 1 ok in {latency}ms", latency_ms=latency
        )
    except Exception as e:
        checks["database"] = DiagnosticCheck(
            status="unavailable", detail=f"SQLite check failed: {type(e).__name__}"
        )

    try:
        agent_status = get_system_status(db)
        from app.agent.orchestrator import get_adapter

        adapter = get_adapter()
        adapter_name = type(adapter).__name__
        if agent_status == "HALTED":
            checks["agent"] = DiagnosticCheck(
                status="degraded", detail=f"kill switch HALTED; planner={adapter_name}"
            )
        else:
            checks["agent"] = DiagnosticCheck(
                status="healthy", detail=f"status={agent_status}; planner={adapter_name}"
            )
    except Exception as e:
        checks["agent"] = DiagnosticCheck(
            status="unavailable", detail=f"agent check failed: {type(e).__name__}"
        )

    try:
        from app.core.graph_engine import find_active_paths
        from app.env.environment import initial_state

        state = initial_state("scenario_1", 1)
        n = len(find_active_paths(state))
        checks["environment_simulator"] = DiagnosticCheck(
            status="healthy", detail=f"synthetic env smoke ok ({n} active paths on scenario_1)"
        )
    except Exception as e:
        checks["environment_simulator"] = DiagnosticCheck(
            status="degraded", detail=f"simulator check failed: {type(e).__name__}"
        )

    try:
        from app.core import events

        events.publish("__healthcheck__", "health.ping", {})
        hist = events.history("__healthcheck__", 0)
        checks["event_streaming"] = DiagnosticCheck(
            status="healthy" if hist else "degraded",
            detail="in-process SSE bus readable" if hist else "bus empty after ping",
        )
    except Exception as e:
        checks["event_streaming"] = DiagnosticCheck(
            status="unavailable", detail=f"event bus failed: {type(e).__name__}"
        )

    if checks["database"].status == "unavailable":
        overall = "unavailable"
    elif any(c.status != "healthy" for c in checks.values()):
        overall = "degraded"
    else:
        overall = "healthy"
    return DiagnosticsOut(status=overall, version=VERSION, checks=checks)


@router.get(
    "/scenarios",
    tags=["Scenarios"],
    summary="List synthetic scenarios",
    description="Returns the 7 seeded scenarios (`scenario_1`..`scenario_7`). Requires any authenticated role.",  # noqa: E501
    responses={401: {"description": "Missing or invalid token."}},
)
def list_scenarios(db: Session = Depends(get_db), _u: User = Depends(current_user)):
    rows = db.query(Scenario).all()
    return [{"id": r.id, "name": r.name, "description": r.description} for r in rows]


@router.get(
    "/system/status",
    tags=["System Health"],
    summary="Agent system status",
    description="Persisted kill-switch state (`RUNNING` or `HALTED`) plus backend version. Requires any authenticated role.",  # noqa: E501
)
def system_status(db: Session = Depends(get_db), _u: User = Depends(current_user)):
    return {"status": get_system_status(db), "version": VERSION}


@router.get(
    "/system/mode",
    tags=["System Health"],
    summary="Enforcement mode",
    description="Returns `ENFORCE` (tools execute) or `SHADOW` (recommend-only). Requires any authenticated role.",  # noqa: E501
)
def system_mode(db: Session = Depends(get_db), _u: User = Depends(current_user)):
    return {"mode": get_system_mode(db)}


@router.post(
    "/system/kill-switch",
    tags=["System Health"],
    summary="Halt the agent (kill switch)",
    description="Sets system status to `HALTED`; incident creation and tool execution are rejected with `423`. "  # noqa: E501
    "Requires role `approver` or higher. Writes a `system.halted` audit event.",
    responses={
        401: {"description": "Missing/invalid token."},
        403: {"description": "Requires approver+."},
    },
)
def kill_switch(db: Session = Depends(get_db), user: User = Depends(require_min_role("approver"))):
    from app.agent import orchestrator as _orch

    set_system_status(db, "HALTED", updated_by=user.username)
    _orch.SYSTEM_STATE["status"] = "HALTED"
    append_event(db, None, user.username, "system.halted", {"by": user.username})
    log.info("kill switch HALTED by=%s", user.username)
    return {"status": "HALTED"}


@router.post(
    "/system/resume",
    tags=["System Health"],
    summary="Resume after halt",
    description="Sets system status back to `RUNNING`. Requires role `approver` or higher.",
    responses={
        401: {"description": "Missing/invalid token."},
        403: {"description": "Requires approver+."},
    },
)
def resume_system(
    db: Session = Depends(get_db), user: User = Depends(require_min_role("approver"))
):
    from app.agent import orchestrator as _orch

    set_system_status(db, "RUNNING", updated_by=user.username)
    _orch.SYSTEM_STATE["status"] = "RUNNING"
    append_event(db, None, user.username, "system.resumed", {"by": user.username})
    log.info("system resumed by=%s", user.username)
    return {"status": "RUNNING"}


@router.post(
    "/system/mode",
    tags=["System Health"],
    summary="Set enforcement mode",
    description='Body `{"mode": "ENFORCE"|"SHADOW"}`. Requires role `admin`.',
    responses={
        400: {"description": "Unknown mode."},
        403: {"description": "Requires admin."},
    },
)
def set_mode(
    body: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_min_role("admin")),
):
    mode = str(body.get("mode", "ENFORCE")).upper()
    if mode not in ("ENFORCE", "SHADOW"):
        from fastapi import HTTPException as _HTTP

        raise _HTTP(status_code=400, detail="unknown mode")
    set_system_mode(db, mode, updated_by=user.username)
    append_event(db, None, user.username, "system.mode_changed", {"mode": mode})
    return {"mode": mode}


@router.post(
    "/stream/ticket",
    tags=["Event Streaming"],
    summary="Mint an SSE ticket",
    description="Returns a short-lived ticket (`SSE_TICKET_TTL` seconds) for "
    "`GET /api/stream/incidents/{id}?ticket=...`. Requires any authenticated role. "
    "Tickets are single-purpose bearer secrets — do not log or share them.",
)
def sse_ticket(db: Session = Depends(get_db), user: User = Depends(current_user)):
    ticket = secrets.token_urlsafe(24)
    exp = datetime.now(timezone.utc) + timedelta(seconds=get_settings().SSE_TICKET_TTL)
    db.add(SSETicket(ticket=ticket, username=user.username, expires_at=exp))
    db.commit()
    return {"ticket": ticket, "expires_at": exp.isoformat()}
