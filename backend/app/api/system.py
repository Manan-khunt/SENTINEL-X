"""Auth + health + scenarios + system endpoints."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.agent.orchestrator import SYSTEM_STATE  # noqa: F401  (deprecated shim)
from app.api.auth import current_user, make_token, require_min_role, verify_pw
from app.config import VERSION, get_settings
from app.core.audit import append_event
from app.core.models import LoginRequest, TokenResponse, UserOut
from app.core.system_state import (
    get_system_mode,
    get_system_status,
    set_system_mode,
    set_system_status,
)
from app.db.session import get_db
from app.db.tables import Scenario, SSETicket, User

router = APIRouter()


@router.post("/auth/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(username=body.username).first()
    if not user or not verify_pw(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="invalid credentials")
    return TokenResponse(access_token=make_token(user.username, user.role))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return UserOut(id=user.id, username=user.username, role=user.role)  # type: ignore[arg-type]


@router.get("/health")
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


@router.get("/scenarios")
def list_scenarios(db: Session = Depends(get_db), _u: User = Depends(current_user)):
    rows = db.query(Scenario).all()
    return [{"id": r.id, "name": r.name, "description": r.description} for r in rows]


@router.get("/system/status")
def system_status(db: Session = Depends(get_db), _u: User = Depends(current_user)):
    return {"status": get_system_status(db), "version": VERSION}


@router.get("/system/mode")
def system_mode(db: Session = Depends(get_db), _u: User = Depends(current_user)):
    return {"mode": get_system_mode(db)}


@router.post("/system/kill-switch")
def kill_switch(db: Session = Depends(get_db), user: User = Depends(require_min_role("approver"))):
    from app.agent import orchestrator as _orch

    set_system_status(db, "HALTED", updated_by=user.username)
    _orch.SYSTEM_STATE["status"] = "HALTED"
    append_event(db, None, user.username, "system.halted", {"by": user.username})
    return {"status": "HALTED"}


@router.post("/system/resume")
def resume_system(
    db: Session = Depends(get_db), user: User = Depends(require_min_role("approver"))
):
    from app.agent import orchestrator as _orch

    set_system_status(db, "RUNNING", updated_by=user.username)
    _orch.SYSTEM_STATE["status"] = "RUNNING"
    append_event(db, None, user.username, "system.resumed", {"by": user.username})
    return {"status": "RUNNING"}


@router.post("/system/mode")
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


@router.post("/stream/ticket")
def sse_ticket(db: Session = Depends(get_db), user: User = Depends(current_user)):
    ticket = secrets.token_urlsafe(24)
    exp = datetime.now(timezone.utc) + timedelta(seconds=get_settings().SSE_TICKET_TTL)
    db.add(SSETicket(ticket=ticket, username=user.username, expires_at=exp))
    db.commit()
    return {"ticket": ticket, "expires_at": exp.isoformat()}
