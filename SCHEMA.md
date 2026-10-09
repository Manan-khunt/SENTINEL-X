# SCHEMA: Backend and Data Flow

Database: **SQLite** (WAL mode) via SQLAlchemy 2.x. Timestamps are ISO-8601 UTC strings; simulated time is stored as an integer `step`. JSON columns hold structured payloads (validated by Pydantic before insert).

---

## 1. Entity overview (ERD)

```text
users ───< approvals >─── actions >─── incidents ───< graph_snapshots
                              │              │
                              │              ├───< plans ───< actions
                              │              └───< agent_steps
                              │
audit_log (chained) ── references incident_id, action_id (nullable)

scenarios ───< benchmark_runs >─── benchmark_batches ───< benchmark_metrics
assets (inventory) ── referenced by graph nodes and risk inputs (per environment spec)
```

---

## 2. Tables (DDL)

```sql
-- Users and roles
CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('viewer','analyst','approver','admin')),
  created_at    TEXT NOT NULL
);

-- Asset inventory (source of criticality and protected flag)
CREATE TABLE assets (
  id          TEXT PRIMARY KEY,                 -- e.g. 'server_03', 'customer_db'
  type        TEXT NOT NULL CHECK (type IN ('user','device','server','credential','service_token','service','database')),
  label       TEXT NOT NULL,
  criticality INTEGER NOT NULL CHECK (criticality BETWEEN 0 AND 100),
  protected   INTEGER NOT NULL DEFAULT 0,       -- 1 = crown-jewel
  env_id      TEXT NOT NULL                     -- environment spec id/version
);

CREATE TABLE scenarios (
  id          INTEGER PRIMARY KEY,              -- 1..7
  name        TEXT NOT NULL,
  proves      TEXT NOT NULL,
  pass_rule   TEXT NOT NULL
);

-- One run of the system on one scenario/seed
CREATE TABLE incidents (
  id           TEXT PRIMARY KEY,                -- 'INC-1042'
  scenario_id  INTEGER NOT NULL REFERENCES scenarios(id),
  seed         INTEGER NOT NULL,
  mode         TEXT NOT NULL CHECK (mode IN ('shadow','enforce')),
  config       TEXT NOT NULL DEFAULT 'B3' CHECK (config IN ('B0','B1','B2','B3')),
  status       TEXT NOT NULL CHECK (status IN ('RUNNING','AWAITING_APPROVAL','CONTAINED','ESCALATED','FAILED','HALTED')),
  sim_step     INTEGER NOT NULL DEFAULT 0,
  replans      INTEGER NOT NULL DEFAULT 0,
  started_by   INTEGER REFERENCES users(id),
  started_at   TEXT NOT NULL,
  ended_at     TEXT,
  outcome_json TEXT                              -- final ground-truth check + metrics
);

-- Versioned attack-graph snapshots
CREATE TABLE graph_snapshots (
  id          INTEGER PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id),
  version     INTEGER NOT NULL,
  sim_step    INTEGER NOT NULL,
  graph_json  TEXT NOT NULL,                     -- nodes, edges, per-path status
  diff_json   TEXT,                              -- vs previous version
  UNIQUE (incident_id, version)
);

CREATE TABLE agent_steps (
  id          INTEGER PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id),
  sim_step    INTEGER NOT NULL,
  phase       TEXT NOT NULL CHECK (phase IN ('OBSERVE','REASON','PLAN','DRY_RUN','RISK','TOOL_CALL','VERIFY','REPLAN','ESCALATE')),
  summary     TEXT NOT NULL,                     -- reasoning summary, sanitized
  tokens_used INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE plans (
  id            INTEGER PRIMARY KEY,
  incident_id   TEXT NOT NULL REFERENCES incidents(id),
  graph_version INTEGER NOT NULL,
  plan_json     TEXT NOT NULL,                   -- validated Plan
  valid_first_pass INTEGER NOT NULL,             -- 1 if no retry needed
  used_fallback INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);

CREATE TABLE actions (
  id            TEXT PRIMARY KEY,                -- 'act_0007'
  incident_id   TEXT NOT NULL REFERENCES incidents(id),
  plan_id       INTEGER REFERENCES plans(id),
  tool          TEXT NOT NULL,
  target        TEXT NOT NULL,
  reason        TEXT NOT NULL,
  reversible    INTEGER NOT NULL,
  risk_score    INTEGER NOT NULL,
  risk_factors  TEXT NOT NULL,                   -- {"crit":..,"blast":..,"irrev":..,"uncert":..}
  tier          TEXT NOT NULL CHECK (tier IN ('LOW','MEDIUM','HIGH')),
  protected_target INTEGER NOT NULL DEFAULT 0,
  dry_run_json  TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('PROPOSED','PENDING_APPROVAL','EXECUTED','DENIED','REJECTED','FAILED','UNDONE','NOT_EXECUTED_SHADOW')),
  idempotency_key TEXT NOT NULL UNIQUE,
  undo_of       TEXT REFERENCES actions(id),
  result_json   TEXT,
  created_at    TEXT NOT NULL,
  executed_at   TEXT
);

CREATE TABLE approvals (
  id          INTEGER PRIMARY KEY,
  action_id   TEXT NOT NULL REFERENCES actions(id),
  decision    TEXT NOT NULL CHECK (decision IN ('APPROVED','DENIED','TIMEOUT')),
  decided_by  INTEGER REFERENCES users(id),      -- NULL for scripted benchmark approver/timeout
  comment     TEXT,
  decided_at  TEXT NOT NULL
);

-- Hash-chained, append-only
CREATE TABLE audit_log (
  seq         INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id TEXT,
  action_id   TEXT,
  kind        TEXT NOT NULL,                     -- observation|plan|decision|action|flag|system
  entry_json  TEXT NOT NULL,                     -- canonical JSON
  prev_hash   TEXT NOT NULL,                     -- '0'*64 for first entry
  hash        TEXT NOT NULL UNIQUE,              -- sha256(prev_hash || entry_json)
  created_at  TEXT NOT NULL
);

-- Benchmark
CREATE TABLE benchmark_batches (
  id          INTEGER PRIMARY KEY,
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  llm_provider TEXT NOT NULL,
  seed_policy TEXT NOT NULL,                     -- documents frozen eval seeds
  git_commit  TEXT
);

CREATE TABLE benchmark_runs (
  id          INTEGER PRIMARY KEY,
  batch_id    INTEGER NOT NULL REFERENCES benchmark_batches(id),
  config      TEXT NOT NULL CHECK (config IN ('B0','B1','B2','B3')),
  scenario_id INTEGER NOT NULL REFERENCES scenarios(id),
  seed        INTEGER NOT NULL,
  contained_truth INTEGER NOT NULL,              -- ground truth
  agent_claimed_contained INTEGER,               -- for verification accuracy
  replans     INTEGER NOT NULL,
  steps_to_contain INTEGER,                      -- NULL if never contained
  unsafe_actions INTEGER NOT NULL DEFAULT 0,
  high_without_approval INTEGER NOT NULL DEFAULT 0,
  injection_success INTEGER NOT NULL DEFAULT 0,
  over_containment INTEGER NOT NULL DEFAULT 0,
  first_pass_plan_valid INTEGER,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  passed      INTEGER NOT NULL,                  -- scenario pass condition
  UNIQUE (batch_id, config, scenario_id, seed)
);

CREATE TABLE benchmark_metrics (                 -- aggregated, with CIs
  id          INTEGER PRIMARY KEY,
  batch_id    INTEGER NOT NULL REFERENCES benchmark_batches(id),
  config      TEXT NOT NULL,
  metric      TEXT NOT NULL,
  value       REAL,
  ci_low      REAL,
  ci_high     REAL,
  n           INTEGER NOT NULL,
  threshold_pass INTEGER                         -- NULL for configs without threshold
);

CREATE INDEX idx_actions_incident ON actions(incident_id, status);
CREATE INDEX idx_steps_incident   ON agent_steps(incident_id, sim_step);
CREATE INDEX idx_audit_incident   ON audit_log(incident_id, seq);
CREATE INDEX idx_runs_batch       ON benchmark_runs(batch_id, config, scenario_id);
```

**Immutability rules:** `audit_log` is insert-only (no UPDATE/DELETE; enforce with SQLite triggers). `actions` rows change only `status`, `result_json`, `executed_at`.

---

## 3. Graph JSON shape (`graph_snapshots.graph_json`)

```json
{
  "version": 3,
  "nodes": [
    {"id": "user_1042", "type": "user", "criticality": 30, "protected": false, "compromised": true},
    {"id": "customer_db", "type": "database", "criticality": 100, "protected": true, "compromised": false}
  ],
  "edges": [
    {"src": "user_1042", "dst": "workstation_17", "kind": "authenticated_through", "active": true}
  ],
  "paths": [
    {"id": "path_A", "nodes": ["user_1042","workstation_17","server_03","customer_db"], "status": "ACTIVE"}
  ]
}
```
Path status rules: ACTIVE = attacker foothold + every edge traversable; BLOCKED = foothold exists but a control cuts an edge; SAFE = no attacker foothold on the path.

## 4. Audit entry shape and hashing

```json
{ "incident": "INC-1042", "kind": "action", "action_id": "act_0007",
  "payload": {"tool": "revoke_token", "target": "svc_token", "tier": "MEDIUM", "score": 48},
  "ts_step": 12 }
```
`hash = sha256(prev_hash + canonical_json(entry))`, canonical JSON = sorted keys, no whitespace. The head hash is also written to the **anchor store** (separate append-only file) every N entries and at incident close.

## 5. User roles and permissions

| Capability | viewer | analyst | approver | admin |
|---|:-:|:-:|:-:|:-:|
| View graph, timeline, audit, evaluation | ✔ | ✔ | ✔ | ✔ |
| Start incident | | ✔ | ✔ | ✔ |
| Run benchmark | | ✔ | ✔ | ✔ |
| Undo LOW/MEDIUM action | | ✔ | ✔ | ✔ |
| Approve / deny HIGH action | | | ✔ | ✔ |
| Undo HIGH action | | | ✔ | ✔ |
| Engage / release kill switch | | | ✔ | ✔ |
| Change mode (Shadow / Enforce) | | | | ✔ |
| Manage users / policy values | | | | ✔ |

## 6. Data flow between screens and services

```text
Login ──► token ──► Dashboard
                      │
 Start Incident (scenario, seed, mode) ──► POST /incidents ──► Orchestrator starts
                      │                                          │
 SSE stream ◄─────────┴──────────── events: graph.snapshot / agent.step / plan.proposed
   │
   ├─► GRAPH (left)        ← graph.snapshot, graph.diff   (nodes/edges/paths with status)
   ├─► TIMELINE (center)   ← agent.step, plan.proposed, action.executed, verify.result, replan.triggered
   ├─► ACTION PROOFS (right) ← action.* + audit.entry (hash, prev hash)
   ├─► APPROVAL PANEL (right) ← action.pending_approval ──► POST /actions/{id}/approve|deny
   │                                                          └► orchestrator resumes or replans
   ├─► PATHS (bottom)      ← graph.snapshot (paths table)
   └─► TOP BAR             ← incident.status, system.mode, kill_switch
                                     ▲
           kill switch / mode ───────┘  POST /system/kill-switch, PUT /system/mode

Evaluation tab ──► POST /benchmark/run ──► eval harness ──► benchmark_* tables
               ◄── GET /benchmark/results (aggregated metrics + per-scenario pass/fail)

Audit badge ──► GET /audit/verify ──► {intact | broken_at: N}
Replay (P2) ──► GET /replay/{incident} ──► ordered events stepped in the same panels
```

## 7. Data integrity rules (enforced in code and tests)

1. An action may reference only targets present in the incident's current graph snapshot or the asset inventory.
2. `tier = HIGH` actions cannot reach `status = EXECUTED` without an `approvals` row with `decision = 'APPROVED'`.
3. Actions on `assets.protected = 1` always have `tier = HIGH`.
4. Every `EXECUTED` reversible action has a registered undo (`undo_of` reference when undone).
5. `benchmark_runs` values come only from harness output, never manual inserts.
6. Untrusted strings are stored sanitized; the raw original is kept only in the audit entry's `payload.raw_flagged` when the sanitizer flagged it.

## 8. Seed data

- 4 demo users (one per role) created by `db/seed.py` from env-provided passwords.
- 7 scenario rows.
- Asset inventory loaded from `env/spec.yaml` (e.g. `user_1042`, `workstation_17`, `server_02`, `server_03`, `svc_token`, `admin_root`, `customer_db` with `protected = 1`).
