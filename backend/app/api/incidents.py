"""Incident + action endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.agent.orchestrator import create_incident, decide_approval, run_loop
from app.api.auth import current_user, require_min_role
from app.core import events
from app.core.audit import append_event
from app.core.gateway import GatewayError
from app.core.graph_engine import (
    find_active_paths,
    graph_snapshot,
    path_status,
)
from app.core.logging_config import get_logger
from app.core.models import (
    ActionOut,
    CreateIncidentRequest,
    IncidentOut,
)
from app.core.verifier import verify_containment
from app.db.session import get_db
from app.db.tables import Action, AgentStep, AuditLog, Incident, User
from app.env.environment import apply_agent_effect

router = APIRouter()
log = get_logger("sentinelx.incidents")


def _out(inc: Incident) -> IncidentOut:
    return IncidentOut(
        id=inc.id,
        scenario=inc.scenario_id,
        seed=inc.seed,
        mode=inc.mode,  # type: ignore[arg-type]
        configuration=inc.configuration,
        status=inc.status,  # type: ignore[arg-type]
        simulation_step=inc.simulation_step,
        replans=inc.replans,
        graph_version=inc.graph_version,
    )


@router.post(
    "/incidents",
    response_model=IncidentOut,
    tags=["Incidents"],
    summary="Create and auto-investigate an incident",
    description="Seeds the synthetic environment for `scenario_id` and runs the agent loop "
    "(`OBSERVE..VERIFY`, up to 6 cycles). Requires role `analyst`+. "
    'Example: `{"scenario_id": "scenario_2", "seed": 42, "mode": "ENFORCE", "configuration": "B3"}`. '  # noqa: E501
    "Returns `423` when the kill switch is HALTED.",
    responses={
        403: {"description": "Requires analyst+."},
        423: {"description": "System halted by kill switch."},
    },
)
def start_incident(
    body: CreateIncidentRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_min_role("analyst")),
):
    try:
        inc = create_incident(
            db, body.scenario_id, body.seed, body.mode, body.configuration, user.username
        )
    except GatewayError as e:
        raise HTTPException(status_code=423, detail=str(e)) from e
    log.info(
        "incident created id=%s scenario=%s",
        inc.id,
        body.scenario_id,
        extra={"incident_id": inc.id, "scenario_id": body.scenario_id},
    )
    return _out(inc)


@router.get(
    "/incidents",
    response_model=list[IncidentOut],
    tags=["Incidents"],
    summary="List incidents",
    description="Newest first. Requires any authenticated role.",
)
def list_incidents(db: Session = Depends(get_db), _u: User = Depends(current_user)):
    return [_out(i) for i in db.query(Incident).order_by(Incident.created_at.desc()).all()]


@router.get(
    "/incidents/{incident_id}",
    response_model=IncidentOut,
    tags=["Incidents"],
    summary="Get one incident",
    description="Authoritative status (`RUNNING`, `AWAITING_APPROVAL`, `CONTAINED`, "
    "`ESCALATED`, `FAILED`, `HALTED`). A `CONTAINED` status always means the "
    "independent verifier confirmed zero active paths — never mere action success. "
    "Requires any authenticated role.",
    responses={404: {"description": "Incident not found."}},
)
def get_incident(incident_id: str, db: Session = Depends(get_db), _u: User = Depends(current_user)):
    inc = db.query(Incident).filter_by(id=incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="not found")
    return _out(inc)


@router.post(
    "/incidents/{incident_id}/step",
    response_model=IncidentOut,
    tags=["Agent Operations"],
    summary="Run one agent cycle",
    description="Executes a single `OBSERVE..VERIFY` cycle and returns the refreshed incident. "
    "Requires role `analyst`+.",
    responses={404: {"description": "Incident not found."}},
)
def step_incident(
    incident_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_min_role("analyst")),
):
    inc = db.query(Incident).filter_by(id=incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="not found")
    run_loop(db, incident_id, user.username, max_cycles=1)
    return _out(db.query(Incident).filter_by(id=incident_id).first())


@router.get(
    "/incidents/{incident_id}/graph",
    tags=["Attack Graph"],
    summary="Attack-graph snapshot",
    description="NetworkX-derived nodes/edges at the incident's current `graph_version`. Requires any authenticated role.",  # noqa: E501
    responses={404: {"description": "Incident not found."}},
)
def incident_graph(
    incident_id: str, db: Session = Depends(get_db), _u: User = Depends(current_user)
):
    inc = db.query(Incident).filter_by(id=incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="not found")
    return graph_snapshot(inc.env_state_json, inc.graph_version)


@router.get(
    "/incidents/{incident_id}/paths",
    tags=["Attack Graph"],
    summary="Active attack paths",
    description="Lists currently reachable attacker paths to protected assets plus overall "
    "status (`ACTIVE`/`BLOCKED`/`SAFE`). Empty `paths` with `SAFE` is the verified-contained signal. "  # noqa: E501
    "Requires any authenticated role.",
    responses={404: {"description": "Incident not found."}},
)
def incident_paths(
    incident_id: str, db: Session = Depends(get_db), _u: User = Depends(current_user)
):
    inc = db.query(Incident).filter_by(id=incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="not found")
    paths = find_active_paths(inc.env_state_json)
    return {
        "paths": [{"nodes": p, "state": "ACTIVE"} for p in paths],
        "status": path_status(inc.env_state_json),
    }


@router.get(
    "/incidents/{incident_id}/timeline",
    tags=["Agent Operations"],
    summary="Agent steps + audit events",
    description="Raw observability feed: `steps` are agent-loop phases (`OBSERVE`, `PLAN`, ...), "
    "`events` are audit-chain entries (`plan.created`, `dry_run.completed`, `risk.scored`, "
    "`policy.checked`, `action.executed`, `verification.completed`, `incident.replanned`, ...). "
    "For a curated lifecycle view see `/agent-trace`. Requires any authenticated role.",
)
def timeline(incident_id: str, db: Session = Depends(get_db), _u: User = Depends(current_user)):
    steps = db.query(AgentStep).filter_by(incident_id=incident_id).order_by(AgentStep.id).all()
    evts = db.query(AuditLog).filter_by(incident_id=incident_id).order_by(AuditLog.id).all()
    return {
        "steps": [{"phase": s.phase, "payload": s.payload_json} for s in steps],
        "events": [{"event": e.event, "actor": e.actor, "payload": e.payload_json} for e in evts],
    }


@router.get(
    "/incidents/{incident_id}/agent-trace",
    tags=["Agent Operations"],
    summary="Curated agent lifecycle trace",
    description="Understandable execution view grouped as observation, planning, dry-run, "
    "risk assessment, policy decision, tool execution, verification, replanning, and final "
    "incident status. Action lifecycle is split into `proposed` (PENDING/awaiting approval), "
    "`approved`, `executed` (SUCCESS), and `verified_outcomes` (independent verifier verdicts). "
    "Containment is reported only when the verifier confirms zero active paths — never "
    "merely because an action request succeeded. All environment changes flow through the "
    "tool gateway. Requires any authenticated role.",
)
def agent_trace(incident_id: str, db: Session = Depends(get_db), _u: User = Depends(current_user)):
    inc = db.query(Incident).filter_by(id=incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="not found")
    steps = db.query(AgentStep).filter_by(incident_id=incident_id).order_by(AgentStep.id).all()
    evts = db.query(AuditLog).filter_by(incident_id=incident_id).order_by(AuditLog.id).all()
    acts = db.query(Action).filter_by(incident_id=incident_id).order_by(Action.created_at).all()

    def _ev(name: str) -> list[dict]:
        return [{"actor": e.actor, "payload": e.payload_json} for e in evts if e.event == name]

    proposed = [a.id for a in acts if a.result == "PENDING" or a.approval_status == "pending"]
    approved = [a.id for a in acts if a.approval_status == "approved"]
    executed = [
        {"id": a.id, "tool": a.tool, "target": a.target, "result": a.result}
        for a in acts
        if a.result == "SUCCESS"
    ]
    verifications = _ev("verification.completed")
    contained = inc.status == "CONTAINED"
    return {
        "incident_id": incident_id,
        "final_status": inc.status,
        "contained": contained,
        "containment_note": (
            "CONTAINED means the independent verifier confirmed zero active paths."
            if contained
            else "Not contained: verifier still reports active paths or the loop paused/escalated."
        ),
        "replans": inc.replans,
        "observation": [
            {"phase": s.phase, "payload": s.payload_json} for s in steps if s.phase == "OBSERVE"
        ],
        "planning": _ev("plan.created"),
        "dry_run": _ev("dry_run.completed"),
        "risk_assessment": _ev("risk.scored"),
        "policy_decision": _ev("policy.checked"),
        "tool_execution": _ev("action.executed"),
        "verification": verifications,
        "replanning": _ev("incident.replanned"),
        "actions": {
            "proposed": proposed,
            "approved": approved,
            "executed": executed,
            "verified_outcomes": verifications,
        },
    }


@router.get(
    "/incidents/{incident_id}/actions",
    response_model=list[ActionOut],
    tags=["Actions and Approvals"],
    summary="List tool-gateway actions",
    description="`approval_status`: `not_required`/`pending`/`approved`/`denied`/`blocked`. "
    "`result`: `PENDING`/`SUCCESS`/`SHADOW_RECOMMEND`/`DENIED`/`BLOCKED`. "
    "Requires any authenticated role.",
)
def incident_actions(
    incident_id: str, db: Session = Depends(get_db), _u: User = Depends(current_user)
):
    rows = db.query(Action).filter_by(incident_id=incident_id).order_by(Action.created_at).all()
    return [
        ActionOut(
            id=r.id,
            incident_id=r.incident_id,
            tool=r.tool,
            target=r.target,
            reason=r.reason,
            reversible=r.reversible,
            risk_score=r.risk_score,
            risk_tier=r.risk_tier,
            approval_status=r.approval_status,  # type: ignore[arg-type]
            result=r.result,
            undo_of=r.undo_of,
            undone=r.undone,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.get(
    "/incidents/{incident_id}/replay",
    tags=["Agent Operations"],
    summary="Deterministic replay material",
    description="Audit events with hash linkage (`id`, `event`, `hash`, `previous_hash`) "
    "for evidence review and the `/replay` UI page. Requires any authenticated role.",
)
def replay(incident_id: str, db: Session = Depends(get_db), _u: User = Depends(current_user)):
    """Deterministic replay material: audit events + state hash order."""
    evts = db.query(AuditLog).filter_by(incident_id=incident_id).order_by(AuditLog.id).all()
    return {
        "incident_id": incident_id,
        "events": [
            {"id": e.id, "event": e.event, "hash": e.hash, "previous_hash": e.previous_hash}
            for e in evts
        ],
    }


@router.get(
    "/incidents/{incident_id}/proof/{action_id}",
    tags=["Agent Operations"],
    summary="Action evidence proof",
    description="Authoritative per-action evidence: tool call, risk tier/score and factors, "
    "dry-run effect, approval state, reversibility, execution result, and audit hashes. "
    "`result` shows `VERIFIED CONTAINED` only when the verifier confirms containment. "
    "Requires any authenticated role.",
    responses={404: {"description": "Action not found."}},
)
def action_proof(action_id: str, db: Session = Depends(get_db), _u: User = Depends(current_user)):
    a = db.query(Action).filter_by(id=action_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="not found")
    log = (
        db.query(AuditLog)
        .filter(AuditLog.incident_id == a.incident_id, AuditLog.event == "action.executed")
        .order_by(AuditLog.id.desc())
        .first()
    )
    v = verify_containment(db.query(Incident).filter_by(id=a.incident_id).first().env_state_json)
    return {
        "incident": a.incident_id,
        "agent": "SENTINEL-X",
        "threat": "ACTIVE",
        "target": a.target,
        "action": f"{a.tool}({a.target})",
        "reason": a.reason,
        "risk": f"{a.risk_tier} {a.risk_score}",
        **(a.risk_factors_json or {}),
        "dry_run": str((a.dry_run_json or {}).get("removes_paths", "")),
        "approval": a.approval_status,
        "reversible": a.reversible,
        "undo": a.id,
        "result": ("VERIFIED CONTAINED" if v["contained"] else a.result),
        "log_hash": log.hash if log else "",
        "previous_hash": log.previous_hash if log else "",
    }


# ---- approvals / undo ----


@router.post(
    "/actions/{action_id}/approve",
    tags=["Actions and Approvals"],
    summary="Approve a HIGH-risk action",
    description="Executes the gated tool through the gateway and resumes the agent loop. "
    "Requires role `approver`+.",
    responses={
        400: {"description": "No pending approval."},
        403: {"description": "Requires approver+."},
        404: {"description": "Action not found."},
    },
)
def approve(
    action_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_min_role("approver")),
):
    try:
        out = decide_approval(db, action_id, True, user.username)
    except GatewayError as e:
        msg = str(e)
        raise HTTPException(status_code=404 if "not found" in msg else 400, detail=msg) from e
    log.info("action approved id=%s by=%s", action_id, user.username)
    return out


@router.post(
    "/actions/{action_id}/deny",
    tags=["Actions and Approvals"],
    summary="Deny a HIGH-risk action",
    description="Records denial; the tool is never executed. Requires role `approver`+.",
    responses={
        400: {"description": "No pending approval."},
        403: {"description": "Requires approver+."},
        404: {"description": "Action not found."},
    },
)
def deny(
    action_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_min_role("approver")),
):
    try:
        out = decide_approval(db, action_id, False, user.username)
    except GatewayError as e:
        msg = str(e)
        raise HTTPException(status_code=404 if "not found" in msg else 400, detail=msg) from e
    log.info("action denied id=%s by=%s", action_id, user.username)
    return out


@router.post(
    "/actions/{action_id}/undo",
    tags=["Actions and Approvals"],
    summary="Undo a reversible action",
    description="Reverts a reversible, non-undone action. HIGH-risk undo additionally requires "
    "`approver`+. Requires role `analyst`+.",
    responses={
        400: {"description": "Not reversible or already undone."},
        403: {"description": "HIGH-risk undo needs approver."},
        404: {"description": "Action not found."},
    },
)
def undo(
    action_id: str, db: Session = Depends(get_db), user: User = Depends(require_min_role("analyst"))
):
    a = db.query(Action).filter_by(id=action_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="not found")
    if a.risk_tier == "HIGH" and user.role not in ("approver", "admin"):
        raise HTTPException(status_code=403, detail="high-risk undo needs approver")
    if not a.reversible or a.undone:
        raise HTTPException(status_code=400, detail="not reversible or already undone")
    inc = db.query(Incident).filter_by(id=a.incident_id).first()
    apply_agent_effect(inc.env_state_json, "undo_action", a.target)
    a.undone = True
    db.commit()
    append_event(db, a.incident_id, user.username, "action.undone", {"action": action_id})
    events.publish(a.incident_id, "action.executed", {"action": action_id, "undone": True})
    log.info("action undone id=%s by=%s", action_id, user.username)
    return {"status": "undone", "action": action_id}
