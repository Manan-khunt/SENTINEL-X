"""In-process SSE event bus (per-incident fan-out)."""

from __future__ import annotations

import itertools
import time

_counter = itertools.count(1)
_store: dict[str, list[dict]] = {}


def publish(incident_id: str, event_type: str, payload: dict) -> dict:
    evt = {
        "id": next(_counter),
        "timestamp": time.time(),
        "incident_id": incident_id,
        "type": event_type,
        "payload": payload,
    }
    _store.setdefault(incident_id, []).append(evt)
    return evt


def history(incident_id: str, after_id: int = 0) -> list[dict]:
    return [e for e in _store.get(incident_id, []) if e["id"] > after_id]


def clear() -> None:
    _store.clear()
