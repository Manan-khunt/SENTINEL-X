"""Audit + SSE stream endpoints."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.auth import current_user
from app.core import events
from app.core.audit import verify_chain
from app.db.session import get_db
from app.db.tables import AuditLog, SSETicket, User

router = APIRouter()


def _as_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


@router.get(
    "/audit/verify",
    tags=["Audit"],
    summary="Verify the tamper-evident audit chain",
    description="Recomputes every entry hash and the global `previous_hash` linkage "
    "(GENESIS -> ...), then compares each external anchor entry against the DB row at "
    "that sequence. Returns `{ok, status, broken_at, incident_id}` where `status` is "
    "`INTACT` or `BROKEN_AT_ENTRY_{id}` / `BROKEN_AT_ANCHOR_{seq}`. "
    "Terminology: the chain is **tamper-evident** (tampering is detectable), not tamper-proof. "
    "Requires any authenticated role.",
)
def audit_verify(
    incident_id: str | None = Query(
        default=None, description="Optional incident filter; global linkage is still verified."
    ),
    db: Session = Depends(get_db),
    _u: User = Depends(current_user),
):
    result = verify_chain(db, incident_id)
    return {
        "ok": result["ok"],
        "status": result["status"],
        "broken_at": result.get("broken_at"),
        "incident_id": incident_id,
    }


@router.get(
    "/audit",
    tags=["Audit"],
    summary="Recent audit entries (global)",
    description="Latest 200 entries, newest first: `{id, incident_id, actor, event, payload, "
    "previous_hash, hash}`. Only operational fields are exposed — no secrets or tokens. "
    "Requires any authenticated role.",
)
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


@router.get(
    "/audit/{incident_id}",
    tags=["Audit"],
    summary="Incident audit trail + chain status",
    description="All entries for one incident in chain order plus the global verification "
    "`chain` status (`INTACT` or break location). History is append-only and never rewritten. "
    "Requires any authenticated role.",
)
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


@router.get(
    "/stream/incidents/{incident_id}",
    tags=["Event Streaming"],
    summary="SSE event stream for one incident",
    description="Server-Sent Events stream. Authenticate with a `ticket` from "
    "`POST /api/stream/ticket` (`?ticket=...`), not with a bearer header (EventSource "
    "cannot set headers). History replays first so reconnects resync; dedupe on SSE `id`. "
    "~30s window per connection; the client should reconnect. Ticket auth: `401` on bad/expired ticket.",  # noqa: E501
    responses={401: {"description": "Bad or expired ticket."}},
)
async def stream_incidents(
    incident_id: str, ticket: str, request: Request, db: Session = Depends(get_db)
):
    t = db.query(SSETicket).filter_by(ticket=ticket).first()
    if not t or _as_aware(t.expires_at) < datetime.now(timezone.utc):
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
