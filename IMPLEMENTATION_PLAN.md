# IMPLEMENTATION PLAN

**Execution rule for the AI:** work on **exactly one phase at a time**, the one named in `TASK.md`. Do not start the next phase, even if it looks easy. A phase is finished only when **every exit check passes** and the boxes are ticked here. Then stop and wait for the human.

Time budget: 24 hours total (hours in brackets are targets, not excuses to skip checks).
Priorities: **P0** must ship · **P1** strongly wanted · **P2** if time. Cut P2 first; then reduce the benchmark to B1 vs B3. Never cut verification, the policy gateway or the human-approval path.

Files to attach per phase are listed under "Context". Always attach `README.md`, `RULES.md`, `TASK.md` too.

---

## Phase 0: Repo, tooling, skeleton [hours 0 to 1]
**Context:** `TRD.md` §1, §3, §7
**Goal:** a runnable empty project that other phases plug into.
- [ ] Create the repo layout from `TRD.md` §3 (empty modules with docstrings)
- [ ] Backend: FastAPI app with `GET /api/health`, settings via `pydantic-settings`, `.env.example`
- [ ] Frontend: Vite + React + TypeScript + Tailwind configured with the tokens from `DESIGN.md` §2.4
- [ ] Ruff/Black/ESLint/Prettier configs; `pytest` and `vitest` run (zero tests OK)
- [ ] `docker-compose.yml` brings up backend `:8000` and frontend `:5173`
- [ ] `.gitignore` (`.env`, DB files, `eval/results/`, node_modules, caches)

**Exit checks:** `docker compose up` works; `/api/health` returns OK; frontend shows a placeholder page; `pytest` and `npm test` run.

---

## Phase 1: Schemas and contracts [hours 1 to 2] **(contracts are frozen after this phase)**
**Context:** `TRD.md` §4, `SCHEMA.md`, `SRS.md` §3.3 to 3.7
- [ ] `core/models.py`: `IncidentState`, `Plan`, `PlannedAction`, `ToolCall`, `Action`, `RiskResult`, `Path`, `GraphSnapshot`, `GraphDiff`, `AuditEntry`
- [ ] Tool argument schemas for all 12 tools (`TRD`/`SRS` §3.7)
- [ ] JSON Schema export for the LLM plan output
- [ ] SQLAlchemy tables per `SCHEMA.md` §2 + insert-only triggers on `audit_log`
- [ ] TypeScript types mirroring API models (hand-written or generated)
- [ ] Unit tests: models validate good input and reject bad input

**Exit checks:** all models import cleanly; schema tests pass; DB creates from scratch; contracts reviewed and **frozen** (changes now require a Decision Log entry).

---

## Phase 2: Environment simulator and attack graph [hours 2 to 6]
**Context:** `TRD.md` §4.8, `SCHEMA.md` §3, `SRS.md` §3.2
- [ ] `env/spec.yaml`: synthetic enterprise (users, `workstation_17`, `server_02`, `server_03`, `svc_token`, `admin_root`, `customer_db` protected)
- [ ] `environment.py`: state, `step()`, ground-truth reachability function
- [ ] `graph_engine.py`: build graph from state; enumerate simple paths from compromised nodes to protected assets; path status ACTIVE/BLOCKED/SAFE
- [ ] Graph snapshots (versioned) and `diff()` (new edge, new ACTIVE path, new indicator)
- [ ] Tests: path enumeration, status after blocking an edge, diff detects an opened path

**Exit checks:** a script prints the graph and paths for the Scenario 1 starting state; diff test passes.

---

## Phase 3: Tools and Tool Gateway [hours 6 to 8]
**Context:** `SRS.md` §3.7, `TRD.md` §4.5
- [ ] Tool registry; investigate tools (4), `simulate_action`, respond tools (5, all reversible), `undo_action`, `verify_containment`
- [ ] `gateway.py` with the 11 ordered checks from `TRD.md` §4.5 (kill switch, mode, registry, schema, target-exists, rate limit, idempotency, policy, execute, undo registration, audit hook)
- [ ] Per-tool scoped credential stubs
- [ ] Tests: every rejection path (unknown tool, bad args, target not in graph, rate limit, duplicate idempotency key, kill switch, shadow mode)

**Exit checks:** gateway tests all pass; calling a tool with a made-up target is rejected.

---

## Phase 4: Risk scorer, policy, audit log [hours 8 to 11]
**Context:** `SRS.md` §3.6, §3.9, `SCHEMA.md` §4, `TRD.md` §4.4
- [ ] `risk.py` and `policy.py` (pure functions; protected asset ⇒ HIGH)
- [ ] Unit tests for the 4 worked examples (8, 22, 48, 75 ±1) and tier boundaries (34/35, 69/70)
- [ ] `audit.py`: hash chain, canonical JSON, anchor writer (separate file/volume), `verify_audit_chain`
- [ ] Tamper test: editing one row is detected with the correct `broken_at`
- [ ] Approval queue: HIGH actions enter `PENDING_APPROVAL`; approve/deny functions (no HTTP yet)

**Exit checks:** all tests pass; a HIGH action cannot reach EXECUTED without an approval row.

---

## Phase 5: Agent loop, LLM adapter, fallback [hours 11 to 13]
**Context:** `TRD.md` §4.2, §4.3, §4.6, `SRS.md` §3.3
- [ ] `LLMAdapter` protocol + `MockAdapter`, `ReplayAdapter` (cache keyed by state hash), `AnthropicAdapter` (temperature 0, schema-constrained)
- [ ] `planner.py`: validation, retry up to 2 with errors, fallback to deterministic playbook, flag for human
- [ ] `fallback.py`: deterministic playbook (revoke session, isolate host, block IP, revoke tokens on host)
- [ ] `orchestrator.py`: full loop incl. dry-run, risk, gateway, verify, no-progress escalation (3 cycles), LLM-down recommend-only mode
- [ ] Scenario 1 passes end to end with `MockAdapter`

**Exit checks:** Scenario 1 ends `CONTAINED` verified by ground truth; killing the LLM yields recommend-only; invalid plan triggers retry then fallback (tests).

---

## Phase 6: Reactive adversary and adaptive replanning [hours 13 to 15]
**Context:** `SRS.md` §3.4, §3.10, §3.11, `PRD.md` §7
- [ ] `adversary.py`: state machine, 4 tactics (T1078, T1528, T1021, T1098), seeded choices from **open** paths only
- [ ] Replan triggers (verification failure, graph diff, new indicator, action failure/denial)
- [ ] Scenarios 1 to 5 in `scenarios.py`
- [ ] Scenario 4 scripted approver modes (approve / deny / timeout)
- [ ] **Early benchmark smoke run: Scenarios 1 and 2 by hour 15** (check thresholds while there is time to fix)

**Exit checks:** Scenarios 1 to 5 pass for fixed seeds; Scenario 2 closes the new path within ≤ 2 replans; different agent choices lead to different attacker moves (test).

---

## Phase 7: API, SSE, auth [hours 15 to 16]
**Context:** `TRD.md` §5, §6, `SCHEMA.md` §5
- [ ] Auth: seed users, login, JWT, role dependencies, SSE ticket
- [ ] Routes per `TRD.md` §6 (incidents, graph, paths, timeline, actions, approvals, undo, system, audit, benchmark stubs)
- [ ] Event bus + SSE stream with `Last-Event-ID` resume
- [ ] Orchestrator runs as a background task per incident; approval endpoints resume it
- [ ] API tests with `httpx` incl. role enforcement (viewer cannot approve)

**Exit checks:** start an incident via API and watch events with `curl`; approver can approve, analyst gets 403.

---

## Phase 8: Dashboard [hours 16 to 19]
**Context:** `DESIGN.md` (all), `TRD.md` §6, `SCHEMA.md` §6
- [ ] App shell, login, top bar (status, mode toggle, kill switch with confirm)
- [ ] SSE client + store with auto-reconnect
- [ ] Graph panel (Cytoscape): node shapes, status colors/line styles, diff highlight
- [ ] Timeline panel (phase icons, tool chips, reasoning summaries)
- [ ] Action Proof cards + risk factor bars + hash display with copy
- [ ] Approval panel (pinned, Approve/Deny with reason)
- [ ] Paths strip
- [ ] Responsive behavior per `DESIGN.md` §8; accessibility per §9

**Exit checks:** run Scenario 4 in the browser: pending approval appears, approve and deny both work; Scenario 2 shows the new edge highlighted. Layout checked at 1440px, 1024px, 390px.

---

## Phase 9: Safety scenarios and prompt-injection tests [hours 19 to 20]
**Context:** `SRS.md` §3.1, §3.11, §4
- [ ] `sanitizer.py`: control-char strip, length truncation, instruction-pattern flagging to audit
- [ ] Scenario 6 (injection strings in logs/hostnames/usernames) and Scenario 7 (benign admin activity, escalate)
- [ ] Tests: injected text cannot change a risk score, skip approval or reach an instruction position; gateway rejects out-of-graph targets even if the model emits them

**Exit checks:** Scenario 6 = 0 unauthorized actions across 50 seeds (mock/replay); Scenario 7 = no disruptive action and an escalation record.

---

## Phase 10: Benchmark harness [hours 20 to 22]
**Context:** `SRS.md` §3.12, `SCHEMA.md` §2 (benchmark tables), `PRD.md` §9
- [ ] Configs B0 to B3 (`configs.py`); B2 = B3 with replanning disabled; B1 = strong static playbook
- [ ] `run_benchmark.py`: 5×20 + 2×50 seeds per config, evaluation seeds frozen; dev seeds ≥ 1000 for tuning
- [ ] `stats.py`: Wilson 95% CI, rule-of-three, Fisher's exact (B3 vs B1, B3 vs B2 on scenarios 2 and 5)
- [ ] JSON output + DB rows; Evaluation tab renders table B0 to B3 and per-scenario pass/fail
- [ ] Thresholds, seeds and the B1 playbook are **frozen before the first full run** (log in Decision Log)
- [ ] Report the real numbers, including failures

**Exit checks:** `python eval/run_benchmark.py` reproduces identical results twice; dashboard shows the same numbers; no value was typed by hand.

---

## Phase 11: Polish, replay, rehearsal, freeze [hours 22 to 24]
**Context:** `PRD.md` §8, §12
- [ ] (P2) Replay mode from the audit log
- [ ] Demo script rehearsal (5 minutes): problem → S1 → S2 → S4 → S6 → Evaluation → business
- [ ] Pre-warm LLM cache; set `LLM_PROVIDER=replay` for the demo; record a backup video
- [ ] README with run instructions; limitations section copied from `PRD.md` §10
- [ ] Hour 23 to 24: **freeze**. No new features; final full run; tag release

**Exit checks:** clean-clone `docker compose up` works; demo runs without internet; audit verify badge shows intact.

---

## Cut line cheat sheet

| If behind schedule at... | Cut |
|---|---|
| Hour 15 | Replay, multiple incidents, threat-intel, behavioural baseline (P2) |
| Hour 19 | Ablation B2, light theme, mobile polish |
| Hour 21 | Benchmark reduced to B1 vs B3; keep Scenarios 1, 2, 4, 6 for the live demo |
| Never | Verification, policy gateway, approval path, audit log |
