"""Deterministic fallback playbook (LLM unavailable / invalid plan)."""

from __future__ import annotations

KNOWN_INDICATOR = "10.10.10.42"
STATIC_SERVICE_TOKENS = ("svc_token",)


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


def static_playbook_plan(sstate: dict, state: dict) -> dict:
    """Strong static SOAR playbook for the B1 baseline (no LLM).

    Fixed ordered checklist, gated on live state so completed steps are not
    repeated: revoke the compromised session, isolate the compromised host,
    block the known indicator, revoke service tokens. Executes through the
    same gateway/risk/policy path as agent plans; it cannot distinguish
    benign from malicious activity, which is exactly what over-containment
    measures on scenario 7.
    """
    actions: list[dict] = []
    identity = sstate.get("compromised_identity")
    if identity and identity in state.get("nodes", {}):
        if identity not in state.get("revoked_sessions", []):
            actions.append(
                {
                    "tool": "revoke_session",
                    "target": identity,
                    "reason": "static playbook: cut foothold session",
                    "reversible": True,
                }
            )
    for asset in sstate.get("affected_assets", []):
        ntype = state.get("nodes", {}).get(asset, {}).get("type")
        if ntype in ("device", "server") and asset not in state.get("isolated", []):
            actions.append(
                {
                    "tool": "isolate_endpoint",
                    "target": asset,
                    "reason": "static playbook: isolate compromised host",
                    "reversible": True,
                }
            )
            break
    if not any(a["tool"] == "isolate_endpoint" for a in actions) and identity:
        # Static adjacency rule: isolate hosts the foothold touched.
        for e in state.get("edges", []):
            peer = e["dst"] if e["src"] == identity else None
            if peer is None:
                continue
            ntype = state.get("nodes", {}).get(peer, {}).get("type")
            if ntype in ("device", "server") and peer not in state.get("isolated", []):
                actions.append(
                    {
                        "tool": "isolate_endpoint",
                        "target": peer,
                        "reason": "static playbook: isolate host touched by foothold",
                        "reversible": True,
                    }
                )
                break
    if KNOWN_INDICATOR not in state.get("blocked_indicators", []):
        actions.append(
            {
                "tool": "block_indicator",
                "target": KNOWN_INDICATOR,
                "reason": "static playbook: block known indicator",
                "reversible": True,
            }
        )
    for tok in STATIC_SERVICE_TOKENS:
        if tok in state.get("nodes", {}) and tok not in state.get("revoked_tokens", []):
            actions.append(
                {
                    "tool": "revoke_token",
                    "target": tok,
                    "reason": "static playbook: revoke service tokens",
                    "reversible": True,
                }
            )
    if not actions:
        actions = [
            {
                "tool": "verify_containment",
                "target": "customer_db",
                "reason": "static playbook: checklist exhausted, verify",
                "reversible": True,
            }
        ]
    return {
        "objective": "Static SOAR playbook containment",
        "actions": actions,
        "expected_effect": "cut foothold, host, indicator and token exposure",
        "verification_required": True,
        "confidence": 60,
    }
