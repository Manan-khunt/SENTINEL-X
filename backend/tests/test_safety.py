"""Kill switch, undo/rollback, shadow mode."""

from __future__ import annotations

from tests.conftest import auth_token


def test_kill_switch_halts_and_blocks(client, db):
    from app.core.system_state import set_system_status

    ta = auth_token(client, "approver", "approver123")
    ha = {"Authorization": f"Bearer {ta}"}
    r = client.post("/api/system/kill-switch", headers=ha)
    assert r.status_code == 200 and r.json()["status"] == "HALTED"
    t = auth_token(client, "analyst", "analyst123")
    h = {"Authorization": f"Bearer {t}"}
    r = client.post("/api/incidents", json={"scenario_id": "scenario_1", "seed": 1002}, headers=h)
    assert r.status_code == 423
    set_system_status(db, "RUNNING", updated_by="test")  # reset for other tests
    from app.agent import orchestrator as _orch

    _orch.SYSTEM_STATE["status"] = "RUNNING"


def test_undo_low_action(client):
    t = auth_token(client, "analyst", "analyst123")
    h = {"Authorization": f"Bearer {t}"}
    r = client.post(
        "/api/incidents",
        json={"scenario_id": "scenario_1", "seed": 1003, "mode": "ENFORCE", "configuration": "B3"},
        headers=h,
    )
    inc = r.json()["id"]
    acts = client.get(f"/api/incidents/{inc}/actions", headers=h).json()
    reversible = [
        a
        for a in acts
        if a["reversible"] and a["result"] == "SUCCESS" and a["risk_tier"] in ("LOW", "MEDIUM")
    ]
    assert reversible, acts
    u = client.post(f"/api/actions/{reversible[0]['id']}/undo", headers=h)
    assert u.status_code == 200


def test_shadow_mode_recommends_only(client):
    t = auth_token(client, "analyst", "analyst123")
    h = {"Authorization": f"Bearer {t}"}
    r = client.post(
        "/api/incidents",
        json={"scenario_id": "scenario_2", "seed": 1004, "mode": "SHADOW", "configuration": "B3"},
        headers=h,
    )
    assert r.status_code == 200
    inc = r.json()["id"]
    g = client.get(f"/api/incidents/{inc}/graph", headers=h).json()
    assert g["version"] >= 0
    paths = client.get(f"/api/incidents/{inc}/paths", headers=h).json()
    assert len(paths["paths"]) > 0  # nothing actually contained in shadow


def _shadow_incident(db):
    """Deterministic SHADOW incident via the real orchestrator (runs the loop)."""
    from app.agent.orchestrator import create_incident

    return create_incident(db, "scenario_1", 3001, "SHADOW", "B3", "test-shadow")


def test_shadow_write_action_returns_recommend_status(client, db):
    """Returned status AND persisted record must read SHADOW_RECOMMEND.

    Regression: the gateway used to check policy.allowed first, and SHADOW
    policy set allowed=False, so every write was mislabeled BLOCKED and the
    SHADOW branch was unreachable.
    """
    from app.core.gateway import execute
    from app.db.tables import Action, AuditLog

    inc = _shadow_incident(db)
    state = dict(inc.env_state_json)
    before = list(state.get("isolated", []))
    out = execute(
        db,
        inc.id,
        state,
        "isolate_endpoint",
        "workstation_17",
        "test recommend",
        "test-shadow",
        "SHADOW",
        idempotency_key=f"{inc.id}:shadow-recommend",
    )
    assert out["status"] == "SHADOW_RECOMMEND"
    row = db.query(Action).filter_by(id=out["action_id"]).first()
    assert row is not None and row.result == "SHADOW_RECOMMEND"
    assert row.approval_status == "not_required"
    # Environment untouched: recommend-only, never executes.
    assert list(state.get("isolated", [])) == before
    assert (
        db.query(AuditLog)
        .filter_by(incident_id=inc.id, event="action.recommended")
        .count()
        >= 1
    )
    assert (
        db.query(AuditLog)
        .filter_by(incident_id=inc.id, event="action.executed")
        .count()
        == 0
    )


def test_shadow_incident_records_recommendations_not_blocked(client, db):
    """End-to-end through incident creation: no BLOCKED mislabels in SHADOW."""
    from app.db.tables import Action

    inc = _shadow_incident(db)
    results = {
        r.result for r in db.query(Action).filter_by(incident_id=inc.id).all()
    }
    assert results, "expected gateway actions from the SHADOW run"
    assert "BLOCKED" not in results
    assert results <= {"SHADOW_RECOMMEND", "SUCCESS", "PENDING"}


def test_enforce_high_risk_waits_for_approval_then_denies(client, db):
    """HIGH-risk action pauses; denial records DENIED without executing."""
    from app.agent.orchestrator import create_incident, decide_approval
    from app.core.gateway import execute
    from app.db.tables import Action, Incident

    inc = create_incident(db, "scenario_4", 42, "ENFORCE", "B3", "test-approval")
    pending = (
        db.query(Action).filter_by(incident_id=inc.id, approval_status="pending").all()
    )
    if not pending:
        # Deterministic fallback: force a HIGH-risk proposal directly.
        state = db.query(Incident).filter_by(id=inc.id).first().env_state_json
        out = execute(
            db, inc.id, dict(state), "disable_credential", "admin_root",
            "test high-risk", "test-approval", "ENFORCE",
            idempotency_key=f"{inc.id}:forced-high",
        )
        assert out["status"] == "AWAITING_APPROVAL"
        pending = (
            db.query(Action).filter_by(incident_id=inc.id, approval_status="pending").all()
        )
    assert pending, "expected a HIGH-risk pending approval"
    target = pending[0]
    assert target.result == "PENDING"
    env_now = db.query(Incident).filter_by(id=inc.id).first().env_state_json
    assert "admin_root" not in (env_now.get("disabled_credentials", []) or [])
    out = decide_approval(db, target.id, False, "test-approver")
    assert out == {"status": "denied", "action": target.id}
    db.refresh(target)
    assert target.result == "DENIED" and target.approval_status == "denied"
    env_after = db.query(Incident).filter_by(id=inc.id).first().env_state_json
    assert "admin_root" not in (env_after.get("disabled_credentials", []) or [])
    try:
        decide_approval(db, target.id, True, "test-approver")
        assert False, "a decided approval must not be reusable"
    except Exception as exc:
        from app.core.gateway import GatewayError

        assert isinstance(exc, GatewayError)


def test_protected_asset_requires_approval_in_every_mode(client, db):
    """Crown-jewel targets pause for approval in ENFORCE and in SHADOW."""
    from app.agent.orchestrator import create_incident
    from app.core.gateway import execute

    for mode in ("ENFORCE", "SHADOW"):
        inc = create_incident(db, "scenario_1", 3003, mode, "B3", "test-protected")
        out = execute(
            db,
            inc.id,
            dict(inc.env_state_json),
            "revoke_token",
            "customer_db",
            "test protected",
            "test-protected",
            mode,
            idempotency_key=f"{inc.id}:protected-{mode}",
        )
        assert out["status"] == "AWAITING_APPROVAL", (mode, out)


def test_approval_rechecks_kill_switch_before_execution(client, db):
    from app.agent.orchestrator import create_incident, decide_approval
    from app.core.gateway import execute
    from app.core.system_state import set_system_status
    from app.db.tables import Action, Incident

    inc = create_incident(db, "scenario_4", 42, "ENFORCE", "B3", "test-approval-killswitch")
    action = db.query(Action).filter_by(incident_id=inc.id, approval_status="pending").first()
    if action is None:
        state = db.query(Incident).filter_by(id=inc.id).first().env_state_json
        result = execute(db, inc.id, dict(state), "disable_credential", "admin_root",
                         "test high risk", "test", "ENFORCE", idempotency_key=f"{inc.id}:high")
        action = db.query(Action).filter_by(id=result["action_id"]).first()
    assert action is not None and action.result == "PENDING"
    set_system_status(db, "HALTED", updated_by="test")
    try:
        out = decide_approval(db, action.id, True, "test-approver")
        assert out["status"] == "blocked"
        db.refresh(action)
        assert action.result == "BLOCKED"
        state = db.query(Incident).filter_by(id=inc.id).first().env_state_json
        assert "admin_root" not in (state.get("disabled_credentials", []) or [])
    finally:
        set_system_status(db, "RUNNING", updated_by="test")


def test_approved_high_risk_action_executes_through_gateway(client, db):
    from app.agent.orchestrator import create_incident, decide_approval
    from app.core.gateway import execute
    from app.db.tables import Action, AuditLog, Incident

    inc = create_incident(db, "scenario_4", 42, "ENFORCE", "B3", "test-approved-action")
    action = db.query(Action).filter_by(incident_id=inc.id, approval_status="pending").first()
    if action is None:
        state = db.query(Incident).filter_by(id=inc.id).first().env_state_json
        result = execute(db, inc.id, dict(state), "disable_credential", "admin_root",
                         "test high risk", "test", "ENFORCE", idempotency_key=f"{inc.id}:high")
        action = db.query(Action).filter_by(id=result["action_id"]).first()
    assert action is not None
    out = decide_approval(db, action.id, True, "test-approver")
    assert out["status"] == "approved"
    db.refresh(action)
    assert action.result == "SUCCESS"
    state = db.query(Incident).filter_by(id=inc.id).first().env_state_json
    assert "admin_root" in (state.get("disabled_credentials", []) or [])
    assert db.query(AuditLog).filter_by(incident_id=inc.id, event="action.executed").count() >= 1


def test_shadow_approval_never_executes(client, db):
    """Approving a gated action in SHADOW records approval, skips execution."""
    from app.agent.orchestrator import create_incident, decide_approval
    from app.core.gateway import execute
    from app.db.tables import AuditLog

    inc = create_incident(db, "scenario_1", 3004, "SHADOW", "B3", "test-shadow-approve")
    out = execute(
        db,
        inc.id,
        dict(inc.env_state_json),
        "revoke_token",
        "customer_db",
        "test protected shadow",
        "test-shadow-approve",
        "SHADOW",
        idempotency_key=f"{inc.id}:protected-shadow-approve",
    )
    assert out["status"] == "AWAITING_APPROVAL"
    res = decide_approval(db, out["action_id"], True, "test-approver")
    assert res == {"status": "approved", "action": out["action_id"]}
    fresh = db.query(AuditLog).filter_by(incident_id=inc.id).all()
    assert not [e for e in fresh if e.event == "action.executed"]
    approved = [e for e in fresh if e.event == "action.approved"]
    assert approved and approved[-1].payload_json.get("executed") is False


def test_gateway_idempotency_dedupes(client, db):
    """Repeated requests with the same key create exactly one action."""
    from app.agent.orchestrator import create_incident
    from app.core.gateway import execute
    from app.db.tables import Action

    inc = create_incident(db, "scenario_1", 3005, "ENFORCE", "B3", "test-idem")
    key = f"{inc.id}:idem-key"
    first = execute(
        db, inc.id, dict(inc.env_state_json), "isolate_endpoint", "workstation_17",
        "test idem", "test-idem", "ENFORCE", idempotency_key=key,
    )
    second = execute(
        db, inc.id, dict(inc.env_state_json), "isolate_endpoint", "workstation_17",
        "test idem", "test-idem", "ENFORCE", idempotency_key=key,
    )
    assert second.get("deduped") is True
    assert second["action_id"] == first["action_id"]
    assert db.query(Action).filter_by(idempotency_key=key).count() == 1


def test_gateway_rejects_unknown_tool_target_and_rate_limit(client, db):
    """Failed executions raise GatewayError and persist no action row."""
    from app.agent.orchestrator import create_incident
    from app.config import get_settings
    from app.core.gateway import GatewayError, execute
    from app.db.tables import Action

    inc = create_incident(db, "scenario_1", 3006, "ENFORCE", "B3", "test-fail")
    state = dict(inc.env_state_json)
    for tool, target in (("no_such_tool", "workstation_17"), ("isolate_endpoint", "no_such_node")):
        try:
            execute(db, inc.id, state, tool, target, "x", "t", "ENFORCE")
        except GatewayError:
            pass
        else:
            raise AssertionError(f"expected GatewayError for {tool}({target})")
    settings = get_settings()
    old_limit, settings.RATE_LIMIT_PER_INCIDENT = settings.RATE_LIMIT_PER_INCIDENT, 0
    try:
        try:
            execute(db, inc.id, state, "isolate_endpoint", "workstation_17",
                    "x", "t", "ENFORCE", idempotency_key=f"{inc.id}:limited")
        except GatewayError as e:
            assert "rate limit" in str(e)
        else:
            raise AssertionError("expected rate-limit GatewayError")
    finally:
        settings.RATE_LIMIT_PER_INCIDENT = old_limit
    # Rejections leave no action rows behind for those keys.
    assert db.query(Action).filter_by(idempotency_key=f"{inc.id}:limited").count() == 0
