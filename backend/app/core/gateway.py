"""Tool Gateway: the ONLY execution path. Agent -> Gateway -> Policy/Risk -> Tool -> Env."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import get_settings
from app.core import events
from app.core.audit import append_event
from app.core.graph_engine import build_graph
from app.core.policy import policy_check
from app.core.risk import score_action
from app.db.tables import Action, Approval
from app.tools import registry, respond
from app.tools.investigate import (
    get_attack_graph,
    get_endpoint_status,
    get_service_tokens,
    get_user_activity,
)
from app.tools.respond import simulate_action
from app.tools.verify import verify_tool

READ_DISPATCH = {
    "get_user_activity": lambda st, tg: get_user_activity(st, tg),
    "get_endpoint_status": lambda st, tg: get_endpoint_status(st, tg),
    "get_service_tokens": lambda st, tg: get_service_tokens(st, tg),
    "get_attack_graph": lambda st, tg: get_attack_graph(st, tg),
    "simulate_action": lambda st, tg: (
        simulate_action(st, tg.split(":")[0], tg.split(":")[1])
        if ":" in tg
        else {"error": "use tool:target format"}
    ),
    "verify_containment": lambda st, tg: verify_tool(st),
}


class GatewayError(Exception):
    pass


def _check_rate_limit(db: Session, incident_id: str) -> None:
    limit = get_settings().RATE_LIMIT_PER_INCIDENT
    n = db.query(Action).filter(Action.incident_id == incident_id).count()
    if n >= limit:
        raise GatewayError("rate limit exceeded: escalate to human")


def execute(
    db: Session,
    incident_id: str,
    state: dict,
    tool: str,
    target: str,
    reason: str,
    actor: str,
    mode: str,
    confidence: int = 75,
    idempotency_key: str = "",
) -> dict:
    """Validate + risk + policy + execute. Returns action record dict."""
    from app.core.system_state import is_halted as _is_halted

    if _is_halted(db):
        raise GatewayError("system halted by kill switch")
    if not registry.tool_exists(tool):
        raise GatewayError(f"unknown tool: {tool}")
    _check_rate_limit(db, incident_id)

    # idempotency: same key returns existing
    if idempotency_key:
        existing = (
            db.query(Action)
            .filter(Action.incident_id == incident_id, Action.idempotency_key == idempotency_key)
            .first()
        )
        if existing:
            return {"action_id": existing.id, "status": existing.result, "deduped": True}

    # target must exist in graph/env (except block_indicator IPs + undo)
    if tool not in ("block_indicator",):
        g = build_graph(state)
        if tool == "undo_action":
            pass  # validated separately
        elif target not in state.get("nodes", {}) and target not in g.nodes:
            raise GatewayError(f"unknown target: {target}")
        if target in state.get("nodes", {}) or target in g.nodes:
            if target in state.get("isolated", []) and tool != "undo_action":
                pass  # allow operating on isolated for revoke etc.
        # target currently present in graph OR known node
        if target not in g.nodes and target not in state.get("nodes", {}):
            raise GatewayError(f"target not present in graph: {target}")

    risk = score_action(state, tool, target, confidence)
    policy = policy_check(risk["tier"], target, state, mode)

    action_id = f"act_{uuid.uuid4().hex[:8]}"
    dry = (
        simulate_action(state, tool, target) if registry.is_write_tool(tool) else {"dry_run": "n/a"}
    )

    action = Action(
        id=action_id,
        incident_id=incident_id,
        tool=tool,
        target=target,
        reason=reason[:500],
        reversible=(tool in registry.REVERSIBLE),
        risk_score=risk["score"],
        risk_tier=risk["tier"],
        risk_factors_json=risk["factors"],
        dry_run_json=dry if isinstance(dry, dict) else {},
        approval_status="not_required",
        result="PENDING",
        idempotency_key=idempotency_key or action_id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(action)
    db.commit()

    append_event(
        db,
        incident_id,
        actor,
        "risk.scored",
        {"action": action_id, "tool": tool, "target": target, **risk},
    )
    append_event(db, incident_id, actor, "policy.checked", {"action": action_id, **policy})
    events.publish(incident_id, "risk.scored", {"action": action_id, **risk})
    events.publish(incident_id, "policy.checked", {"action": action_id, **policy})

    if registry.is_write_tool(tool):
        if policy["approval_required"]:
            action.approval_status = "pending"
            db.add(Approval(action_id=action_id, incident_id=incident_id, status="pending"))
            db.commit()
            append_event(
                db,
                incident_id,
                actor,
                "approval.required",
                {"action": action_id, "tool": tool, "target": target},
            )
            events.publish(incident_id, "approval.required", {"action": action_id, "tool": tool})
            return {
                "action_id": action_id,
                "status": "AWAITING_APPROVAL",
                "risk": risk,
                "policy": policy,
                "dry_run": dry,
            }
        if not policy["allowed"]:
            action.result = "BLOCKED"
            action.approval_status = "blocked"
            db.commit()
            events.publish(
                incident_id, "action.denied", {"action": action_id, "reason": policy["reason"]}
            )
            return {"action_id": action_id, "status": "BLOCKED", "risk": risk, "policy": policy}
        if mode == "SHADOW":
            action.result = "SHADOW_RECOMMEND"
            db.commit()
            append_event(
                db,
                incident_id,
                actor,
                "action.recommended",
                {"action": action_id, "tool": tool, "target": target, "shadow": True},
            )
            events.publish(
                incident_id, "action.proposed", {"action": action_id, "tool": tool, "shadow": True}
            )
            return {
                "action_id": action_id,
                "status": "SHADOW_RECOMMEND",
                "risk": risk,
                "policy": policy,
                "dry_run": dry,
            }
        result = respond.apply_response_action(state, tool, target)
        action.result = result.get("status", "SUCCESS")
        db.commit()
        append_event(
            db,
            incident_id,
            actor,
            "action.executed",
            {"action": action_id, "tool": tool, "target": target, "result": action.result},
        )
        events.publish(
            incident_id, "action.executed", {"action": action_id, "tool": tool, "target": target}
        )
        return {
            "action_id": action_id,
            "status": action.result,
            "risk": risk,
            "policy": policy,
            "dry_run": dry,
        }
    # read tool
    try:
        out = READ_DISPATCH[tool](state, target)
    except KeyError:
        raise GatewayError(f"unknown tool: {tool}") from None
    action.result = "SUCCESS"
    db.commit()
    return {
        "action_id": action_id,
        "status": "SUCCESS",
        "output": out,
        "risk": risk,
        "policy": policy,
    }


def execute_approved_action(db: Session, action: Action, incident, actor: str) -> dict:
    """Revalidate and execute a previously gated action after human approval."""
    from app.core.system_state import get_system_mode, is_halted

    if is_halted(db):
        raise GatewayError("system halted by kill switch")
    mode = get_system_mode(db) or incident.mode
    if mode != "ENFORCE":
        raise GatewayError("approved actions execute only in ENFORCE mode")
    if not registry.tool_exists(action.tool) or not registry.is_write_tool(action.tool):
        raise GatewayError("approved action is not a registered write tool")
    state = incident.env_state_json
    graph = build_graph(state)
    if action.tool != "block_indicator" and action.target not in state.get("nodes", {}) and action.target not in graph.nodes:
        raise GatewayError("approved action target is no longer present")
    risk = score_action(state, action.tool, action.target)
    policy = policy_check(risk["tier"], action.target, state, mode)
    if risk["tier"] != action.risk_tier or not policy["allowed"] and not policy["approval_required"]:
        raise GatewayError("current risk or policy no longer permits this action")
    result = respond.apply_response_action(state, action.tool, action.target)
    action.result = result.get("status", "SUCCESS")
    action.risk_score = risk["score"]
    action.risk_tier = risk["tier"]
    action.risk_factors_json = risk["factors"]
    db.commit()
    append_event(db, action.incident_id, actor, "action.executed", {
        "action": action.id, "tool": action.tool, "target": action.target,
        "result": action.result, "after_approval": True,
    })
    events.publish(action.incident_id, "action.executed", {"action": action.id, "tool": action.tool, "target": action.target})
    return {"action_id": action.id, "status": action.result, "risk": risk, "policy": policy}
