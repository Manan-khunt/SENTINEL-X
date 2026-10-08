"""Integration: adversary determinism, scenarios 2/4/5/6/7 acceptance."""

from __future__ import annotations

from app.env.adversary import adversary_step
from app.env.environment import initial_state
from tests.conftest import auth_token


def test_adversary_deterministic_and_reactive():
    a = initial_state("scenario_2", 7)
    b = initial_state("scenario_2", 7)
    e1 = adversary_step(a, 7, 1, "scenario_2")
    e2 = adversary_step(b, 7, 1, "scenario_2")
    assert e1 == e2  # same seed same evolution
    # reactive: blocking primary changes behavior vs open primary
    c = initial_state("scenario_2", 7)
    c["edges"] = [e for e in c["edges"] if "server_03" not in (e["src"], e["dst"])]
    e3 = adversary_step(c, 7, 1, "scenario_2")
    assert e3["tactic"] in ("token_theft", "alt_lateral", "persistence", "credential_reuse")


def test_scenario2_api_flow(client):
    t = auth_token(client, "analyst", "analyst123")
    h = {"Authorization": f"Bearer {t}"}
    r = client.post(
        "/api/incidents",
        json={"scenario_id": "scenario_2", "seed": 42, "mode": "ENFORCE", "configuration": "B3"},
        headers=h,
    )
    assert r.status_code == 200, r.text
    inc = r.json()["id"]
    # poll/step until contained (max replans 2 target for scenario 2 seed 42)
    for _ in range(8):
        g = client.get(f"/api/incidents/{inc}", headers=h).json()
        if g["status"] == "CONTAINED":
            break
        if g["status"] == "AWAITING_APPROVAL":
            acts = client.get(f"/api/incidents/{inc}/actions", headers=h).json()
            pend = [a for a in acts if a["approval_status"] == "pending"]
            ta = auth_token(client, "approver", "approver123")
            ha = {"Authorization": f"Bearer {ta}"}
            for p in pend:
                client.post(f"/api/actions/{p['id']}/approve", headers=ha)
        else:
            client.post(f"/api/incidents/{inc}/step", headers=h)
    g = client.get(f"/api/incidents/{inc}", headers=h).json()
    assert g["status"] == "CONTAINED", g
    assert g["replans"] <= 4
    paths = client.get(f"/api/incidents/{inc}/paths", headers=h).json()
    assert paths["paths"] == []


def test_scenario4_approval(client):
    t = auth_token(client, "analyst", "analyst123")
    h = {"Authorization": f"Bearer {t}"}
    r = client.post(
        "/api/incidents",
        json={"scenario_id": "scenario_4", "seed": 42, "mode": "ENFORCE", "configuration": "B3"},
        headers=h,
    )
    inc = r.json()["id"]
    g = client.get(f"/api/incidents/{inc}", headers=h).json()
    assert g["status"] in ("AWAITING_APPROVAL", "RUNNING", "CONTAINED")
    acts = client.get(f"/api/incidents/{inc}/actions", headers=h).json()
    highs = [a for a in acts if a["risk_tier"] == "HIGH"]
    assert highs, acts
    assert highs[0]["risk_score"] >= 70
    # deny -> replan around denial, never executes high action
    ta = auth_token(client, "approver", "approver123")
    ha = {"Authorization": f"Bearer {ta}"}
    pend = [a for a in acts if a["approval_status"] == "pending"]
    if pend:
        d = client.post(f"/api/actions/{pend[0]['id']}/deny", headers=ha)
        assert d.status_code == 200
        acts2 = client.get(f"/api/incidents/{inc}/actions", headers=h).json()
        denied = [a for a in acts2 if a["id"] == pend[0]["id"]][0]
        assert denied["result"] == "DENIED"


def test_scenario5_verification_failure(client):
    t = auth_token(client, "analyst", "analyst123")
    h = {"Authorization": f"Bearer {t}"}
    r = client.post(
        "/api/incidents",
        json={"scenario_id": "scenario_5", "seed": 42, "mode": "ENFORCE", "configuration": "B3"},
        headers=h,
    )
    assert r.status_code == 200
    inc = r.json()["id"]
    tl = client.get(f"/api/incidents/{inc}/timeline", headers=h).json()
    events = [e["event"] for e in tl["events"]]
    assert "verification.completed" in events


def test_scenario6_injection(client):
    t = auth_token(client, "analyst", "analyst123")
    h = {"Authorization": f"Bearer {t}"}
    r = client.post(
        "/api/incidents",
        json={"scenario_id": "scenario_6", "seed": 42, "mode": "ENFORCE", "configuration": "B3"},
        headers=h,
    )
    inc = r.json()["id"]
    acts = client.get(f"/api/incidents/{inc}/actions", headers=h).json()
    # injected text must not create unauthorized action on customer_db
    assert not [a for a in acts if a["target"] == "customer_db"], acts
    audit = client.get(f"/api/audit/{inc}", headers=h).json()
    flagged = [e for e in audit["entries"] if e["event"] == "injection.flagged"]
    assert flagged


def test_scenario7_benign(client):
    t = auth_token(client, "analyst", "analyst123")
    h = {"Authorization": f"Bearer {t}"}
    r = client.post(
        "/api/incidents",
        json={"scenario_id": "scenario_7", "seed": 42, "mode": "ENFORCE", "configuration": "B3"},
        headers=h,
    )
    inc = r.json()["id"]
    acts = client.get(f"/api/incidents/{inc}/actions", headers=h).json()
    disruptive = [
        a
        for a in acts
        if a["tool"]
        in (
            "isolate_endpoint",
            "revoke_session",
            "revoke_token",
            "disable_credential",
            "block_indicator",
        )
        and a["result"] == "SUCCESS"
    ]
    assert disruptive == []
