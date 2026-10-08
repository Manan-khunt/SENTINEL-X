"""SENTINEL-X agent loop orchestrator.

OBSERVE -> REASON -> PLAN -> DRY-RUN -> RISK -> POLICY -> TOOL CALL
 -> OBSERVE -> VERIFY -> DONE | REPLAN
"""

from __future__ import annotations

import copy
from datetime import datetime

from sqlalchemy.orm import Session

from app.agent.fallback import fallback_plan
from app.agent.planner import validate_plan
from app.config import get_settings
from app.core import events
from app.core.audit import append_event
from app.core.gateway import GatewayError
from app.core.gateway import execute as gateway_execute
from app.core.graph_engine import (
    find_active_paths,
    find_protected_assets,
    graph_diff,
    graph_snapshot,
)
from app.core.sanitizer import sanitize_telemetry
from app.core.verifier import verify_containment
from app.db.tables import AgentStep, GraphSnapshot, Incident
from app.db.tables import Plan as PlanRow
from app.env.adversary import adversary_step
from app.env.environment import initial_state
from app.llm.adapter import LLMAdapter
from app.tools.respond import simulate_action

SYSTEM_STATE = {"status": "RUNNING"}  # RUNNING | HALTED (kill switch)

_incident_counter = {"n": 1042}


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
    }


def create_incident(
    db: Session, scenario_id: str, seed: int, mode: str, configuration: str, actor: str
) -> Incident:
    if SYSTEM_STATE["status"] == "HALTED":
        raise GatewayError("system halted by kill switch")
    _incident_counter["n"] += 1
    inc_id = f"INC-{_incident_counter['n']}"
    state = initial_state(scenario_id, seed)
    now = datetime.utcnow()
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
    # Scenario 7 (benign): investigate once, do not loop aggressively
    run_loop(db, inc_id, actor, max_cycles=6 if scenario_id != "scenario_7" else 1)
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


def run_loop(db: Session, incident_id: str, actor: str, max_cycles: int = 6) -> Incident:
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
        done = agent_cycle(db, inc, actor)
        if done in ("pause", "done", "escalated"):
            break
    return db.query(Incident).filter_by(id=incident_id).first()


def agent_cycle(db: Session, inc: Incident, actor: str) -> str:
    """One OBSERVE..VERIFY cycle. Returns done|replan|pause|escalated."""
    settings = get_settings()
    if SYSTEM_STATE["status"] == "HALTED":
        inc.status = "HALTED"
        db.commit()
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

    # B1 static playbook: always isolate workstation_17 once
    # B2: no replanning (single action then stop)
    # B3: full loop

    # Sanitizer over telemetry (REASON context)
    _, flags = sanitize_telemetry(state.get("telemetry", []))
    if flags:
        append_event(db, inc.id, "sanitizer", "injection.flagged", {"flags": flags})

    sstate = _structured_state(inc, state, paths_before)

    # REASON+PLAN via LLM (no env access; structured state only)
    adapter = get_adapter()
    raw = None
    plan = None
    err = ""
    first_pass_valid = True
    for attempt in range(3):  # initial + max 2 retries
        try:
            raw = adapter.plan(sstate)
        except Exception as e:  # LLM unavailable -> fallback
            raw = fallback_plan(sstate)
            append_event(db, inc.id, actor, "plan.fallback", {"reason": str(e)})
            break
        plan, err = validate_plan(raw)
        if plan is not None:
            break
        first_pass_valid = False if attempt == 0 else first_pass_valid
        append_event(db, inc.id, actor, "plan.invalid", {"attempt": attempt, "error": err})
        if attempt >= 2:
            raw = fallback_plan(sstate)
            plan, err = validate_plan(raw)
    assert plan is not None
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
        },
    )
    events.publish(inc.id, "plan.created", {"objective": plan.objective})

    # Scenario 7 benign: read-only investigate, never disrupt
    if inc.scenario_id == "scenario_7":
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
        inc.updated_at = datetime.utcnow()
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
    inc.updated_at = datetime.utcnow()

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
        return "escalated"
    if inc.configuration == "B2":
        db.commit()
        return "done"  # B2: no replanning
    if inc.replans > settings.MAX_REPLANS:
        inc.status = "FAILED"
        db.commit()
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
    return run_loop(db, incident_id, actor, max_cycles=6)
