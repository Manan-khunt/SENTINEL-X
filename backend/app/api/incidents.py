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


@router.post("/incidents", response_model=IncidentOut)
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
    return _out(inc)


@router.get("/incidents", response_model=list[IncidentOut])
def list_incidents(db: Session = Depends(get_db), _u: User = Depends(current_user)):
    return [_out(i) for i in db.query(Incident).order_by(Incident.created_at.desc()).all()]


@router.get("/incidents/{incident_id}", response_model=IncidentOut)
def get_incident(incident_id: str, db: Session = Depends(get_db), _u: User = Depends(current_user)):
    inc = db.query(Incident).filter_by(id=incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="not found")
    return _out(inc)


@router.post("/incidents/{incident_id}/step", response_model=IncidentOut)
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


@router.get("/incidents/{incident_id}/graph")
def incident_graph(
    incident_id: str, db: Session = Depends(get_db), _u: User = Depends(current_user)
):
    inc = db.query(Incident).filter_by(id=incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="not found")
    return graph_snapshot(inc.env_state_json, inc.graph_version)


@router.get("/incidents/{incident_id}/paths")
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


@router.get("/incidents/{incident_id}/timeline")
def timeline(incident_id: str, db: Session = Depends(get_db), _u: User = Depends(current_user)):
    steps = db.query(AgentStep).filter_by(incident_id=incident_id).order_by(AgentStep.id).all()
    evts = db.query(AuditLog).filter_by(incident_id=incident_id).order_by(AuditLog.id).all()
    return {
        "steps": [{"phase": s.phase, "payload": s.payload_json} for s in steps],
        "events": [{"event": e.event, "actor": e.actor, "payload": e.payload_json} for e in evts],
    }


@router.get("/incidents/{incident_id}/actions", response_model=list[ActionOut])
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


@router.get("/incidents/{incident_id}/replay")
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


@router.get("/incidents/{incident_id}/proof/{action_id}")
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


@router.post("/actions/{action_id}/approve")
def approve(
    action_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_min_role("approver")),
):
    try:
        return decide_approval(db, action_id, True, user.username)
    except GatewayError as e:
        msg = str(e)
        raise HTTPException(status_code=404 if "not found" in msg else 400, detail=msg) from e


@router.post("/actions/{action_id}/deny")
def deny(
    action_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_min_role("approver")),
):
    try:
        return decide_approval(db, action_id, False, user.username)
    except GatewayError as e:
        msg = str(e)
        raise HTTPException(status_code=404 if "not found" in msg else 400, detail=msg) from e


@router.post("/actions/{action_id}/undo")
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
    return {"status": "undone", "action": action_id}
