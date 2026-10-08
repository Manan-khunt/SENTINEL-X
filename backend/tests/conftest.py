"""Shared pytest fixtures: isolated SQLite DB + TestClient."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ["DATABASE_URL"] = "sqlite:///./test_sentinelx.db"
os.environ["JWT_SECRET"] = "test-secret-min-32-chars-1234567890"

from app.db import session as _sess  # noqa: E402
from app.db.seed import seed_db  # noqa: E402
from app.db.tables import Base  # noqa: E402

TEST_URL = "sqlite:///./test_sentinelx.db"


@pytest.fixture()
def db():
    try:
        os.remove("./test_sentinelx.db")
    except OSError:
        pass
    _sess.reset_engine_for_tests()
    eng = create_engine(TEST_URL, connect_args={"check_same_thread": False}, future=True)
    _sess._engine = eng
    _sess._SessionLocal = sessionmaker(
        bind=eng, autoflush=False, expire_on_commit=False, future=True
    )
    Base.metadata.create_all(bind=eng)
    S = _sess.get_session_factory()()
    seed_db(S)
    yield S
    S.close()
    try:
        os.remove("./test_sentinelx.db")
    except OSError:
        pass


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
