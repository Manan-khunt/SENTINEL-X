"""Developer-experience suite: OpenAPI, health/diagnostics, request IDs,
error envelopes, auth/RBAC, DB diagnostics, audit verification, contracts."""

from __future__ import annotations

from tests.conftest import auth_token

REQUIRED_TAGS = {
    "Authentication",
    "System Health",
    "Scenarios",
    "Incidents",
    "Attack Graph",
    "Agent Operations",
    "Actions and Approvals",
    "Audit",
    "Benchmarks",
    "Event Streaming",
}


def _bearer(t: str) -> dict:
    return {"Authorization": f"Bearer {t}"}


def test_openapi_branding_and_tags(client):
    spec = client.get("/openapi.json").json()
    info = spec["info"]
    assert "SENTINEL-X" in info["title"]
    assert info["version"] == "3.0.0"
    assert "SENTINEL-X" in info["description"]
    tags = {t["name"] for t in spec.get("tags", [])}
    assert REQUIRED_TAGS <= tags
    paths = spec["paths"]
    assert "/api/auth/login" in paths
    assert "/api/health/detailed" in paths
    assert "/api/incidents/{incident_id}/agent-trace" in paths
    assert "/api/audit/verify" in paths
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200


def test_health_contract_and_detailed(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    # Frozen frontend contract keys.
    assert set(body) == {"api", "database", "environment", "agent", "version"}
    assert body["api"] == "ok"
    assert "X-Request-ID" in r.headers

    d = client.get("/api/health/detailed").json()
    assert d["status"] in ("healthy", "degraded", "unavailable")
    for key in ("api", "database", "agent", "environment_simulator", "event_streaming"):
        assert key in d["checks"]
        assert d["checks"][key]["status"] in ("healthy", "degraded", "unavailable")
    # No secrets or filesystem paths leak.
    blob = str(d).lower()
    assert "jwt" not in blob and "secret" not in blob
    assert d["checks"]["database"]["status"] == "healthy"


def test_request_id_behaviour(client):
    r1 = client.get("/api/health")
    rid1 = r1.headers.get("X-Request-ID")
    assert rid1 and len(rid1) >= 8
    r2 = client.get("/api/health")
    assert r2.headers["X-Request-ID"] != rid1  # unique per request

    r = client.get("/api/health", headers={"X-Request-ID": "client-trace-001"})
    assert r.headers["X-Request-ID"] == "client-trace-001"

    # Unsafe client IDs are replaced, never echoed.
    r = client.get("/api/health", headers={"X-Request-ID": "bad id!! <script>"})
    assert r.headers["X-Request-ID"] != "bad id!! <script>"
    assert "X-Request-ID" in r.headers


def test_error_envelope_preserves_detail(client):
    t = auth_token(client, "analyst", "analyst123")
    r = client.get("/api/incidents/INC-999999", headers=_bearer(t))
    assert r.status_code == 404
    body = r.json()
    assert body["detail"]  # frontend reads .detail
    assert body["code"] == "not_found"
    assert body["request_id"]
    assert "traceback" not in str(body).lower()

    # Validation failures use correct status + safe details.
    r = client.post("/api/auth/login", json={"username": "x"})
    assert r.status_code == 422
    assert r.json()["code"] == "validation_failed"
    assert r.json()["detail"]

    # Auth failures.
    assert client.get("/api/incidents").status_code == 401
    assert client.get("/api/incidents").json()["code"] == "unauthenticated"
    viewer = auth_token(client, "viewer", "viewer123")
    r = client.post("/api/incidents", json={"scenario_id": "scenario_1"}, headers=_bearer(viewer))
    assert r.status_code == 403
    assert r.json()["code"] == "forbidden"


def test_auth_roles_and_secrets_safe(client):
    r = client.post("/api/auth/login", json={"username": "analyst", "password": "analyst123"})
    assert r.status_code == 200
    assert "password" not in str(r.json()).lower()
    me = client.get("/api/me", headers=_bearer(r.json()["access_token"])).json()
    assert me["role"] == "analyst"
    assert "password_hash" not in me


def test_incident_action_contract(client):
    t = auth_token(client, "analyst", "analyst123")
    h = _bearer(t)
    inc = client.post(
        "/api/incidents",
        json={"scenario_id": "scenario_1", "seed": 7, "mode": "ENFORCE", "configuration": "B3"},
        headers=h,
    ).json()
    assert inc["id"].startswith("INC-")
    det = client.get(f"/api/incidents/{inc['id']}", headers=h).json()
    assert (
        det["graph_version"]
        == client.get(f"/api/incidents/{inc['id']}/graph", headers=h).json()["version"]
    )
    paths = client.get(f"/api/incidents/{inc['id']}/paths", headers=h).json()
    assert "paths" in paths and "status" in paths
    acts = client.get(f"/api/incidents/{inc['id']}/actions", headers=h).json()
    assert acts
    trace = client.get(f"/api/incidents/{inc['id']}/agent-trace", headers=h).json()
    assert trace["incident_id"] == inc["id"]
    assert set(trace["actions"]) == {"proposed", "approved", "executed", "verified_outcomes"}
    assert "verification" in trace and "replanning" in trace


def test_audit_verification_terms(client):
    t = auth_token(client, "analyst", "analyst123")
    h = _bearer(t)
    v = client.get("/api/audit/verify", headers=h).json()
    assert v["ok"] is True
    assert v["status"] == "INTACT"
    assert v["broken_at"] is None
    one = client.get("/api/audit", headers=h).json()
    assert isinstance(one, list)
