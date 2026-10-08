"""Shared pytest fixtures: isolated SQLite DB + TestClient."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ["DATABASE_URL"] = "sqlite:///./test_sentinelx.db"
os.environ["JWT_SECRET"] = "test-secret-min-32-chars-1234567890"
os.environ["ANCHOR_PATH"] = "./test_audit_anchors.jsonl"
os.environ["AUDIT_ANCHOR_EVERY"] = "1000000"

from app.config import get_settings as _gs  # noqa: E402

_gs.cache_clear()

from app.db import session as _sess  # noqa: E402
from app.db.seed import seed_db  # noqa: E402
from app.db.tables import Base  # noqa: E402

TEST_URL = "sqlite:///./test_sentinelx.db"

_TRIGGER_DDLS = (
    "CREATE TRIGGER IF NOT EXISTS audit_log_no_update "
    "BEFORE UPDATE ON audit_log BEGIN "
    "SELECT RAISE(ABORT, 'audit_log is insert-only: UPDATE blocked'); END",
    "CREATE TRIGGER IF NOT EXISTS audit_log_no_delete "
    "BEFORE DELETE ON audit_log BEGIN "
    "SELECT RAISE(ABORT, 'audit_log is insert-only: DELETE blocked'); END",
)


def _wipe_test_files() -> None:
    for f in (
        "./test_sentinelx.db",
        "./test_sentinelx.db-wal",
        "./test_sentinelx.db-shm",
        "./test_audit_anchors.jsonl",
    ):
        try:
            os.remove(f)
        except OSError:
            pass


def _ensure_audit_triggers(eng) -> None:
    from sqlalchemy import text as _text

    with eng.begin() as conn:
        for ddl in _TRIGGER_DDLS:
            conn.execute(_text(ddl))


@pytest.fixture()
def db():
    # Dispose any pooled connections first: on Windows an open SQLite
    # handle blocks file removal, which would silently reuse a stale DB
    # (e.g. one whose triggers a previous test dropped).
    try:
        if _sess._engine is not None:
            _sess._engine.dispose()
    except Exception:
        pass
    _wipe_test_files()
    _sess.reset_engine_for_tests()
    eng = create_engine(TEST_URL, connect_args={"check_same_thread": False}, future=True)
    _sess._engine = eng
    _sess._SessionLocal = sessionmaker(
        bind=eng, autoflush=False, expire_on_commit=False, future=True
    )
    Base.metadata.create_all(bind=eng)
    _ensure_audit_triggers(eng)
    S = _sess.get_session_factory()()
    seed_db(S)
    yield S
    S.close()
    try:
        eng.dispose()
    except Exception:
        pass
    _wipe_test_files()


@pytest.fixture()
def client(db):
    from app.main import create_app

    app = create_app()
    # lifespan already ran against dev DB; ensure seed on test engine done via db fixture
    with TestClient(app) as c:
        yield c


def auth_token(client: TestClient, username: str, password: str) -> str:
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]
