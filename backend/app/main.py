"""SENTINEL-X FastAPI application."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import benchmark as _benchmark
from app.api import extra as _extra
from app.api import incidents as _incidents
from app.api import system as _system
from app.config import VERSION, describe_settings_safe, get_settings, validate_settings
from app.core.errors import register_error_handlers
from app.core.logging_config import get_logger
from app.core.middleware import RequestContextMiddleware
from app.db.seed import seed_db
from app.db.session import get_session_factory, init_db

log = get_logger("sentinelx.startup")

OPENAPI_TAGS = [
    {
        "name": "Authentication",
        "description": (
            "Login (JWT bearer) and current-user identity. "
            "Roles: viewer < analyst < approver < admin."
        ),
    },
    {
        "name": "System Health",
        "description": (
            "Liveness, readiness, and non-destructive diagnostics. "
            "No secrets or filesystem paths are exposed."
        ),
    },
    {
        "name": "Scenarios",
        "description": (
            "Synthetic enterprise scenarios (scenario_1..scenario_7) "
            "used to seed incidents."
        ),
    },
    {
        "name": "Incidents",
        "description": (
            "Create, inspect, and step incident investigations. "
            "Containment is only reported after verification."
        ),
    },
    {
        "name": "Attack Graph",
        "description": (
            "NetworkX snapshots, active attack paths, "
            "and path status (ACTIVE/BLOCKED/SAFE)."
        ),
    },
    {
        "name": "Agent Operations",
        "description": (
            "Agent loop visibility: OBSERVE -> VERIFY -> REPLAN. "
            "Read-only traces; changes flow via the tool gateway."
        ),
    },
    {
        "name": "Actions and Approvals",
        "description": (
            "HIGH-risk actions pause at AWAITING_APPROVAL. "
            "Approver+ decides; analyst+ may undo reversible ones."
        ),
    },
    {
        "name": "Audit",
        "description": (
            "Tamper-evident (not tamper-proof) SHA-256 hash chain "
            "with external anchors. History is append-only."
        ),
    },
    {
        "name": "Benchmarks",
        "description": (
            "Deterministic batches (B0/B1/B2/B3) "
            "with Wilson 95% CIs and Fisher comparisons."
        ),
    },
    {
        "name": "Event Streaming",
        "description": (
            "Short-lived SSE tickets plus per-incident events. "
            "Clients dedupe on SSE id and reconnect to resync."
        ),
    },
]

DESCRIPTION = """## SENTINEL-X — Autonomous Adaptive Cyberattack Response Agent

**"The attacker changes the attack. Our agent changes the defense."**

Hackathon MVP for **InnoHacks 4.0** (Agentic AI): detection does not guarantee
containment. The agent runs
`OBSERVE -> PLAN -> DRY-RUN -> RISK -> POLICY -> TOOL -> VERIFY -> REPLAN`
with adaptive attack-path replanning when the adversary pivots.

### How to use this API
1. `POST /api/auth/login` with a demo account (`viewer/viewer123`,
   `analyst/analyst123`, `approver/approver123`, `admin/admin123`).
2. Send `Authorization: Bearer <token>` on every protected call.
3. Create an incident: `POST /api/incidents` (`analyst`+).
4. Inspect `/graph`, `/paths`, `/timeline`, `/actions`, `/replay`, `/agent-trace`.
5. Approve HIGH-risk actions as `approver`+; verify containment via the
   independent ground-truth verifier (never trust an action request alone).
6. Review the tamper-evident audit chain at `/api/audit` and `/api/audit/verify`.

### Cross-cutting behavior
- **Auth:** JWT bearer. `401` missing/invalid token, `403` insufficient role,
  `423` system halted (kill switch). Required roles are listed per endpoint.
- **Request IDs:** send optional `X-Request-ID` (8-64 chars, `[A-Za-z0-9-_.]`);
  the server echoes a safe ID in every response header and error body for log correlation.
- **Errors:** `{detail, code, request_id}` plus optional `errors[]` for 422.
  `detail` is always a human-readable string (frontend-compatible). No stack
  traces, secrets, or tokens are ever returned.
- **SSE:** `POST /api/stream/ticket` (`120s` TTL), then
  `GET /api/stream/incidents/{id}?ticket=...`. History replays on connect.
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    validate_settings(settings)
    log.info("starting SENTINEL-X", extra={})
    # Log shapes only — never secret values.
    log.info("config: %s", describe_settings_safe(settings))
    init_db()
    db = get_session_factory()()
    try:
        seed_db(db)
    finally:
        db.close()
    log.info("SENTINEL-X ready version=%s provider=%s", VERSION, settings.LLM_PROVIDER)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="SENTINEL-X — Autonomous Cyberattack Response API",
        summary="Agentic SOC backend: adaptive containment with verified outcomes.",
        description=DESCRIPTION,
        version=VERSION,
        openapi_tags=OPENAPI_TAGS,
        contact={"name": "SENTINEL-X Team 404 Founder — InnoHacks 4.0"},
        license_info={"name": "Hackathon MVP — synthetic environment only"},
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        swagger_ui_parameters={"persistAuthorization": True, "displayRequestDuration": True},
    )
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.FRONTEND_ORIGIN],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_error_handlers(app)
    # Routers declare their own per-endpoint tags; no blanket tag override here.
    app.include_router(_system.router, prefix="/api")
    app.include_router(_incidents.router, prefix="/api")
    app.include_router(_extra.router, prefix="/api")
    app.include_router(_benchmark.router, prefix="/api")

    @app.get("/", tags=["System Health"], summary="Service landing")
    def root():
        """Lightweight landing pointer (no external dependencies)."""
        return {
            "service": "SENTINEL-X",
            "version": VERSION,
            "docs": "/docs",
            "openapi": "/openapi.json",
            "health": "/api/health",
            "diagnostics": "/api/health/detailed",
        }

    return app


app = create_app()
