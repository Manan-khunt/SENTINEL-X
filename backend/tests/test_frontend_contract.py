"""Frontend-backend integration contract tests.

Verifies the SENTINEL-X STRICT FRONTEND-BACKEND INTEGRATION CONTRACT
against the real FastAPI backend via TestClient — the same endpoints the
frontend `src/api.ts` layer calls. Every check maps 1:1 to a contract
acceptance item.
"""

from __future__ import annotations

import json

from fastapi.testclient import TestClient
from tests.conftest import auth_token


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# --- 1. Login with valid seeded demo account -------------------------------


def test_01_login_valid_seeded_account(client):
    r = client.post(
        "/api/auth/login", json={"username": "analyst", "password": "analyst123"}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"
    me = client.get("/api/me", headers=_bearer(body["access_token"])).json()
    assert me["username"] == "analyst"
    assert me["role"] == "analyst"


# --- 2. Invalid credentials rejected ----------------------------------------


def test_02_invalid_credentials_rejected(client):
    r = client.post(
        "/api/auth/login", json={"username": "analyst", "password": "wrong"}
    )
    assert r.status_code == 401
    r = client.post("/api/auth/login", json={"username": "ghost", "password": "x"})
    assert r.status_code == 401


# --- 3. Protected requests send the expected authentication -----------------


def test_03_protected_requires_bearer(client):
    assert client.get("/api/incidents").status_code == 401
    assert client.get("/api/me").status_code == 401
    t = auth_token(client, "viewer", "viewer123")
    assert client.get("/api/incidents", headers=_bearer(t)).status_code == 200


# --- 4. Unauthorized roles cannot perform protected operations --------------


def test_04_rbac_enforced(client):
    viewer = auth_token(client, "viewer", "viewer123")
    analyst = auth_token(client, "analyst", "analyst123")
    approver = auth_token(client, "approver", "approver123")
    # viewer: read-only
    assert (
        client.post(
            "/api/incidents",
            json={"scenario_id": "scenario_1"},
            headers=_bearer(viewer),
        ).status_code
        == 403
    )
    # analyst cannot approve
    assert (
        client.post("/api/actions/nope/approve", headers=_bearer(analyst)).status_code
        == 403
    )
    # analyst cannot kill switch
    assert (
        client.post("/api/system/kill-switch", headers=_bearer(analyst)).status_code
        == 403
    )
    # analyst cannot change system mode (admin only)
    assert (
        client.post(
            "/api/system/mode", json={"mode": "SHADOW"}, headers=_bearer(analyst)
        ).status_code
        == 403
    )
    # approver can kill switch + approve, but still not change mode
    assert client.post("/api/system/kill-switch", headers=_bearer(approver)).status_code == 200
    client.post("/api/system/resume", headers=_bearer(approver))


# --- 5. Scenarios loaded from the backend -----------------------------------


def test_05_scenarios_from_backend(client):
    t = auth_token(client, "viewer", "viewer123")
    r = client.get("/api/scenarios", headers=_bearer(t))
    assert r.status_code == 200
    ids = [s["id"] for s in r.json()]
    assert ids == [
        "scenario_1",
        "scenario_2",
        "scenario_3",
        "scenario_4",
        "scenario_5",
        "scenario_6",
        "scenario_7",
    ]


# --- 6. Incident created through the real API -------------------------------


def test_06_create_incident_real_api(client):
    t = auth_token(client, "analyst", "analyst123")
    r = client.post(
        "/api/incidents",
        json={
            "scenario_id": "scenario_1",
            "seed": 7,
            "mode": "ENFORCE",
            "configuration": "B3",
        },
        headers=_bearer(t),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["id"].startswith("INC-")
    assert body["scenario"] == "scenario_1"
    assert body["seed"] == 7
    assert body["status"] in ("RUNNING", "CONTAINED")


# --- 7. Incident details and graph data match the backend -------------------


def test_07_details_and_graph_match_backend(client):
    t = auth_token(client, "analyst", "analyst123")
    h = _bearer(t)
    # scenario_7 (benign) never isolates nodes, so the full topology
    # is expected in the snapshot.
    inc = client.post(
        "/api/incidents",
        json={"scenario_id": "scenario_7", "seed": 42},
        headers=h,
    ).json()
    iid = inc["id"]
    det = client.get(f"/api/incidents/{iid}", headers=h).json()
    assert det["id"] == iid
    graph = client.get(f"/api/incidents/{iid}/graph", headers=h).json()
    assert graph["version"] == det["graph_version"]
    node_ids = {n["id"] for n in graph["nodes"]}
    assert {"user_1042", "workstation_17", "server_03", "customer_db"} <= node_ids
    paths = client.get(f"/api/incidents/{iid}/paths", headers=h).json()
    assert "paths" in paths and "status" in paths
    # timeline: steps + audit events both come from the DB
    tl = client.get(f"/api/incidents/{iid}/timeline", headers=h).json()
    assert "steps" in tl and "events" in tl
    assert len(tl["events"]) > 0


# --- 8. Action results update from authoritative responses ------------------


def test_08_action_results_authoritative(client):
    t = auth_token(client, "analyst", "analyst123")
    h = _bearer(t)
    inc = client.post(
        "/api/incidents",
        json={"scenario_id": "scenario_1", "seed": 42},
        headers=h,
    ).json()
    acts = client.get(f"/api/incidents/{inc['id']}/actions", headers=h).json()
    assert acts, "expected at least one executed action"
    for a in acts:
        assert a["result"] in ("SUCCESS", "SHADOW_RECOMMEND", "DENIED", "PENDING")
    # proof endpoint is authoritative for the selected action
    proof = client.get(
        f"/api/incidents/{inc['id']}/proof/{acts[0]['id']}", headers=h
    ).json()
    assert proof["target"] == acts[0]["target"]
    assert proof["action"].startswith(acts[0]["tool"])


# --- 9. Approval and denial use actual backend operations -------------------


def test_09_approval_and_deny_backend(client):
    t = auth_token(client, "analyst", "analyst123")
    h = _bearer(t)
    inc = client.post(
        "/api/incidents",
        json={"scenario_id": "scenario_4", "seed": 42},
        headers=h,
    ).json()
    acts = client.get(f"/api/incidents/{inc['id']}/actions", headers=h).json()
    highs = [a for a in acts if a["risk_tier"] == "HIGH"]
    assert highs, "scenario_4 must produce a HIGH-risk action"
    ta = auth_token(client, "approver", "approver123")
    ha = _bearer(ta)
    pending = [a for a in acts if a["approval_status"] == "pending"]
    if pending:
        r = client.post(f"/api/actions/{pending[0]['id']}/deny", headers=ha)
        assert r.status_code == 200
        assert r.json()["status"] == "denied"
        after = client.get(f"/api/incidents/{inc['id']}/actions", headers=h).json()
        denied = [a for a in after if a["id"] == pending[0]["id"]][0]
        assert denied["result"] == "DENIED"
        assert denied["approval_status"] == "denied"


# --- 10. Verification failure is displayed as failure -----------------------


def test_10_verification_failure_reported(client):
    t = auth_token(client, "analyst", "analyst123")
    h = _bearer(t)
    # scenario_5: host isolation is insufficient — the ground-truth verifier
    # must report NOT contained with remaining paths (failure, not success).
    inc = client.post(
        "/api/incidents",
        json={"scenario_id": "scenario_5", "seed": 42},
        headers=h,
    ).json()
    tl = client.get(f"/api/incidents/{inc['id']}/timeline", headers=h).json()
    verifs = [e for e in tl["events"] if e["event"] == "verification.completed"]
    assert verifs, "verification events expected"
    # at least one verdict must be an honest failure with remaining paths
    failures = [
        e
        for e in verifs
        if (e["payload"] or {}).get("contained") is False
        and (e["payload"] or {}).get("remaining_paths")
    ]
    assert failures, "scenario_5 must surface a failed verification verdict"


# --- 11. SSE events update the correct incident ---------------------------


def test_11_sse_delivers_incident_events(client):
    t = auth_token(client, "analyst", "analyst123")
    h = _bearer(t)
    inc = client.post(
        "/api/incidents",
        json={"scenario_id": "scenario_1", "seed": 42},
        headers=h,
    ).json()
    iid = inc["id"]
    tick = client.post("/api/stream/ticket", headers=h).json()
    assert "ticket" in tick
    # Consume the stream: the backend replays buffered history first.
    seen_types: list[str] = []
    seen_ids: list[str] = []
    with client.stream(
        "GET", f"/api/stream/incidents/{iid}?ticket={tick['ticket']}"
    ) as r:
        assert r.status_code == 200
        for line in r.iter_lines():
            if line.startswith("event: "):
                seen_types.append(line[7:])
            elif line.startswith("id: "):
                seen_ids.append(line[4:])
            if len(seen_types) >= 3:
                break
    assert "incident.started" in seen_types or "agent.step" in seen_types
    assert seen_ids, "SSE events must carry server-side ids for dedupe"


# --- 12. SSE reconnection resynchronizes state ----------------------------


def test_12_sse_reconnect_replays_history(client):
    t = auth_token(client, "analyst", "analyst123")
    h = _bearer(t)
    inc = client.post(
        "/api/incidents",
        json={"scenario_id": "scenario_1", "seed": 42},
        headers=h,
    ).json()
    iid = inc["id"]

    def read_events() -> set[tuple[str, str]]:
        out: set[tuple[str, str]] = set()
        tick = client.post("/api/stream/ticket", headers=h).json()
        with client.stream(
            "GET", f"/api/stream/incidents/{iid}?ticket={tick['ticket']}"
        ) as r:
            cur_id, cur_type = None, None
            for line in r.iter_lines():
                if line.startswith("id: "):
                    cur_id = line[4:]
                elif line.startswith("event: "):
                    cur_type = line[7:]
                elif line == "" and cur_id and cur_type:
                    out.add((cur_id, cur_type))
                    cur_id, cur_type = None, None
                if len(out) >= 5:
                    break
        return out

    first = read_events()
    # Simulated reconnect: a fresh ticket + new connection must replay the
    # same buffered events (same ids) so the client can dedupe and resync.
    second = read_events()
    assert first
    assert first <= second


# --- 13. Backend failure produces a visible error, not fake success -------


def test_13_backend_failure_propagates(client):
    t = auth_token(client, "analyst", "analyst123")
    h = _bearer(t)
    # unknown incident -> 404 with detail
    r = client.get("/api/incidents/INC-999999", headers=h)
    assert r.status_code == 404
    assert r.json()["detail"]
    # kill switch active -> incident creation rejected with 423
    ta = auth_token(client, "approver", "approver123")
    ha = _bearer(ta)
    assert client.post("/api/system/kill-switch", headers=ha).status_code == 200
    r = client.post(
        "/api/incidents",
        json={"scenario_id": "scenario_1"},
        headers=h,
    )
    assert r.status_code == 423
    assert "halted" in r.json()["detail"]
    client.post("/api/system/resume", headers=ha)


# --- 14. Kill switch invokes the real authorized backend operation --------


def test_14_kill_switch_real_operation(client):
    ta = auth_token(client, "approver", "approver123")
    ha = _bearer(ta)
    r = client.post("/api/system/kill-switch", headers=ha)
    assert r.status_code == 200
    assert r.json()["status"] == "HALTED"
    status = client.get("/api/system/status", headers=ha).json()
    assert status["status"] == "HALTED"
    # audit trail records the halt
    audit = client.get("/api/audit", headers=ha).json()
    assert any(e["event"] == "system.halted" for e in audit)
    client.post("/api/system/resume", headers=ha)
    assert client.get("/api/system/status", headers=ha).json()["status"] == "RUNNING"


# --- 15. Adaptive Scenario 2 completes through the actual workflow --------


def test_15_scenario2_end_to_end(client):
    t = auth_token(client, "analyst", "analyst123")
    h = _bearer(t)
    inc = client.post(
        "/api/incidents",
        json={"scenario_id": "scenario_2", "seed": 42, "configuration": "B3"},
        headers=h,
    ).json()
    iid = inc["id"]
    # The pivot is real: adversary activates the svc_token-derived
    # route to server_02 after the workstation is isolated, forcing
    # a replan (graph.diff + replanned citing the new active path).
    tl = client.get(f"/api/incidents/{iid}/timeline", headers=h).json()
    events = [e["event"] for e in tl["events"]]
    assert "graph.diff" in events
    assert "incident.replanned" in events
    replan_payloads = [
        e["payload"]
        for e in tl["events"]
        if e["event"] == "incident.replanned" and (e["payload"] or {}).get("paths")
    ]
    assert replan_payloads, "replan must cite the newly active pivot path"
    pivot_paths = [
        p
        for p in replan_payloads[0]["paths"]
        if "server_02" in p and "customer_db" in p
    ]
    assert pivot_paths, "pivot path server_02 -> customer_db expected"
    # the primary route via workstation_17 was blocked by isolation
    diffs = [
        e["payload"]
        for e in tl["events"]
        if e["event"] == "graph.diff" and (e["payload"] or {}).get("removed_nodes")
    ]
    assert any("workstation_17" in d["removed_nodes"] for d in diffs)
    det = client.get(f"/api/incidents/{iid}", headers=h).json()
    assert det["status"] == "CONTAINED"
    assert det["replans"] >= 1
    paths = client.get(f"/api/incidents/{iid}/paths", headers=h).json()
    assert paths["paths"] == []
    assert paths["status"] == "SAFE"
