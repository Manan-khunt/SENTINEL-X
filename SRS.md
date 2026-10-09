# SRS: Software Requirements Specification

**Product:** SENTINEL-X · **Version:** 1.0 · **Style:** IEEE 830 (condensed)
Keywords: **shall** = mandatory, **should** = strongly recommended, **may** = optional. Every requirement has an ID so tests and commits can reference it.

---

## 1. Introduction

### 1.1 Purpose
Defines testable requirements for SENTINEL-X, an agentic system that investigates, contains, verifies and replans against an adaptive cyberattack in a synthetic environment.

### 1.2 Scope
Includes: agent loop, attack-graph engine, tool gateway and tools, risk scoring and policy, verifier, audit log, reactive adversary simulator, benchmark harness, backend API, React dashboard. Excludes: real EDR/IAM/firewall integrations, malware analysis, production threat-intel.

### 1.3 Definitions

| Term | Meaning |
|---|---|
| Crown-jewel | Protected asset (e.g. `customer_db`); never auto-actioned |
| Path status | `ACTIVE` (attacker can traverse now), `BLOCKED` (a control cuts it), `SAFE` (no attacker foothold) |
| Graph diff | Comparison of snapshot N and N+1; a new ACTIVE path/edge triggers replan |
| Gateway | Single choke point through which all tool calls pass |
| Action Proof | Verifiable record of one consequential action |
| Shadow mode | Recommend-only; no execution |
| B0 to B3 | Benchmark configs: alert-only, static playbook, SENTINEL-X without replanning, full SENTINEL-X |

### 1.4 References
`PRD.md`, `TRD.md`, `SCHEMA.md`, `DESIGN.md`, `RULES.md`.

---

## 2. Overall description

### 2.1 Product perspective
Standalone web application: Python backend (agent + environment simulator + API) and a React dashboard, communicating over REST and Server-Sent Events (SSE). The environment is simulated; the tool layer is an **adapter boundary** so real connectors can replace simulators later.

### 2.2 User classes

| Role | Rights |
|---|---|
| `viewer` | Read dashboards, timelines, evaluation results |
| `analyst` | Viewer + start incidents, run benchmark, undo LOW/MEDIUM actions |
| `approver` | Analyst + approve/deny HIGH actions, use kill switch |
| `admin` | Approver + change mode (Shadow/Enforce), manage users and policy |

### 2.3 Assumptions and dependencies
- Python 3.11+, Node 20 LTS, Docker (optional for demo).
- An LLM is reachable through the model adapter; if not, the system falls back to the deterministic playbook (FR-AGT-09).
- The asset inventory (criticality, protected flag) is correct; wrong inventory yields wrong risk scores.

### 2.4 Constraints
- Hackathon build: 24 hours. Cut line in `PRD.md` §5 applies.
- Benchmark metrics use simulated time (steps), not wall-clock.
- Single-node SQLite storage.

---

## 3. Functional requirements

### 3.1 Perception and ingestion (`FR-ING`)
- **FR-ING-01** The system shall ingest synthetic IAM, endpoint, network and log events from the environment simulator.
- **FR-ING-02** All externally sourced strings (usernames, hostnames, file names, log messages) shall pass through the sanitizer before reaching the agent.
- **FR-ING-03** The sanitizer shall strip control characters, truncate to a max length (default 256), and flag instruction-like patterns for the audit log.
- **FR-ING-04** Sanitized strings shall be passed to the agent only as quoted fields in structured JSON, never concatenated into instructions.

### 3.2 Attack graph engine (`FR-GRA`)
- **FR-GRA-01** The graph shall contain nodes of type User, Device, Server, Credential, ServiceToken, Service, Database, each with `criticality` (0 to 100) and `protected` (bool).
- **FR-GRA-02** Edges shall be one of: `logged_into`, `connected_to`, `can_access`, `authenticated_through`, `communicates_with`.
- **FR-GRA-03** The engine shall enumerate all simple paths from compromised nodes to protected assets (NetworkX).
- **FR-GRA-04** Each path shall have a status: ACTIVE, BLOCKED or SAFE, recomputed after every action and every environment step.
- **FR-GRA-05** The engine shall store a versioned snapshot per cycle and compute a diff between consecutive snapshots.
- **FR-GRA-06** A new ACTIVE path, a new edge, or an unseen identity/token/host/IP on an active path shall raise a replan trigger.

### 3.3 Agent loop (`FR-AGT`)
- **FR-AGT-01** The agent shall run: OBSERVE → REASON → PLAN → DRY-RUN → RISK SCORE → TOOL CALL → OBSERVE → VERIFY → (contained: DONE | not contained: REPLAN).
- **FR-AGT-02** The agent shall receive **structured incident state** (incident id, compromised identity, affected assets, indicators, reachable targets, active path count, graph version), not free-form prompts.
- **FR-AGT-03** The agent shall return a **schema-validated plan**: objective, ordered actions (tool, target, reason, reversible), expected effect, `verification_required`.
- **FR-AGT-04** Invalid or unparseable plans shall be returned to the model with validation errors and retried at most 2 times.
- **FR-AGT-05** If still invalid after retries, the system shall execute the deterministic baseline playbook and flag the incident for a human.
- **FR-AGT-06** On tool error or timeout, the agent shall record the observation and replan with the failure in state; it shall never retry blindly.
- **FR-AGT-07** After 3 consecutive replan cycles with no progress (active path count not reduced), the system shall escalate to a human with the full graph and action history.
- **FR-AGT-08** The agent shall run with temperature 0 and JSON-schema constrained output.
- **FR-AGT-09** If the LLM is unavailable, the system shall run in recommend-only mode using the deterministic playbook.
- **FR-AGT-10** The agent shall never be considered "done" on its own claim; DONE requires a passing `verify_containment()`.

### 3.4 Replanning (`FR-REP`)
- **FR-REP-01** Replan triggers: verification failure; graph diff; new indicator; action failure or human rejection.
- **FR-REP-02** A replan shall rebuild the attack graph from current environment state before planning.
- **FR-REP-03** A human denial shall be added to state; the agent shall propose a lower-impact alternative.

### 3.5 Planner and dry-run (`FR-PLN`)
- **FR-PLN-01** Before any execution the planner shall call `simulate_action()` for each action and obtain predicted effect and blast radius.
- **FR-PLN-02** Plans referencing targets absent from the current graph/inventory shall be rejected.

### 3.6 Risk scoring and policy (`FR-RSK`)
- **FR-RSK-01** Risk score (0 to 100) = 0.35 × AssetCriticality + 0.25 × BlastRadius + 0.25 × Irreversibility + 0.15 × Uncertainty; each factor 0 to 100; Uncertainty = 100 − agent confidence.
- **FR-RSK-02** Tiers: LOW < 35; MEDIUM 35 to 69; HIGH ≥ 70.
- **FR-RSK-03** LOW: auto-execute bounded actions. MEDIUM: validate against allowlist + dry-run, execute, notify operator. HIGH: pause for explicit human approval.
- **FR-RSK-04** Actions on protected (crown-jewel) assets shall **never** auto-execute regardless of score.
- **FR-RSK-05** Scoring and policy shall be implemented in code; no prompt text shall be able to alter a score or skip approval.
- **FR-RSK-06** The worked examples in the project document shall be unit tests: `block_indicator` = 8, `revoke_session` = 22, `revoke_token` = 48, `disable_credential` = 75 (±1 rounding).

### 3.7 Tool gateway and tools (`FR-GWY`, `FR-TLS`)
- **FR-GWY-01** All tool calls shall pass: Agent → Gateway → Policy check → Risk check → Tool → Environment.
- **FR-GWY-02** The gateway shall validate argument schemas, verify the target exists in the graph/inventory, apply idempotency keys, enforce a per-incident rate limit, and register an undo for each response action.
- **FR-GWY-03** Exceeding the rate limit shall escalate to a human.
- **FR-GWY-04** Each tool shall use a scoped credential; no shared admin token.
- **FR-TLS-01** Investigate tools: `get_user_activity`, `get_endpoint_status`, `get_service_tokens`, `get_attack_graph`.
- **FR-TLS-02** Plan tool: `simulate_action`.
- **FR-TLS-03** Respond tools (all reversible): `revoke_session`, `revoke_token`, `isolate_endpoint`, `block_indicator`, `disable_credential`.
- **FR-TLS-04** Safety tool: `undo_action(action_id)`.
- **FR-TLS-05** Verify tool: `verify_containment()` shall compute ground-truth reachability from the environment, independent of the agent's claims.

### 3.8 Human approval, rollback and control (`FR-HIL`)
- **FR-HIL-01** HIGH-tier actions shall show target, reason, risk score, factors and dry-run result before Approve/Deny.
- **FR-HIL-02** Approve/Deny shall be limited to roles `approver` and `admin`; the decider's identity is stored.
- **FR-HIL-03** A global **kill switch** shall immediately halt all execution and queue nothing further.
- **FR-HIL-04** **Shadow mode** shall produce plans and Action Proofs with `Result: NOT EXECUTED (shadow)`.
- **FR-HIL-05** Every reversible action shall be undoable from the dashboard.

### 3.9 Audit log and Action Proof (`FR-AUD`)
- **FR-AUD-01** Every observation, plan, decision and action shall be appended to a hash-chained, append-only log: `hash = SHA-256(prev_hash ‖ canonical_json(entry))`.
- **FR-AUD-02** Each consequential action shall produce an Action Proof (incident, target, action, reason, risk + factors, dry-run, approval, reversibility + undo id, result, log hash + prev hash).
- **FR-AUD-03** The chain head shall be shown on the dashboard and written periodically to a separate append-only anchor store that the agent process cannot write to.
- **FR-AUD-04** A `verify_audit_chain` command and dashboard badge shall report "intact" or "broken at entry N".

### 3.10 Reactive adversary simulator (`FR-ADV`)
- **FR-ADV-01** The attacker shall be a state machine with tactics: credential reuse, token theft, alternate lateral movement, persistence.
- **FR-ADV-02** At each step it shall choose the next tactic from paths **still open in the environment**, using seeded randomness.
- **FR-ADV-03** The attacker shall see only environment state, never agent reasoning.
- **FR-ADV-04** Runs shall be reproducible given `(scenario, seed)`.
- **FR-ADV-05** Tactics shall be documented and mapped to MITRE ATT&CK (T1078, T1528, T1021, T1098) before the agent is built.

### 3.11 Scenarios (`FR-SCN`)
- **FR-SCN-01** The system shall implement the seven scenarios defined in `PRD.md` §7 with the stated pass conditions.
- **FR-SCN-02** Scenario 4 shall support three scripted approver modes: approve, deny, timeout.

### 3.12 Benchmark harness (`FR-BEN`)
- **FR-BEN-01** `python eval/run_benchmark.py` shall run configs B0, B1, B2, B3 over 5 scenarios × 20 seeds plus Scenarios 6 and 7 × 50 seeds (200 runs per config).
- **FR-BEN-02** It shall output JSON consumed by the dashboard Evaluation tab; no values shall be typed by hand.
- **FR-BEN-03** Every rate shall be reported with a Wilson 95% CI; zero-event metrics with the rule-of-three bound; B3 vs B1 and B3 vs B2 on scenarios 2 and 5 with Fisher's exact test.
- **FR-BEN-04** Development seeds (≥ 1000) are for tuning; evaluation seeds (1 to 20 / 1 to 50) are frozen before the first full run.
- **FR-BEN-05** B1 shall be a strong static playbook (revoke session, isolate host, block IP, revoke tokens on the host).
- **FR-BEN-06** Metrics: containment success, replans to contain, time-to-contain, unsafe actions, HIGH without approval, injection success, over-containment, verification accuracy, first-pass plan validity, mean LLM tokens per incident.

### 3.13 Dashboard (`FR-UI`)
- **FR-UI-01** Top bar: product name, incident status, mode (Shadow/Enforce), kill switch.
- **FR-UI-02** Left: live attack graph with ACTIVE/BLOCKED/SAFE coloring and graph-diff highlights.
- **FR-UI-03** Center: agent activity and tool-call timeline with reasoning summaries.
- **FR-UI-04** Right: Action Proof cards and the approval panel.
- **FR-UI-05** Bottom: current attack paths with status.
- **FR-UI-06** Evaluation tab: benchmark table B0 to B3 and per-scenario pass/fail.
- **FR-UI-07** Live updates over SSE; the UI shall reconnect automatically.
- **FR-UI-08** (P2) Replay: step through a finished incident from the audit log.

### 3.14 Authentication and access (`FR-AUTH`)
- **FR-AUTH-01** Users shall log in with username/password and receive a short-lived JWT.
- **FR-AUTH-02** All API and SSE endpoints (except login and health) shall require a valid token and enforce role permissions per `SCHEMA.md`.

---

## 4. Non-functional requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-SAF-01 | Safety | Zero unsafe actions executed and zero HIGH actions without approval across the full benchmark |
| NFR-SAF-02 | Safety | Injection success: 0 of 50 runs in Scenario 6 |
| NFR-SEC-01 | Security | Passwords hashed (bcrypt/argon2); JWT secret from env; no secrets in repo |
| NFR-SEC-02 | Security | Agent process has no write access to the audit anchor store |
| NFR-REL-01 | Reliability | LLM failure degrades to deterministic playbook; no unhandled exception ends an incident silently |
| NFR-REP-01 | Reproducibility | Same `(scenario, seed, config, LLM cache)` produces identical results |
| NFR-PERF-01 | Performance | UI event latency (backend event → rendered) ≤ 1 s on localhost |
| NFR-PERF-02 | Performance | Full 800-run benchmark (4 configs × 200) completes in ≤ 30 min from LLM cache, on a laptop |
| NFR-USE-01 | Usability | Approval decision achievable in ≤ 3 clicks; all risk factors visible without scrolling |
| NFR-A11Y-01 | Accessibility | Status never conveyed by color alone (icon + label); WCAG AA contrast |
| NFR-MNT-01 | Maintainability | Schemas in Pydantic; typed code; pytest covers gateway, risk scorer, sanitizer, audit chain |
| NFR-PORT-01 | Portability | `docker compose up` brings up backend + frontend |

---

## 5. External interfaces

- **UI:** React dashboard (see `DESIGN.md`).
- **API:** REST + SSE (see `TRD.md` §6).
- **LLM adapter:** `complete(state, schema) → validated JSON`; providers: live LLM, replay/cache, mock.
- **Tool adapters:** simulator implementations behind the same interface that real IAM/EDR connectors would implement later.

## 6. Data requirements
Entities, tables and relations are defined in `SCHEMA.md`. Required retention: all incidents, snapshots, plans, actions, approvals and audit entries are kept for the demo; benchmark runs are kept per run id.

## 7. Acceptance and traceability

| Scenario | Primary requirements | Evidence |
|---|---|---|
| 1 Normal attack | FR-AGT-01, FR-TLS-05, FR-AUD-02 | Path removed, verify = contained |
| 2 Adaptive | FR-GRA-05/06, FR-REP-01/02, FR-ADV-02 | Closed within ≤ 2 replans |
| 3 Lateral | FR-PLN-01, FR-RSK-01 | Min-impact cut chosen |
| 4 High-risk | FR-RSK-03/04, FR-HIL-01/02, FR-REP-03 | No execution before approval; denial → alternative |
| 5 Verification failure | FR-AGT-10, FR-TLS-05 | Incomplete containment detected and closed |
| 6 Injection | FR-ING-02/03/04, FR-RSK-05, FR-GWY-02 | 0 unauthorized actions in 50 runs |
| 7 False positive | FR-RSK-03, FR-AGT-07 | No disruptive action; escalation with evidence |

**Definition of done for MVP:** all P0 requirements implemented and tested; all seven scenarios pass in at least one seeded run; the benchmark harness produces the results table from real runs.
