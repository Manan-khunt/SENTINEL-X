"""Deterministic fallback playbook (LLM unavailable / invalid plan)."""

from __future__ import annotations


def fallback_plan(structured_state: dict) -> dict:
    paths: list[list[str]] = structured_state.get("active_paths_detail", [])
    flat = [n for p in paths for n in p]
    if "svc_token" in flat:
        action = {
            "tool": "revoke_token",
            "target": "svc_token",
            "reason": "fallback: cut alternate token path",
            "reversible": True,
        }
    elif paths:
        action = {
            "tool": "isolate_endpoint",
            "target": paths[0][1] if len(paths[0]) > 1 else paths[0][0],
            "reason": "fallback: isolate next hop",
            "reversible": True,
        }
    else:
        action = {
            "tool": "verify_containment",
            "target": "customer_db",
            "reason": "fallback: verify",
            "reversible": True,
        }
    return {
        "objective": "Deterministic fallback containment",
        "actions": [action],
        "expected_effect": "reduce active paths",
        "verification_required": True,
        "confidence": 50,
    }
