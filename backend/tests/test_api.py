"""Auth/RBAC, SSE ticket, health, openapi, benchmark smoke."""

from __future__ import annotations

from tests.conftest import auth_token


def test_auth_and_rbac(client):
    # viewer cannot create incidents
    t = auth_token(client, "viewer", "viewer123")
    r = client.post(
        "/api/incidents",
        json={"scenario_id": "scenario_1"},
        headers={"Authorization": f"Bearer {t}"},
    )
    assert r.status_code == 403
    # analyst can
    t = auth_token(client, "analyst", "analyst123")
    r = client.post(
        "/api/incidents",
        json={"scenario_id": "scenario_1", "seed": 1001},
        headers={"Authorization": f"Bearer {t}"},
    )
    assert r.status_code == 200
    # me
    m = client.get("/api/me", headers={"Authorization": f"Bearer {t}"}).json()
    assert m["role"] == "analyst"


def test_health_openapi(client):
    assert client.get("/api/health").json()["api"] == "ok"
    spec = client.get("/openapi.json").json()
    assert "/api/incidents" in str(spec)
    assert client.get("/docs").status_code == 200
    # bad SSE ticket rejected
    r = client.get("/api/stream/incidents/INC-1?ticket=nope")
    assert r.status_code in (401, 422)


def test_sse_ticket_flow(client):
    t = auth_token(client, "viewer", "viewer123")
    h = {"Authorization": f"Bearer {t}"}
    r = client.post("/api/stream/ticket", headers=h)
    assert r.status_code == 200 and "ticket" in r.json()


def test_benchmark_smoke(client):
    t = auth_token(client, "analyst", "analyst123")
    h = {"Authorization": f"Bearer {t}"}
    r = client.post("/api/benchmark/run", headers=h)
    assert r.status_code == 200, r.text[:500]
    lst = client.get("/api/benchmark", headers=h).json()
    assert lst and lst[0]["metrics"]["B3"]
