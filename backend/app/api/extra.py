"""Audit + benchmark + SSE stream endpoints."""

from __future__ import annotations

import asyncio
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.auth import current_user
from app.core import events
from app.core.audit import verify_chain
from app.db.session import get_db
from app.db.tables import AuditLog, SSETicket, User

router = APIRouter()


@router.get("/audit")
def audit_all(db: Session = Depends(get_db), _u: User = Depends(current_user)):
    rows = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(200).all()
    return [
        {
            "id": r.id,
            "incident_id": r.incident_id,
            "actor": r.actor,
            "event": r.event,
            "payload": r.payload_json,
            "previous_hash": r.previous_hash,
            "hash": r.hash,
        }
        for r in rows
    ]


@router.get("/audit/{incident_id}")
def audit_one(incident_id: str, db: Session = Depends(get_db), _u: User = Depends(current_user)):
    rows = db.query(AuditLog).filter_by(incident_id=incident_id).order_by(AuditLog.id).all()
    chain = verify_chain(db, incident_id)
    return {
        "incident_id": incident_id,
        "chain": chain["status"],
        "entries": [
            {
                "id": r.id,
                "actor": r.actor,
                "event": r.event,
                "payload": r.payload_json,
                "hash": r.hash,
                "previous_hash": r.previous_hash,
            }
            for r in rows
        ],
    }


@router.get("/stream/incidents/{incident_id}")
async def stream_incidents(
    incident_id: str, ticket: str, request: Request, db: Session = Depends(get_db)
):
    t = db.query(SSETicket).filter_by(ticket=ticket).first()
    if not t or t.expires_at < datetime.utcnow():
        raise HTTPException(status_code=401, detail="bad ticket")

    async def gen():
        last = 0
        for _ in range(30):  # ~30s window for demo; client reconnects
            if await request.is_disconnected():
                break
            for e in events.history(incident_id, last):
                last = e["id"]
                yield f"id: {e['id']}\nevent: {e['type']}\ndata: {e['payload']}\n\n"
            await asyncio.sleep(1)
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")
