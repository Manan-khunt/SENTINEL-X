"""SENTINEL-X agent loop orchestrator.

OBSERVE -> REASON -> PLAN -> DRY-RUN -> RISK -> POLICY -> TOOL CALL
 -> OBSERVE -> VERIFY -> DONE | REPLAN
"""

from __future__ import annotations

import copy
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.agent.fallback import fallback_plan, static_playbook_plan
from app.agent.planner import validate_plan
from app.config import get_settings
from app.core import events
from app.core.audit import anchor_current_head, append_event
from app.core.gateway import GatewayError
from app.core.gateway import execute as gateway_execute
from app.core.graph_engine import (
    find_active_paths,
    find_protected_assets,
    graph_diff,
    graph_snapshot,
)
from app.core.sanitizer import sanitize_telemetry
from app.core.system_state import is_halted
from app.core.verifier import verify_containment
from app.db.tables import Action, AgentStep, Approval, GraphSnapshot, Incident
from app.db.tables import Plan as PlanRow
from app.env.adversary import adversary_step
from app.env.environment import apply_agent_effect, initial_state
from app.llm.adapter import LLMAdapter
from app.tools.respond import simulate_action

SYSTEM_STATE = {"status": "RUNNING"}  # deprecated shim; DB is authoritative


_incident_counter = {"n": 1042, "synced": False}


def _next_incident_id(db: Session) -> str:
    """Monotonic INC ids that resume past any rows already in the database."""
    if not _incident_counter["synced"]:
        highest = 1042
        for (existing,) in db.query(Incident.id).filter(Incident.id.like("INC-%")).all():
            try:
                highest = max(highest, int(existing.split("-", 1)[1]))
            except (ValueError, IndexError):
                continue
        _incident_counter["n"] = highest
        _incident_counter["synced"] = True
    _incident_counter["n"] += 1
    return f"INC-{_incident_counter['n']}"


def _replan_allowed(configuration: str) -> bool:
    """Single mapping point: B2 is the B3 code path with replanning disabled."""
    return configuration != "B2"


def get_adapter() -> LLMAdapter:
    from app.config import get_settings as _gs

    provider = _gs().LLM_PROVIDER.lower()
    if provider == "replay":
        from app.llm.replay import ReplayAdapter

        return ReplayAdapter()
    if provider == "anthropic":
        from app.llm.anthropic import AnthropicAdapter

        return AnthropicAdapter()
    from app.llm.mock import MockAdapter

    return MockAdapter()


def _structured_state(incident: Incident, state: dict, paths: list) -> dict:
    return {
        "incident": incident.id,
        "scenario_id": incident.scenario_id,
        "compromised_identity": (state.get("footholds") or ["unknown"])[0],
        "affected_assets": sorted(set(state.get("compromised", []))),
        "known_indicators": ["10.10.10.42"],
        "reachable_targets": find_protected_assets(state),
        "active_paths": len(paths),
        "active_paths_detail": paths,
        "graph_version": incident.graph_version,
        "replans": incident.replans,
        "workstation_isolated": "workstation_17" in state.get("isolated", []),
        "isolated_hint": list(state.get("isolated", [])),
        "disabled_credentials": list(state.get("disabled_credentials", [])),
    }


def create_incident(
    db: Session,
    scenario_id: str,
    seed: int,
    mode: str,
    configuration: str,
    actor: str,
    allow_replan: bool | None = None,
) -> Incident:
    if is_halted(db):
        raise GatewayError("system halted by kill switch")
    inc_id = _next_incident_id(db)
    state = initial_state(scenario_id, seed)
    now = datetime.now(timezone.utc)
    inc = Incident(
        id=inc_id,
        scenario_id=scenario_id,
        seed=seed,
        mode=mode,
        configuration=configuration,
        status="RUNNING",
        simulation_step=0,
        replans=0,
        graph_version=0,
        env_state_json=state,
        threat_state="ACTIVE" if state.get("compromised") else "BENIGN",
        created_at=now,
        updated_at=now,
    )
    db.add(inc)
    db.commit()
    db.refresh(inc)
    append_event(
        db,
        inc_id,
        actor,
        "incident.started",
        {"scenario": scenario_id, "seed": seed, "mode": mode, "configuration": configuration},
    )
    events.publish(inc_id, "incident.started", {"scenario": scenario_id, "seed": seed})
    _snapshot(db, inc)
    if allow_replan is None:
        allow_replan = _replan_allowed(configuration)
    # Scenario 7 (benign): investigate once, do not loop aggressively
    run_loop(
        db,
        inc_id,
        actor,
        max_cycles=6 if scenario_id != "scenario_7" else 1,
        allow_replan=allow_replan,
    )
    db.refresh(inc)
    return inc


def _snapshot(db: Session, inc: Incident) -> None:
    snap = graph_snapshot(inc.env_state_json, inc.graph_version)
    db.add(
        GraphSnapshot(
            incident_id=inc.id,
            version=inc.graph_version,
            nodes_json={"nodes": snap["nodes"]},
            edges_json={"edges": snap["edges"]},
        )
    )
    db.commit()


def _record_step(db: Session, inc_id: str, step_no: int, phase: str, payload: dict) -> None:
    db.add(AgentStep(incident_id=inc_id, step_no=step_no, phase=phase, payload_json=payload))
    db.commit()


def run_loop(
    db: Session, incident_id: str, actor: str, max_cycles: int = 6, allow_replan: bool = True
) -> Incident:
    for _ in range(max_cycles):
        inc = db.query(Incident).filter_by(id=incident_id).first()
        if not inc or inc.status in (
            "CONTAINED",
            "ESCALATED",
            "FAILED",
            "HALTED",
            "AWAITING_APPROVAL",
        ):
            break
        done = agent_cycle(db, inc, actor, allow_replan=allow_replan)
        if done in ("pause", "done", "escalated"):
            break
    return db.query(Incident).filter_by(id=incident_id).first()


def agent_cycle(db: Session, inc: Incident, actor: str, allow_replan: bool = True) -> str:
    """One OBSERVE..VERIFY cycle. Returns done|replan|pause|escalated."""
    settings = get_settings()
    if is_halted(db):
        inc.status = "HALTED"
        db.commit()
        anchor_current_head(db)
        return "escalated"
    state: dict = copy.deepcopy(inc.env_state_json)
    step = inc.simulation_step

    # OBSERVE
    paths_before = find_active_paths(state)
    _record_step(db, inc.id, step, "OBSERVE", {"active_paths": len(paths_before)})
    events.publish(inc.id, "agent.step", {"phase": "OBSERVE", "step": step})

    # B0 alert-only: never act
    if inc.configuration == "B0":
        _record_step(db, inc.id, step, "PLAN", {"mode": "B0 alert-only, no action"})
        inc.simulation_step += 1
        db.commit()
        return "replan"

    # B1: strong static SOAR playbook (no LLM); B2/B3 share the agent path,
    # differing only by the allow_replan flag (B2 = single attempt, no replan).

    # Sanitizer over telemetry (REASON context)
    _, flags = sanitize_telemetry(state.get("telemetry", []))
    if flags:
        append_event(db, inc.id, "sanitizer", "injection.flagged", {"flags": flags})

    sstate = _structured_state(inc, state, paths_before)

    # REASON+PLAN via LLM (no env access; structured state only)
    tokens_for_step = 0
    adapter = get_adapter()
    raw = None
    plan = None
    err = ""
    first_pass_valid = True
    if inc.configuration == "B1":
        raw = static_playbook_plan(sstate, state)
        plan, err = validate_plan(raw)
        first_pass_valid = plan is not None
        if plan is None:
            append_event(db, inc.id, actor, "plan.invalid", {"attempt": 0, "error": err})
            raw = fallback_plan(sstate)
            plan, err = validate_plan(raw)
    else:
        errors: list[str] = []
        for attempt in range(3):  # initial + max 2 retries
            try:
                raw = adapter.plan(sstate, errors if errors else None)
            except Exception as e:  # LLM unavailable -> fallback
                raw = fallback_plan(sstate)
                append_event(db, inc.id, actor, "plan.fallback", {"reason": str(e)})
                plan, err = validate_plan(raw)
                break
            tokens_for_step = adapter.tokens_used_last_plan
            plan, err = validate_plan(raw)
            if plan is not None:
                break
            first_pass_valid = False if attempt == 0 else first_pass_valid
            errors.append(err)
            append_event(db, inc.id, actor, "plan.invalid", {"attempt": attempt, "error": err})
            if attempt >= 2:
                raw = fallback_plan(sstate)
                plan, err = validate_plan(raw)
    if plan is None:
        # Even the deterministic fallback is invalid: do not crash the loop.
        # Record the failure, escalate for a human, and return cleanly.
        append_event(db, inc.id, actor, "plan.failed", {"error": err, "objective": "no valid plan"})
        inc.status = "ESCALATED"
        inc.updated_at = datetime.now(timezone.utc)
        db.commit()
        anchor_current_head(db)
        events.publish(inc.id, "incident.escalated", {"reason": "no valid plan"})
        return "escalated"
    _record_step(db, inc.id, step, "PLAN", {"objective": plan.objective, "tokens": tokens_for_step})
    db.add(
        PlanRow(
            incident_id=inc.id,
            objective=plan.objective,
            actions_json={"actions": [a.model_dump() for a in plan.actions]},
            expected_effect=plan.expected_effect,
            verification_required=plan.verification_required,
            valid=True,
        )
    )
    db.commit()
    append_event(
        db,
        inc.id,
        actor,
        "plan.created",
        {
            "objective": plan.objective,
            "actions": [a.model_dump() for a in plan.actions],
            "first_pass_valid": first_pass_valid,
            "tokens": tokens_for_step,
        },
    )
    events.publish(inc.id, "plan.created", {"objective": plan.objective})

    # Scenario 7 benign with a reasoning agent (B2/B3): read-only investigate,
    # never disrupt. B0 does nothing; B1 runs its static playbook blindly, so
    # any disruption it causes is measured as over-containment.
    if inc.scenario_id == "scenario_7" and inc.configuration not in ("B0", "B1"):
        for a in plan.actions:
            gateway_execute(
                db,
                inc.id,
                state,
                a.tool,
                a.target,
                a.reason,
                actor,
                inc.mode,
                plan.confidence,
                idempotency_key=f"{inc.id}:{step}:{a.tool}:{a.target}",
            )
        inc.env_state_json = state
        inc.simulation_step += 1
        inc.updated_at = datetime.now(timezone.utc)
        append_event(
            db,
            inc.id,
            actor,
            "verification.completed",
            {"verdict": "BENIGN_INVESTIGATED", "evidence": "admin backup logs match schedule"},
        )
        events.publish(inc.id, "verification.completed", {"verdict": "BENIGN_INVESTIGATED"})
        inc.status = "CONTAINED"
        db.commit()
        anchor_current_head(db)
        events.publish(inc.id, "incident.contained", {})
        return "done"

    progressed = False
    for a in plan.actions:
        # DRY-RUN
        dry = simulate_action(state, a.tool, a.target)
        append_event(
            db, inc.id, actor, "dry_run.completed", {"tool": a.tool, "target": a.target, **dry}
        )
        events.publish(inc.id, "dry_run.completed", {"tool": a.tool, "target": a.target})
        try:
            res = gateway_execute(
                db,
                inc.id,
                state,
                a.tool,
                a.target,
                a.reason,
                actor,
                inc.mode,
                plan.confidence,
                idempotency_key=f"{inc.id}:{step}:{a.tool}:{a.target}",
            )
        except GatewayError as e:
            append_event(db, inc.id, actor, "action.blocked", {"error": str(e)})
            continue
        if res.get("status") == "AWAITING_APPROVAL":
            inc.env_state_json = state
            inc.status = "AWAITING_APPROVAL"
            inc.simulation_step += 1
            db.commit()
            events.publish(inc.id, "graph.updated", {"version": inc.graph_version})
            return "pause"
        if res.get("status") in ("SUCCESS", "SHADOW_RECOMMEND") and a.tool not in (
            "get_user_activity",
            "get_endpoint_status",
            "get_service_tokens",
            "get_attack_graph",
            "simulate_action",
            "verify_containment",
        ):
            progressed = True

    # persist tool effects then adversary reacts to new env state
    old_state = copy.deepcopy(inc.env_state_json)
    inc.env_state_json = state
    inc.simulation_step += 1
    inc.graph_version += 1
    inc.updated_at = datetime.now(timezone.utc)

    diff = graph_diff(old_state, state)
    append_event(db, inc.id, "graph", "graph.diff", diff)
    events.publish(inc.id, "graph.diff", diff)
    _snapshot(db, inc)

    adv = adversary_step(state, inc.seed, inc.simulation_step, inc.scenario_id)
    inc.env_state_json = state
    append_event(db, inc.id, "adversary", "adversary.action", adv)
    events.publish(inc.id, "adversary.action", adv)
    diff2 = graph_diff(old_state, state)
    replanned_for_new_path = False
    if diff2.get("new_active_paths"):
        inc.replans += 1
        replanned_for_new_path = True
        append_event(
            db,
            inc.id,
            actor,
            "incident.replanned",
            {"reason": "new active path", "paths": diff2["new_active_paths"]},
        )
        events.publish(inc.id, "incident.replanned", {})
    _snapshot(db, inc)

    # VERIFY (ground truth, independent)
    verdict = verify_containment(state)
    append_event(db, inc.id, "verifier", "verification.completed", verdict)
    events.publish(inc.id, "verification.completed", verdict)

    if verdict["contained"]:
        inc.status = "CONTAINED"
        inc.threat_state = "CONTAINED"
        db.commit()
        anchor_current_head(db)
        events.publish(inc.id, "incident.contained", {})
        return "done"

    # not contained -> replan bookkeeping
    if not progressed:
        inc.no_progress_cycles = (inc.no_progress_cycles or 0) + 1
    else:
        inc.no_progress_cycles = 0
    if (inc.no_progress_cycles or 0) >= settings.NO_PROGRESS_LIMIT:
        inc.status = "ESCALATED"
        db.commit()
        append_event(db, inc.id, actor, "incident.escalated", {"reason": "no progress 3 cycles"})
        anchor_current_head(db)
        return "escalated"
    if not allow_replan:
        db.commit()
        return "done"  # B2: single attempt, no replanning
    if inc.replans > settings.MAX_REPLANS:
        inc.status = "FAILED"
        db.commit()
        anchor_current_head(db)
        events.publish(inc.id, "incident.failed", {})
        return "escalated"
    if not replanned_for_new_path:
        inc.replans += 1
    db.commit()
    events.publish(inc.id, "incident.replanned", {"replans": inc.replans})
    return "replan"


def resume_after_approval(db: Session, incident_id: str, actor: str) -> Incident:
    inc = db.query(Incident).filter_by(id=incident_id).first()
    if not inc:
        raise GatewayError("incident not found")
    if inc.status != "AWAITING_APPROVAL":
        return inc
    inc.status = "RUNNING"
    db.commit()
    return run_loop(
        db, incident_id, actor, max_cycles=6, allow_replan=_replan_allowed(inc.configuration)
    )


def decide_approval(
    db: Session, action_id: str, approve: bool, actor: str, deny_reason: str = ""
) -> dict:
    """Headless approve/deny used by the API endpoints and the benchmark.

    Same code path as the HTTP routes: records the decision, applies or
    skips the tool effect, then resumes the agent loop.
    """
    a = db.query(Action).filter_by(id=action_id).first()
    if not a:
        raise GatewayError("action not found")
    ap = db.query(Approval).filter_by(action_id=action_id).order_by(Approval.id.desc()).first()
    if not ap or ap.status != "pending":
        raise GatewayError("no pending approval")
    inc = db.query(Incident).filter_by(id=a.incident_id).first()
    if approve:
        ap.status = "approved"
        ap.decided_by = actor
        ap.decided_at = datetime.now(timezone.utc)
        a.approval_status = "approved"
        if (inc.mode if inc else "") == "SHADOW":
            # Recommend-only mode: record the human decision but never
            # execute environment changes, even after approval.
            a.result = "SHADOW_RECOMMEND"
            db.commit()
            append_event(
                db,
                a.incident_id,
                actor,
                "action.approved",
                {"action": action_id, "executed": False, "shadow": True},
            )
            events.publish(a.incident_id, "action.approved", {"action": action_id})
            resume_after_approval(db, a.incident_id, actor)
            return {"status": "approved", "action": action_id}
        # execute now through gateway effect directly (already risk/policy checked)
        apply_agent_effect(inc.env_state_json, a.tool, a.target)
        a.result = "SUCCESS"
        db.commit()
        append_event(db, a.incident_id, actor, "action.approved", {"action": action_id})
        events.publish(a.incident_id, "action.approved", {"action": action_id})
        append_event(
            db,
            a.incident_id,
            actor,
            "action.executed",
            {"action": action_id, "tool": a.tool, "after_approval": True},
        )
        events.publish(a.incident_id, "action.executed", {"action": action_id})
    else:
        ap.status = "denied"
        ap.decided_by = actor
        ap.decided_at = datetime.now(timezone.utc)
        a.approval_status = "denied"
        a.result = "DENIED"
        db.commit()
        append_event(
            db,
            a.incident_id,
            actor,
            "action.denied",
            {"action": action_id, "tool": a.tool, "deny_reason": deny_reason[:500]},
        )
        events.publish(
            a.incident_id, "action.denied", {"action": action_id, "deny_reason": deny_reason[:500]}
        )
    resume_after_approval(db, a.incident_id, actor)
    return {"status": "approved" if approve else "denied", "action": action_id}
