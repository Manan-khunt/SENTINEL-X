"""Kill switch, undo/rollback, shadow mode."""

from __future__ import annotations

from tests.conftest import auth_token


def test_kill_switch_halts_and_blocks(client):
    from app.agent.orchestrator import SYSTEM_STATE

    ta = auth_token(client, "approver", "approver123")
    ha = {"Authorization": f"Bearer {ta}"}
    r = client.post("/api/system/kill-switch", headers=ha)
    assert r.status_code == 200 and r.json()["status"] == "HALTED"
    t = auth_token(client, "analyst", "analyst123")
    h = {"Authorization": f"Bearer {t}"}
    r = client.post("/api/incidents", json={"scenario_id": "scenario_1", "seed": 1002}, headers=h)
    assert r.status_code == 423
    SYSTEM_STATE["status"] = "RUNNING"  # reset for other tests


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
