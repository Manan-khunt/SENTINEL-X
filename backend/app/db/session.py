"""DB session: SQLite WAL, session factory."""

from __future__ import annotations

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.db.tables import Base


def _db_url() -> str:
    return get_settings().DATABASE_URL


_engine = None
_SessionLocal = None


def get_engine():
    global _engine
    if _engine is not None:
        return _engine
    url = _db_url()
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    _engine = create_engine(url, connect_args=connect_args, future=True)

    if url.startswith("sqlite"):

        @event.listens_for(_engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, connection_record):  # noqa: ANN
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("PRAGMA foreign_keys=ON;")
            cursor.close()

    return _engine


def get_session_factory():
    global _SessionLocal
    if _SessionLocal is None:
        # First-use gate: lifespan calls init_db()/seed_db() explicitly,
        # but ASGI servers differ in lifespan handling, so first engine
        # use also guarantees a usable database. All steps are idempotent
        # (validated config, checkfirst DDL, IF NOT EXISTS triggers,
        # existence-checked seed rows).
        from app.config import validate_settings as _validate

        from app.db.seed import seed_db as _seed

        _validate(get_settings())
        init_db()
        _SessionLocal = sessionmaker(
            bind=get_engine(), autoflush=False, expire_on_commit=False, future=True
        )
        _db = _SessionLocal()
        try:
            _seed(_db)
        finally:
            _db.close()
    return _SessionLocal


def init_db() -> None:
    from sqlalchemy import text as _text

    from app.db import tables as _t  # noqa: F401

    Base.metadata.create_all(bind=get_engine())
    # Insert-only triggers must exist even on pre-existing DB files where
    # create_all skips table creation (DDL after_create would not fire).
    with get_engine().begin() as conn:
        conn.execute(
            _text(
                "CREATE TRIGGER IF NOT EXISTS audit_log_no_update "
                "BEFORE UPDATE ON audit_log BEGIN "
                "SELECT RAISE(ABORT, 'audit_log is insert-only: UPDATE blocked'); END"
            )
        )
        conn.execute(
            _text(
                "CREATE TRIGGER IF NOT EXISTS audit_log_no_delete "
                "BEFORE DELETE ON audit_log BEGIN "
                "SELECT RAISE(ABORT, 'audit_log is insert-only: DELETE blocked'); END"
            )
        )


def get_db():
    Session = get_session_factory()
    db = Session()
    try:
        yield db
    finally:
        db.close()


def reset_engine_for_tests() -> None:
    global _engine, _SessionLocal
    _engine = None
    _SessionLocal = None
