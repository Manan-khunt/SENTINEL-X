# TRD: Technical Requirements and Architecture

**Purpose:** removes guessing about *how* SENTINEL-X is built. If a technical choice is not here, ask before deciding, then record it in the Decision Log (`RULES.md`).

---

## 1. Tech stack (fixed)

| Layer | Choice | Notes |
|---|---|---|
| Language (backend) | Python 3.11+ | Type hints everywhere |
| API framework | FastAPI + Uvicorn | REST + SSE |
| Schemas / validation | Pydantic v2 | State, plan, tool args, API models |
| Graph | NetworkX | Path enumeration, graph diff |
| Database | SQLite (WAL mode) via SQLAlchemy 2.x | Incidents, snapshots, audit log, benchmark |
| Auth | JWT (HS256) + bcrypt passwords | Roles in `SCHEMA.md` |
| LLM | Behind `LLMAdapter`; default Anthropic Claude via API; `ReplayAdapter` and `MockAdapter` for tests/benchmark | Model name from env `LLM_MODEL` |
| Frontend | React 18 + TypeScript + Vite | |
| Styling | Tailwind CSS only (see `DESIGN.md`) | No other CSS framework |
| Graph UI | Cytoscape.js (`react-cytoscapejs`) | Static layout + status colors |
| Live updates | Server-Sent Events (`EventSource`) | One stream per incident |
| Frontend state/data | TanStack Query (REST) + a small SSE store (Zustand) | |
| Testing | pytest (+ `httpx` for API), Vitest for UI logic | |
| Lint/format | Ruff + Black (Python), ESLint + Prettier (TS) | |
| Packaging | Docker Compose | `backend`, `frontend` services |
| Package managers | `uv` or `pip` + `requirements.txt` (backend); `npm` (frontend) | Pin versions in lockfiles |

**Not used (do not add):** Redis, Postgres, Celery, Kafka, microservices, multiple LLM vendors at once, any real firewall/EDR integration.

---

## 2. System architecture

```text
                      ┌───────────────────────── Browser ──────────────────────────┐
                      │ React dashboard: graph · timeline · approvals · evaluation  │
                      └───────────────▲──────────────────────────┬──────────────────┘
                                 SSE (events)               REST (commands)
                      ┌───────────────┴──────────────────────────▼──────────────────┐
                      │                    FastAPI (api layer)                       │
                      │   auth/roles · incident routes · approvals · benchmark       │
                      └───────────────┬──────────────────────────────────────────────┘
                                      │
     ┌────────────────────────────────▼─────────────────────────────────────────────┐
     │                            Orchestrator (agent loop)                          │
     │  OBSERVE → REASON → PLAN → DRY-RUN → RISK → TOOL CALL → OBSERVE → VERIFY      │
     └──┬──────────┬───────────────┬────────────────┬──────────────┬────────────────┘
        │          │               │                │              │
   Sanitizer   LLM Adapter    Attack Graph      Planner +      Verifier
 (untrusted    (JSON-schema   Engine            dry-run        (ground truth)
  → quoted)     constrained)  (NetworkX)        simulate_action
        │                          │                │
        │                          └───────┬────────┘
        │                                  ▼
        │                    Risk scorer + Policy gateway ──► Human approval queue
        │                                  │
        │                                  ▼
        │                        Tool Gateway (single choke point)
        │                  schema · target-exists · idempotency · rate limit · undo
        │                                  │
        ▼                                  ▼
   Environment simulator  ◄────── Tools (investigate / respond / verify) ────────
   (synthetic enterprise)
        ▲
        │ reacts to open paths (seeded)
   Reactive Adversary Simulator

   Cross-cutting: Audit log (hash-chained, SQLite) → anchor store (separate, append-only)
```

**Golden rule:** the LLM only proposes JSON plans. It has no handle to the environment. Everything executable goes through the Tool Gateway.

---

## 3. Repository layout

```text
sentinel-x/
├─ docs/                      # this documentation pack
├─ backend/
│  ├─ app/
│  │  ├─ main.py              # FastAPI app factory, router includes
│  │  ├─ config.py            # env settings (pydantic-settings)
│  │  ├─ api/                 # routes: auth, incidents, actions, system, audit, benchmark, stream
│  │  ├─ core/
│  │  │  ├─ models.py         # Pydantic: IncidentState, Plan, ToolCall, Action, RiskResult
│  │  │  ├─ sanitizer.py
│  │  │  ├─ graph_engine.py   # build graph, paths, status, diff
│  │  │  ├─ risk.py           # risk scorer (pure functions)
│  │  │  ├─ policy.py         # tier routing + protected-asset rules
│  │  │  ├─ gateway.py        # tool gateway
│  │  │  ├─ verifier.py
│  │  │  ├─ audit.py          # hash chain + anchor
│  │  │  └─ events.py         # SSE event bus
│  │  ├─ agent/
│  │  │  ├─ orchestrator.py   # the loop
│  │  │  ├─ planner.py
│  │  │  ├─ fallback.py       # deterministic playbook (B1 shares this logic)
│  │  │  └─ llm/              # adapter.py, anthropic.py, replay.py, mock.py
│  │  ├─ tools/               # investigate.py, respond.py, verify.py, registry.py
│  │  ├─ env/
│  │  │  ├─ spec.yaml         # synthetic enterprise definition
│  │  │  ├─ environment.py    # state + step()
│  │  │  ├─ adversary.py      # reactive state machine
│  │  │  └─ scenarios.py      # the 7 scenarios
│  │  └─ db/                  # session.py, tables.py, seed.py (demo users)
│  ├─ eval/
│  │  ├─ run_benchmark.py
│  │  ├─ configs.py           # B0..B3
│  │  ├─ stats.py             # Wilson CI, Fisher, rule-of-three
│  │  └─ results/             # generated JSON (git-ignored except samples)
│  └─ tests/
├─ frontend/
│  └─ src/ (components, pages, hooks, store, api, styles)
├─ docker-compose.yml
└─ .env.example
```

---

## 4. Core module contracts

### 4.1 Incident state (agent input, Pydantic)
```json
{
  "incident": "INC-1042",
  "compromised_identity": "user_1042",
  "affected_assets": ["workstation_17", "server_03"],
  "known_indicators": ["10.10.10.42"],
  "reachable_targets": ["customer_db"],
  "active_paths": 1,
  "graph_version": 3,
  "denials": [],
  "last_failures": []
}
```
All string values are sanitized and treated as quoted data.

### 4.2 Plan (agent output; JSON-schema constrained)
```json
{
  "objective": "contain_attack",
  "actions": [
    {"tool": "revoke_session", "target": "user_1042", "reason": "compromised identity", "reversible": true, "confidence": 85}
  ],
  "expected_effect": "remove path A",
  "verification_required": true
}
```
`confidence` (0 to 100) feeds Uncertainty = 100 − confidence.

### 4.3 LLM adapter interface
```python
class LLMAdapter(Protocol):
    def plan(self, state: IncidentState, schema: dict, errors: list[str] | None = None) -> Plan: ...
```
- `AnthropicAdapter`: temperature 0, JSON output enforced via schema/tool-calling, retries only on validation errors (max 2).
- `ReplayAdapter`: returns cached response keyed by `sha256(canonical_json(state) + schema_version + prompt_version)`; used for benchmark and tests.
- `MockAdapter`: scripted outputs for unit tests.

### 4.4 Risk scorer (pure function, no I/O)
```python
def risk_score(crit: int, blast: int, irrev: int, uncert: int) -> int:
    return round(0.35*crit + 0.25*blast + 0.25*irrev + 0.15*uncert)

def tier(score: int, protected: bool) -> str:
    if protected: return "HIGH"          # crown-jewel never auto-actioned
    return "LOW" if score < 35 else "MEDIUM" if score < 70 else "HIGH"
```
Factor values come from the asset inventory, `simulate_action()` output and the action's reversibility, **never from the prompt**.

### 4.5 Tool gateway checks (in order)
1. Kill switch off? 2. Mode allows execution (Enforce) or log-only (Shadow). 3. Tool name in registry. 4. Args match schema. 5. Target exists in current graph/inventory. 6. Rate limit not exceeded (default 10 actions/min/incident). 7. Idempotency key unseen. 8. Risk/policy tier decision (auto / validate+notify / hold for approval). 9. Execute. 10. Register undo. 11. Append audit entry.

### 4.6 Agent loop (pseudo-code)
```python
while not done:
    snap = env.observe(); graph = engine.build(snap); diff = engine.diff(prev, graph)
    state = sanitizer.to_state(snap, graph, denials, failures)
    plan = planner.get_valid_plan(state)                 # retries, then fallback.playbook()
    for action in plan.actions:
        sim = tools.simulate_action(action)               # dry-run
        r = risk.score(action, sim, plan.confidence)
        decision = policy.route(r, action)                # AUTO | VALIDATED | NEEDS_APPROVAL
        result = gateway.execute(action, decision)        # blocks on approval if needed
        audit.append(...)
    if verifier.verify_containment(): done = True         # ground truth, not LLM claim
    elif no_progress(3) or kill_switch: escalate(); break
    else: continue                                         # replan with fresh graph
```

### 4.7 Verifier
`verify_containment()` reads the environment's true reachability (not the agent's graph) and returns `{contained: bool, active_paths: [...]}`. The agent's own "contained" claim is logged separately so **verification accuracy** (claim vs truth) can be measured.

### 4.8 Environment and adversary
- `spec.yaml` defines users, devices, servers, tokens, services, DB, criticality, protected flags and initial edges.
- `Environment.step()` applies pending agent actions, then lets the adversary act once.
- `Adversary.next_move(env_state, rng)` picks among tactics available on **open** paths using `random.Random(seed)`.
- Simulated time advances one step per `step()`; time-to-contain counts steps.

---

## 5. Authentication and authorization

- `POST /api/auth/login` → `{access_token, role, expires_in}`. Access token lifetime 60 min. Secret `JWT_SECRET` from env.
- Seeded demo users (change in `.env`/seed): `viewer`, `analyst`, `approver`, `admin`.
- Token sent as `Authorization: Bearer ...`; for SSE the `EventSource` cannot set headers, so use a **short-lived stream ticket**: `POST /api/stream/ticket` → `?ticket=...` valid 60 s, single use.
- Role checks implemented as FastAPI dependencies; permission matrix in `SCHEMA.md` §5.
- Approval records the approver's user id. Passwords: bcrypt. CORS limited to the frontend origin.

---

## 6. API surface

Base path `/api`. All responses JSON. Errors: `{ "error": {"code": "...", "message": "..."} }`.

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/auth/login` | none | Get token |
| GET | `/me` | any | Current user |
| GET | `/health` | none | Liveness |
| GET | `/scenarios` | viewer | List scenarios |
| POST | `/incidents` | analyst | Start incident `{scenario_id, seed, mode, config}` |
| GET | `/incidents` | viewer | List incidents |
| GET | `/incidents/{id}` | viewer | Incident summary |
| GET | `/incidents/{id}/graph` | viewer | Current snapshot + diff |
| GET | `/incidents/{id}/paths` | viewer | Paths and status |
| GET | `/incidents/{id}/timeline` | viewer | Agent steps and tool calls |
| GET | `/incidents/{id}/actions` | viewer | Actions + Action Proofs |
| POST | `/actions/{id}/approve` | approver | Approve HIGH action |
| POST | `/actions/{id}/deny` | approver | Deny (body: reason) |
| POST | `/actions/{id}/undo` | analyst | Undo reversible action |
| GET | `/system/status` | viewer | Mode, kill switch state |
| PUT | `/system/mode` | admin | `shadow` or `enforce` |
| POST | `/system/kill-switch` | approver | Engage/release `{engaged: bool}` |
| POST | `/stream/ticket` | viewer | Get SSE ticket |
| GET | `/stream/incidents/{id}` | ticket | SSE stream |
| GET | `/audit/{incident_id}` | viewer | Audit entries |
| GET | `/audit/verify` | viewer | Chain check `{intact, broken_at}` |
| POST | `/benchmark/run` | analyst | Start benchmark `{configs, quick: bool}` |
| GET | `/benchmark/results` | viewer | Latest results JSON |
| GET | `/replay/{incident_id}` | viewer | (P2) Ordered events for stepping |

### SSE event types
`incident.status` · `graph.snapshot` · `graph.diff` · `agent.step` · `plan.proposed` · `action.pending_approval` · `action.executed` · `action.undone` · `verify.result` · `replan.triggered` · `audit.entry` · `system.mode` · `kill_switch`.
Envelope: `{ "id": int, "type": str, "incident": str, "ts_step": int, "data": {...} }`. Clients resume with `Last-Event-ID`.

---

## 7. Deployment strategy

- **Local/demo:** `docker compose up --build`
  - `backend` on `:8000` (Uvicorn), volume for SQLite DB and a separate volume for the audit **anchor** store (mounted read-only into the agent code path; written only by the audit module's writer).
  - `frontend` on `:5173` (dev) or static build served by Nginx on `:8080`.
- **Env vars (`.env.example`):** `JWT_SECRET`, `LLM_PROVIDER` (`anthropic|replay|mock`), `LLM_MODEL`, `ANTHROPIC_API_KEY`, `DB_URL`, `ANCHOR_PATH`, `CORS_ORIGIN`, `MODE_DEFAULT` (`shadow`), `RATE_LIMIT_PER_MIN`.
- **Secrets:** never committed; `.env` git-ignored.
- **Demo safety:** `LLM_PROVIDER=replay` plus a pre-warmed cache guarantees a deterministic demo; keep a recorded backup video.
- **Production note (out of MVP scope):** swap simulator adapters for real IAM/EDR connectors; move audit anchor to external write-once storage.

---

## 8. Quality, testing and observability

| Area | Requirement |
|---|---|
| Unit tests | Risk scorer (4 worked examples), policy routing (protected-asset rule), sanitizer (injection patterns), audit chain (tamper detection), gateway (all rejection paths), graph diff |
| Scenario tests | Each of the 7 scenarios passes for a fixed seed using `ReplayAdapter`/`MockAdapter` |
| Property tests (optional) | Random plans never execute an action on a target outside the graph |
| Benchmark | Runs from cache; outputs JSON + CIs; failures reported |
| Logging | Structured JSON logs with `incident_id`, `step`, `action_id`; no secrets, no raw untrusted strings unescaped |
| CI (optional) | Ruff, pytest, ESLint, Vitest on push |

## 9. Security requirements (technical)
Treat all log/host/user strings as untrusted; sanitizer + quoted JSON fields; schema-only LLM output; gateway re-validates everything; risk/policy in code; scoped tool credentials; CORS allowlist; rate limiting on login; JWT expiry; audit anchor outside the agent's write path.

## 10. Performance targets
Backend event → UI render ≤ 1 s locally; a single incident run (replay adapter) completes in < 10 s wall-clock; 800-run benchmark (4 configs × 200) in ≤ 30 min from cache.
