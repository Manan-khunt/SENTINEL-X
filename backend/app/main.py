"""SENTINEL-X FastAPI application."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import benchmark as _benchmark
from app.api import extra as _extra
from app.api import incidents as _incidents
from app.api import system as _system
from app.config import VERSION, get_settings
from app.db.seed import seed_db
from app.db.session import get_session_factory, init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db = get_session_factory()()
    try:
        seed_db(db)
    finally:
        db.close()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="SENTINEL-X",
        version=VERSION,
        description="Autonomous Adaptive Cyberattack Response Agent",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.FRONTEND_ORIGIN],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(_system.router, prefix="/api", tags=["system"])
    app.include_router(_incidents.router, prefix="/api", tags=["incidents"])
    app.include_router(_extra.router, prefix="/api", tags=["audit-stream"])
    app.include_router(_benchmark.router, prefix="/api", tags=["benchmark"])
    return app


app = create_app()
