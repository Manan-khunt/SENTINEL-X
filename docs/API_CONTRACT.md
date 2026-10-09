# SENTINEL-X — Frontend/Backend Integration Contract Map

**Baseline:** live FastAPI backend (`backend/app/`), verified against
`GET /openapi.json` on the running server (`uvicorn app.main:app`, port 8000).
The frontend calls the backend through one centralized typed client
(`frontend/src/api.ts`). No endpoint below is assumed — every row was
tested against the live implementation.

- Backend base URL: `http://localhost:8000` (all routes mounted under `/api`)
- Frontend dev URL: `http://localhost:5173` (Vite dev server proxies `/api` → `http://localhost:8000`)
- CORS: `FRONTEND_ORIGIN` (default `http://localhost:5173`), credentials allowed, no wildcards
- Auth: JWT (HS256) from `POST /api/auth/login`, sent as `Authorization: Bearer <token>`.
  Token lives in browser memory only (never localStorage). Role comes from `GET /api/me`.

## API Contract Map

| Frontend feature | Endpoint | Method | Auth | Request schema | Response schema | Required role | Loading/error behavior | Status |
|---|---|---|---|---|---|---|---|---|
| Login | `/api/auth/login` | POST | none | `{username: str, password: str}` | `{access_token: str, token_type: "bearer"}` | any seeded user | 401 "invalid credentials" → login form error | PASS |
| Current user | `/api/me` | GET | Bearer | — | `{id, username, role}` | any | 401 → session cleared, redirect to /login | PASS |
| Health | `/api/health` | GET | none | — | `{api, database, environment, agent, version}` | — | network error → TopBar "DISCONNECTED" | PASS |
| Scenario listing | `/api/scenarios` | GET | Bearer | — | `[{id, name, description}]` (ids: `scenario_1`…`scenario_7`) | viewer+ | error → ErrorBox with retry | PASS |
| Incident creation | `/api/incidents` | POST | Bearer | `{scenario_id, seed, mode, configuration}` (`Configuration` = B0\|B1\|B2\|B3) | `IncidentOut` | analyst+ | 423 when kill switch active → error banner; 403 for viewer | PASS |
| Incident listing | `/api/incidents` | GET | Bearer | — | `IncidentOut[]` | viewer+ | error → ErrorBox with retry | PASS |
| Incident details | `/api/incidents/{id}` | GET | Bearer | — | `IncidentOut` | viewer+ | 404 → ErrorBox | PASS |
| Attack graph | `/api/incidents/{id}/graph` | GET | Bearer | — | `{version, nodes[{id,type,criticality,protected}], edges[{src,dst,kind}]}`; isolated nodes/edges excluded | viewer+ | error → ErrorBox, last confirmed state kept | PASS |
| Attack paths | `/api/incidents/{id}/paths` | GET | Bearer | — | `{paths: [{nodes: str[], state}], status: "ACTIVE"\|"SAFE"}` | viewer+ | error → inline error in footer strip | PASS |
| Incident timeline | `/api/incidents/{id}/timeline` | GET | Bearer | — | `{steps: [{phase, payload}], events: [{event, actor, payload}]}` | viewer+ | error → ErrorBox with retry | PASS |
| Action listing | `/api/incidents/{id}/actions` | GET | Bearer | — | `ActionOut[]` (`{id, tool, target, reason, reversible, risk_score, risk_tier, approval_status, result, undo_of, undone, created_at}`) | viewer+ | error → ErrorBox | PASS |
| Action proof | `/api/incidents/{id}/proof/{action_id}` | GET | Bearer | — | `ActionProof` (`{incident, agent, threat, target, action, reason, risk, criticality, blast, irreversibility, uncertainty, dry_run, approval, reversible, undo, result, log_hash, previous_hash}`) | viewer+ | 404 → ErrorBox | PASS |
| Action approve | `/api/actions/{action_id}/approve` | POST | Bearer | — | `{status: "approved", action}` | approver+ | 403 for analyst; 400/404 on stale approval → error text | PASS |
| Action deny | `/api/actions/{action_id}/deny` | POST | Bearer | — | `{status: "denied", action}` | approver+ | 403 for analyst → error text | PASS |
| Action undo | `/api/actions/{action_id}/undo` | POST | Bearer | — | `{status: "undone", action}` | analyst+ (HIGH-risk undo requires approver/admin) | 400 "not reversible or already undone"; 403 high-risk → error text | PASS |
| Step incident | `/api/incidents/{id}/step` | POST | Bearer | — | `IncidentOut` | analyst+ | 404 → error text; runs one agent cycle | PASS |
| Replay material | `/api/incidents/{id}/replay` | GET | Bearer | — | `{incident_id, events: [{id, event, hash, previous_hash}]}` | viewer+ | error → ErrorBox | PASS |
| Shadow/Enforce mode | `/api/system/mode` | GET/POST | Bearer | POST `{mode: "ENFORCE"\|"SHADOW"}` | `{mode}` | GET viewer+; POST admin only | 403 for non-admin → control hidden + server enforcement | PASS |
| Kill switch | `/api/system/kill-switch` | POST | Bearer | — | `{status: "HALTED"}` | approver+ | 403 for analyst → hidden; writes audit `system.halted` | PASS |
| Resume | `/api/system/resume` | POST | Bearer | — | `{status: "RUNNING"}` | approver+ | 403 → hidden; writes audit `system.resumed` | PASS |
| System status | `/api/system/status` | GET | Bearer | — | `{status, version}` | viewer+ | error → ErrorBox | PASS |
| Audit events | `/api/audit` | GET | Bearer | — | `AuditRecord[]` (latest 200, desc) | viewer+ | error → ErrorBox | PASS |
| Audit per incident | `/api/audit/{incident_id}` | GET | Bearer | — | `{incident_id, chain, entries: AuditRecord[]}` | viewer+ | error → ErrorBox | PASS |
| Audit chain verification | `/api/audit/verify?incident_id=` | GET | Bearer | — | `{ok, status, broken_at, incident_id}` | viewer+ | verdict computed server-side only | PASS |
| Benchmark list | `/api/benchmark` | GET | Bearer | — | `BenchmarkBatch[]` (`{batch_id, status, metrics: {B0..B3}, comparison}`) | viewer+ | error → ErrorBox; empty → "No batches yet" | PASS |
| Benchmark per config | `/api/benchmark/{configuration}` | GET | Bearer | — | `[{batch_id, metrics}]` | viewer+ | 404 unknown configuration | PASS |
| Benchmark run | `/api/benchmark/run` | POST | Bearer | — | `{batch_id, status: "DONE"}` | analyst+ | 403 for viewer → hidden | PASS |
| SSE ticket | `/api/stream/ticket` | POST | Bearer | — | `{ticket: str, expires_at: ISO8601}` (TTL = `SSE_TICKET_TTL`, default 120s) | viewer+ | failure → SSE state RECONNECTING with backoff | PASS |
| Incident event stream | `/api/stream/incidents/{id}?ticket=` | GET (SSE) | ticket (NOT the JWT) | — | `text/event-stream`; fields `id`, `event`, `data`; ends with `event: done` after ~30s window | valid ticket | 401 bad/expired ticket → reconnect with fresh ticket | PASS |

## SSE event types published by the orchestrator

`incident.started`, `agent.step`, `plan.created`, `dry_run.completed`,
`graph.updated`, `graph.diff`, `adversary.action`, `incident.replanned`,
`verification.completed`, `action.approved`, `action.denied`,
`action.executed`, `incident.contained`, `incident.failed`,
`incident.escalated`, `incident.halted`, `injection.flagged` (audit-only).

Each event carries a server-side monotonically increasing `id`; the
frontend dedupes on `eventType:id` because the backend replays buffered
history on every (re)connect.

## Discrepancies found vs. legacy frontend mock shapes (resolved)

| Legacy mock | Real backend | Resolution |
|---|---|---|
| Scenario ids `scenario-1`…`scenario-7` | `scenario_1`…`scenario_7` (underscore) | Frontend uses backend ids verbatim |
| Incident statuses `INVESTIGATING`/`PLANNING`/`EXECUTING` | `RUNNING`/`AWAITING_APPROVAL`/`CONTAINED`/`ESCALATED`/`FAILED`/`HALTED` | Frontend renders backend status verbatim |
| `GET /incidents/{id}/stream` | `GET /stream/incidents/{id}?ticket=` | Client uses real route + ticket flow |
| Ticket response `expiresInSeconds` | `expires_at` ISO8601 | Client ignores expiry, reconnects on error |
| Graph nodes `{id,label,type,status,...}` | `{id, type, criticality, protected}` | Graph component maps real fields |
| Edges `{id,source,target,relationship,status}` | `{src, dst, kind}` (+ optional `via`) | Graph component maps real fields |
| Demo incident list with fabricated hashes | No fallback; failures propagate | Error states shown instead of fake data |

## Runtime configuration

`.env` (backend): `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRY`,
`LLM_PROVIDER` (`mock`\|`replay`\|`anthropic`), `FRONTEND_ORIGIN`,
`SSE_TICKET_TTL`, `ANCHOR_PATH`, `AUDIT_ANCHOR_EVERY`.

`.env` (frontend): `VITE_API_BASE_URL=/api` (proxied by Vite in dev).

Startup:
```
cd backend && python -m uvicorn app.main:app --port 8000
cd frontend && npm run dev          # http://localhost:5173
```

Production: `docker compose up --build` serves backend on :8000 and the
built frontend on :5173.
