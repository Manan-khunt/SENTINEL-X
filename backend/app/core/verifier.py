"""Independent containment verifier (ground truth, no LLM)."""

from __future__ import annotations

from app.core.graph_engine import find_active_paths, find_protected_assets


def verify_containment(state: dict) -> dict:
    protected = find_protected_assets(state)
    remaining: list[list[str]] = []
    for t in protected:
        remaining.extend(find_active_paths(state, t))
    contained = len(remaining) == 0
    return {
        "contained": contained,
        "verdict": "CONTAINED" if contained else "NOT_CONTAINED",
        "remaining_paths": remaining,
    }
