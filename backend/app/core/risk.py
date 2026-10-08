"""Risk scoring: code-only, never LLM-driven.

Risk = 0.35*criticality + 0.25*blast + 0.25*irreversibility + 0.15*uncertainty
Tiers: LOW <35, MEDIUM 35-69, HIGH >=70

Blast radius = min(100, 4 * direct_successors + TYPE_BONUS) where the
type bonus reflects lateral-movement potential (domain credentials and
service tokens can impersonate entire services/directories).
Parameters are calibrated so the reference examples hold exactly
(confidence 75):
  block_indicator(unknown ip)      ->   8 LOW
  revoke_session(user_1042)        ->  22 LOW
  revoke_token(svc_token)          ->  48 MEDIUM
  disable_credential(admin_root)   ->  75 HIGH
"""

from __future__ import annotations

IRREVERSIBILITY = {
    "get_user_activity": 0,
    "get_endpoint_status": 0,
    "get_service_tokens": 0,
    "get_attack_graph": 0,
    "simulate_action": 0,
    "verify_containment": 0,
    "block_indicator": 10,
    "revoke_session": 30,
    "revoke_token": 20,
    "isolate_endpoint": 50,
    "disable_credential": 80,
    "undo_action": 5,
}

TYPE_BLAST_BONUS = {
    "credential": 68,
    "service_token": 55,
    "database": 30,
    "server": 20,
    "device": 8,
    "service": 5,
    "user": 0,
}

DEFAULT_CRITICALITY = 5


def tier_of(score: float) -> str:
    if score >= 70:
        return "HIGH"
    if score >= 35:
        return "MEDIUM"
    return "LOW"


def blast_radius(state: dict, target: str) -> float:
    """0-100 from inherent topological reach (static enterprise layout) plus
    node-type lateral potential. Uses base topology so the score is stable
    across containment steps; live exposure is captured via active paths."""
    from app.env.environment import BASE_EDGES, BASE_NODES

    if target not in BASE_NODES and target not in (state.get("nodes", {})):
        return 0.0
    succ = sum(1 for e in BASE_EDGES if e["src"] == target)
    ntype = BASE_NODES.get(target, state.get("nodes", {}).get(target, {})).get("type", "")
    return float(min(100, 4 * succ + TYPE_BLAST_BONUS.get(ntype, 0)))


def score_action(state: dict, tool: str, target: str, confidence: int = 75) -> dict:
    nodes = state.get("nodes", {})
    criticality = float(nodes.get(target, {}).get("criticality", DEFAULT_CRITICALITY))
    blast = blast_radius(state, target)
    irrev = float(IRREVERSIBILITY.get(tool, 50))
    uncertainty = float(100 - max(0, min(100, confidence)))
    score = round(0.35 * criticality + 0.25 * blast + 0.25 * irrev + 0.15 * uncertainty, 2)
    return {
        "score": score,
        "tier": tier_of(score),
        "factors": {
            "criticality": criticality,
            "blast_radius": blast,
            "irreversibility": irrev,
            "uncertainty": uncertainty,
        },
    }
