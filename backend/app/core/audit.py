"""Hash-chained append-only audit log (tamper-EVIDENT, not tamper-PROOF).

Honest limit: the hash chain + SQLite insert-only triggers + external anchor
file make casual tampering evident, but an attacker with full write access to
BOTH the database file AND the anchor file (or the host) can rewrite history
and re-anchor it. Detection assumes the anchor file is stored/compared
outside the attacker's easy reach (separate volume, WORM store, or external
verifier that keeps its own copy of anchors).
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.tables import AuditLog

CLOSING_EVENTS = frozenset({"incident.contained", "incident.escalated", "incident.failed"})


def canonical(entry: dict) -> str:
    return json.dumps(entry, sort_keys=True, separators=(",", ":"))


def _entry_body(r: AuditLog) -> dict:
    return {
        "incident": r.incident_id,
        "actor": r.actor,
        "event": r.event,
        "payload": r.payload_json,
        "previous_hash": r.previous_hash,
    }


def _row_hash(previous_hash: str, body: dict) -> str:
    return hashlib.sha256((previous_hash + canonical(body)).encode()).hexdigest()


def _anchor_path() -> Path:
    return Path(get_settings().ANCHOR_PATH)


def _anchor_every() -> int:
    try:
        return int(get_settings().AUDIT_ANCHOR_EVERY)
    except Exception:
        return 10


def _write_anchor(seq: int, digest: str, timestamp: str) -> None:
    path = _anchor_path()
    if path.parent != Path("") and str(path.parent) not in ("", "."):
        path.parent.mkdir(parents=True, exist_ok=True)
    line = json.dumps({"seq": seq, "hash": digest, "timestamp": timestamp})
    with open(path, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def _maybe_anchor(row: AuditLog, force: bool = False) -> None:
    every = _anchor_every()
    if every <= 0:
        every = 10
    is_closing = row.event in CLOSING_EVENTS
    if force or is_closing or (row.id is not None and row.id % every == 0):
        ts = row.created_at
        if isinstance(ts, datetime):
            iso = ts.isoformat()
        else:
            iso = str(ts)
        _write_anchor(row.id, row.hash, iso)


def read_anchors() -> list[dict]:
    path = _anchor_path()
    if not path.exists():
        return []
    out: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


def append_event(
    db: Session, incident_id: str | None, actor: str, event: str, payload: dict
) -> AuditLog:
    last = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
    prev = last.hash if last else "GENESIS"
    body = {
        "incident": incident_id,
        "actor": actor,
        "event": event,
        "payload": payload,
        "previous_hash": prev,
    }
    h = _row_hash(prev, body)
    row = AuditLog(
        incident_id=incident_id,
        actor=actor,
        event=event,
        payload_json=payload,
        previous_hash=prev,
        hash=h,
        created_at=datetime.now(timezone.utc),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    _maybe_anchor(row)
    return row


def anchor_current_head(db: Session) -> dict | None:
    """Append the current chain head to the anchor file (e.g. on incident close)."""
    head = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
    if head is None:
        return None
    _maybe_anchor(head, force=True)
    if isinstance(head.created_at, datetime):
        ts = head.created_at.isoformat()
    else:
        ts = str(head.created_at)
    return {"seq": head.id, "hash": head.hash, "timestamp": ts}


def _broken(entry_id: int) -> dict:
    return {"ok": False, "status": f"BROKEN_AT_ENTRY_{entry_id}", "broken_at": entry_id}


def verify_chain(db: Session, incident_id: str | None = None) -> dict:
    """Verify the GLOBAL chain (GENESIS -> ...) plus optional incident view.

    - Always checks every row's own hash and the global linkage
      (each row's previous_hash must equal its global predecessor's hash,
      or "GENESIS" for the first row).
    - For an incident filter, the same global checks still run (so a break
      anywhere is reported); rows belonging to the incident additionally
      each get their linkage-to-global-predecessor verified explicitly.
    - Finally, every (seq, hash) entry in the external anchor file is
      compared against the DB row at that seq; a mismatch means the DB was
      edited without updating the anchor file.

    Returns {"ok", "status", "broken_at"} where broken_at is the entry id
    (or anchored seq) that failed, or None when intact.
    """
    rows = db.query(AuditLog).order_by(AuditLog.id.asc()).all()

    # 1. Global verification: own hash + linkage.
    prev_hash = "GENESIS"
    for r in rows:
        expect = _row_hash(r.previous_hash, _entry_body(r))
        if expect != r.hash:
            return _broken(r.id)
        if r.previous_hash != prev_hash:
            return _broken(r.id)
        prev_hash = r.hash

    # 2. Incident-filtered view: re-verify each incident row's own hash and
    # its linkage to its global predecessor (not just the previous row in
    # the filtered set).
    if incident_id is not None:
        by_id = {r.id: r for r in rows}
        # global predecessor = greatest id below current id
        sorted_ids = sorted(by_id)
        for r in rows:
            if r.incident_id != incident_id:
                continue
            expect = _row_hash(r.previous_hash, _entry_body(r))
            if expect != r.hash:
                return _broken(r.id)
            idx = sorted_ids.index(r.id)
            expected_prev = by_id[sorted_ids[idx - 1]].hash if idx > 0 else "GENESIS"
            if r.previous_hash != expected_prev:
                return _broken(r.id)

    # 3. External anchor check: DB hash at each anchored seq must match.
    for anchor in read_anchors():
        try:
            seq = int(anchor.get("seq"))
        except (TypeError, ValueError):
            continue
        anchored_hash = anchor.get("hash")
        row = db.query(AuditLog).filter_by(id=seq).first()
        if row is None or row.hash != anchored_hash:
            return {
                "ok": False,
                "status": f"BROKEN_AT_ANCHOR_{seq}",
                "broken_at": seq,
            }

    return {"ok": True, "status": "INTACT", "broken_at": None}
