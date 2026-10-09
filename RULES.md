# RULES: Coding Standards and Decision Log

These rules bind every AI session. Read them before writing code. If a rule blocks you, **stop and ask**; never work around it silently.

---

## 1. Process rules

1. Execute **one phase at a time** (the one in `TASK.md`). Never start the next phase.
2. Before coding, restate the phase goal and list the files you will create or change.
3. Make the **smallest change** that satisfies the phase. No drive-by refactors.
4. Do not rewrite or reorganize existing, working code unless the phase explicitly says so.
5. **Do not delete existing comments** or docstrings. You may edit them only if they became wrong.
6. If a requirement is missing, ambiguous or contradicts another file, **ask**. Use the authority order in `README.md`.
7. After finishing: run the exit checks, tick boxes in `IMPLEMENTATION_PLAN.md`, update `TASK.md`, and append new decisions to §6 below.
8. Never invent numbers (benchmark results, metrics, performance claims). They come from the harness.
9. Never commit secrets, API keys, `.env`, or generated benchmark output.

## 2. Architecture rules (non-negotiable)

1. **The LLM never touches the environment.** It returns a JSON plan; only the Tool Gateway executes.
2. **Risk scoring and policy are code, not prompt.** No prompt text may change a score, a tier or an approval requirement.
3. **Crown-jewel (protected) assets are never auto-actioned**, regardless of score.
4. **All log, user, host and file-name strings are untrusted data.** They pass through the sanitizer and reach the model only as quoted JSON fields, never concatenated into instructions.
5. **Schema-only output:** free text from the model is never executed. Invalid plans are retried (max 2), then the deterministic fallback runs.
6. **Verification uses ground truth** (`verify_containment()` reading the real environment), never the agent's own claim.
7. **Every action is gateway-validated:** schema, target exists in graph/inventory, rate limit, idempotency, undo registration.
8. **The audit log is append-only and hash-chained;** no UPDATE or DELETE on `audit_log`.
9. **Reactive adversary sees only environment state,** never agent reasoning; all randomness comes from a seeded `random.Random`.
10. **Deterministic by default:** temperature 0, seeded RNG, LLM response cache for replay. No hidden global state, no `time.time()` in logic (use simulated steps).

## 3. Backend (Python) standards

- Python 3.11+, full type hints, `from __future__ import annotations` where useful.
- Pydantic v2 models for **all** data crossing a boundary (API, tools, LLM, DB JSON columns).
- Pure functions for logic that can be pure (risk, policy, graph diff, stats). Side effects only in gateway, db and api layers.
- No bare `except`. Catch specific exceptions; log with context; never swallow errors that affect safety.
- Business logic never lives in route handlers; handlers validate, call a service, return a model.
- Naming: `snake_case` functions/modules, `PascalCase` classes, `UPPER_SNAKE` constants. Tool names exactly as in `SRS.md` §3.7 (e.g. `revoke_session`).
- Format with Black, lint with Ruff. Line length 100.
- Logging: structured JSON with `incident_id`, `step`, `action_id`. Never log secrets or raw unsanitized untrusted strings.
- Config via `pydantic-settings` and env vars only; no hard-coded secrets or URLs.
- DB access only through the `db/` layer; parametrized queries only (no string-built SQL).
- Tests: every module with logic gets pytest tests; the safety-critical ones (risk, policy, gateway, sanitizer, audit chain) must stay green at all times.

## 4. Frontend (TypeScript/React) standards

- TypeScript `strict: true`; no `any` unless justified in a comment.
- **Always use Tailwind CSS** with the tokens from `DESIGN.md`. No CSS-in-JS, no other UI framework, no inline hex colors.
- Functional components + hooks; one component per file; `PascalCase` files for components.
- Server data via TanStack Query; live events via the SSE store (Zustand). No ad-hoc `fetch` in components.
- All API types come from the shared types file mirroring backend models.
- Status is never color alone (icon + label); follow `DESIGN.md` §9 accessibility.
- No `localStorage` for secrets; keep the JWT in memory (refresh by re-login in the MVP).
- Every panel has loading, empty and error states.
- Format with Prettier, lint with ESLint.

## 5. Git and workflow

- Branch per phase: `phase-N-short-name`. Commit messages: `phase N: <what>` and reference requirement ids (e.g. `FR-GWY-02`).
- Small commits; tests included with the code they cover.
- Do not rewrite history on `main`. Tag the final freeze `v1.0-hackathon`.

## 6. Forbidden list

- Adding Redis, Postgres, Celery, Kafka, microservices, extra LLM vendors, real firewall/EDR integrations, a malware sandbox.
- Giving the LLM tool handles, shell access or direct DB access.
- Lowering a risk score or skipping approval for "demo convenience".
- Editing `benchmark_runs` or results by hand.
- Renaming tools, tables or API paths without a Decision Log entry.
- Large "while I'm here" cleanups.

---

## 7. Decision Log (append only)

Format: `D-NNN · date · decision · reason · alternatives rejected · affects`. Do not rewrite old entries; supersede them with a new entry.

| ID | Decision | Reason | Rejected alternatives | Affects |
|---|---|---|---|---|
| D-001 | Backend: Python 3.11 + FastAPI + Pydantic v2 | Fast build, strong schema validation for plans/tool args | Node/Express, Django | All backend |
| D-002 | Graph engine: NetworkX | Simple-path enumeration and diff in a few lines | Neo4j (too heavy), custom graph | `graph_engine.py` |
| D-003 | DB: SQLite (WAL) via SQLAlchemy 2.x | Zero-setup, enough for single-node demo | Postgres | `db/`, deployment |
| D-004 | Live updates: Server-Sent Events | One-way stream, simple, auto-reconnect with `Last-Event-ID` | WebSockets | API, frontend store |
| D-005 | Frontend: React + TS + Vite + Tailwind; graph via Cytoscape.js | Fast dev; Cytoscape handles styled graph states well | Next.js (no SSR needed), D3 custom | `frontend/` |
| D-006 | Auth: JWT + bcrypt, four roles, SSE ticket | Approvals need identity; EventSource cannot send headers | Session cookies, no auth | API, UI |
| D-007 | LLM behind adapter; Replay cache for benchmark/demo | Determinism, offline demo, cost control | Direct SDK calls everywhere | `agent/llm/` |
| D-008 | Risk formula 0.35/0.25/0.25/0.15; tiers 35/70; protected ⇒ HIGH | From project document; explainable and testable | LLM-assigned risk | `risk.py`, `policy.py` |
| D-009 | Benchmark = 5×20 + 2×50 seeds per config (200 runs); dev seeds ≥ 1000; eval seeds frozen | Rare-event metrics need n=50 for a meaningful bound | 7×20 | `eval/` |
| D-010 | Time-to-contain in simulated steps; B3 median ≤ 60% of B1 | Wall-clock is noisy and LLM-dependent | Wall-clock seconds | `eval/` |
| D-011 | Audit anchor in a separate append-only store the agent cannot write | Makes tamper-evidence meaningful | Single DB table only | `audit.py`, deployment |
| D-012 | Deployment: Docker Compose on one machine | No cloud dependency for the demo | Cloud deploy | Deployment |
| D-013 | Adversary tactics fixed before agent built; mapped to MITRE ATT&CK T1078, T1528, T1021, T1098 | Prevents tuning the benchmark to the agent | Ad-hoc tactics | `adversary.py` |
| D-014 | Contracts (Pydantic schemas) frozen at end of Phase 1 | Enables parallel work and avoids drift | Evolving schemas | All |

### Pending decisions (resolve before the phase that needs them)

| ID | Question | Needed by |
|---|---|---|
| P-001 | Final LLM model name for the live demo (`LLM_MODEL`) | Phase 5 |
| P-002 | Exact B1 playbook rules (freeze) | Phase 10 |
| P-003 | Replay mode vs recorded backup video | Phase 11 |
