"""Persisted kill-switch / mode state (DB-backed, survives restart)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.db.tables import SystemState

DEFAULTS = {"status": "RUNNING", "mode": "ENFORCE"}


def get_state(db: Session, key: str) -> str:
    row = db.query(SystemState).filter_by(key=key).first()
    if row is None:
        return DEFAULTS.get(key, "")
    return row.value


def set_state(db: Session, key: str, value: str, updated_by: str = "system") -> str:
    row = db.query(SystemState).filter_by(key=key).first()
    now = datetime.now(timezone.utc)
    if row is None:
        row = SystemState(key=key, value=value, updated_by=updated_by, updated_at=now)
        db.add(row)
    else:
        row.value = value
        row.updated_by = updated_by
        row.updated_at = now
    db.commit()
    return value


def get_system_status(db: Session) -> str:
    return get_state(db, "status")


def set_system_status(db: Session, status: str, updated_by: str = "system") -> str:
    return set_state(db, "status", status, updated_by)


def get_system_mode(db: Session) -> str:
    return get_state(db, "mode")


def set_system_mode(db: Session, mode: str, updated_by: str = "system") -> str:
    return set_state(db, "mode", mode, updated_by)


def is_halted(db: Session) -> bool:
    return get_system_status(db) == "HALTED"
