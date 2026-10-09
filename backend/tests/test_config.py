"""Production configuration validation + authentication edge cases.

Pure Settings tests construct Settings directly (no global cache pollution).
API tests use the seeded demo users on the isolated test database.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import jwt as _jwt
import pytest

from app.config import KNOWN_DEFAULT_SECRETS, Settings, validate_settings

TEST_SECRET = os.environ.get("JWT_SECRET", "test-secret-min-32-chars-1234567890")


def test_short_secret_rejected_everywhere():
    with pytest.raises(RuntimeError, match="at least 32 characters"):
        validate_settings(Settings(JWT_SECRET="short", APP_ENV="development"))
    with pytest.raises(RuntimeError, match="at least 32 characters"):
        validate_settings(
            Settings(JWT_SECRET="short", APP_ENV="production", DEMO_MODE=False)
        )


def test_known_default_secrets_rejected_in_production():
    for default in KNOWN_DEFAULT_SECRETS:
        with pytest.raises(RuntimeError, match="known development default"):
            validate_settings(
                Settings(JWT_SECRET=default, APP_ENV="production", DEMO_MODE=False)
            )


def test_unset_secret_rejected_in_production(monkeypatch):
    # With no JWT_SECRET anywhere, the code default applies: production must
    # reject it as "not explicitly supplied", not merely length-check it.
    monkeypatch.delenv("JWT_SECRET", raising=False)
    # Falls back to the code default, which is itself a known development
    # default: production must reject it either way.
    with pytest.raises(RuntimeError, match="known development default"):
        validate_settings(Settings(APP_ENV="production", DEMO_MODE=False))


def test_env_supplied_secret_accepted_in_production():
    # The test-suite secret comes from the environment (conftest), is not a
    # known default, and satisfies length: production accepts it.
    assert TEST_SECRET not in KNOWN_DEFAULT_SECRETS and len(TEST_SECRET) >= 32
    validate_settings(Settings(APP_ENV="production", DEMO_MODE=False))


def test_valid_production_secret_accepted():
    validate_settings(
        Settings(JWT_SECRET="a" * 40, APP_ENV="production", DEMO_MODE=False)
    )


def test_demo_mode_rejected_in_production():
    with pytest.raises(RuntimeError, match="DEMO_MODE must be false"):
        validate_settings(
            Settings(JWT_SECRET="b" * 40, APP_ENV="production", DEMO_MODE=True)
        )


def test_development_demo_setup_still_valid():
    # The documented synthetic demo keeps working with dev defaults.
    validate_settings(Settings(APP_ENV="development", DEMO_MODE=True))


def test_expired_token_rejected(client):
    past = datetime.now(timezone.utc) - timedelta(seconds=60)
    token = _jwt.encode(
        {"sub": "analyst", "role": "analyst", "exp": past},
        TEST_SECRET,
        algorithm="HS256",
    )
    r = client.get("/api/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401
    assert r.json()["code"] == "unauthenticated"


def test_wrong_signature_rejected(client):
    future = datetime.now(timezone.utc) + timedelta(seconds=3600)
    token = _jwt.encode(
        {"sub": "analyst", "role": "analyst", "exp": future},
        "wrong-secret-not-the-server-one-1234",
        algorithm="HS256",
    )
    r = client.get("/api/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_role_comes_from_server_identity_not_token_claim(client):
    # A viewer presenting a token that *claims* admin must still be a viewer:
    # authorization derives from the DB row, never the token's role claim.
    future = datetime.now(timezone.utc) + timedelta(seconds=3600)
    token = _jwt.encode(
        {"sub": "viewer", "role": "admin", "exp": future},
        TEST_SECRET,
        algorithm="HS256",
    )
    h = {"Authorization": f"Bearer {token}"}
    me = client.get("/api/me", headers=h)
    assert me.status_code == 200
    assert me.json()["role"] == "viewer"
    # admin-only operation stays forbidden despite the forged claim.
    r = client.post("/api/system/mode", json={"mode": "SHADOW"}, headers=h)
    assert r.status_code == 403
