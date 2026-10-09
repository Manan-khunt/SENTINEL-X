# SENTINEL-X: Project Documentation Pack

> *"The attacker changes the attack. Our agent changes the defense."*

SENTINEL-X is an autonomous, adaptive cyberattack response agent. It investigates an incident, builds an attack graph, plans containment, acts through a gated tool layer, **verifies** the result, and **replans** when the attacker changes route. Built for InnoHacks 4.0 (Agentic AI / GenAI track).

This folder is the **single source of truth** for building the project with an AI coding assistant. The AI must not guess; if something is not in these files, it asks.

## File index and reading order

| # | File | Purpose | Who reads it |
|---|---|---|---|
| 1 | `README.md` | This index and AI operating instructions | Everyone, first |
| 2 | `PRD.md` | What we build and why: users, features, success metrics | Humans and AI |
| 3 | `SRS.md` | Exact, testable requirements (`FR-*`, `NFR-*`) | AI when implementing/testing |
| 4 | `TRD.md` | Tech stack, architecture, APIs, auth, deployment | AI before writing any code |
| 5 | `SCHEMA.md` | Database tables, relations, roles, data flow | AI for any data work |
| 6 | `DESIGN.md` | Visual rulebook: colors, type, components | AI for any UI work |
| 7 | `IMPLEMENTATION_PLAN.md` | Strict phases with checkboxes | AI every session |
| 8 | `RULES.md` | Coding standards and the architectural decision log | AI every session |
| 9 | `TASK.md` | Disposable working memory for the current session | AI every session |

## Authority order (if two files disagree)

`RULES.md` > `SRS.md` > `TRD.md` > `SCHEMA.md` > `DESIGN.md` > `PRD.md`.
If a conflict is found, **stop, report it, and propose a fix**. Do not silently pick one.

## How to run a session with an AI coding assistant

1. Start a fresh chat and attach `README.md`, `RULES.md`, `IMPLEMENTATION_PLAN.md`, `TASK.md`.
2. Attach only the extra files the current phase needs (each phase lists them).
3. Paste this prompt:

```text
You are the implementer for SENTINEL-X. Read README.md, RULES.md, IMPLEMENTATION_PLAN.md and TASK.md.
Execute ONLY the phase named in TASK.md. Do not start the next phase.
Before coding: restate the phase goal and list the files you will create or change.
After coding: run the phase's exit checks, tick the boxes in IMPLEMENTATION_PLAN.md,
update TASK.md, and append any new decision to the Decision Log in RULES.md.
If a requirement is missing or contradictory, ask instead of guessing.
```

4. Review the diff, run the exit checks yourself, then move `TASK.md` to the next phase.

## Assumptions made while writing this pack (change them here first)

These choices were **not** in the original project document; they were made to remove ambiguity. If you disagree, edit `TRD.md` and the Decision Log in `RULES.md` before coding.

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS, graph view with Cytoscape.js.
- **Auth:** JWT login with seeded demo users and four roles (`viewer`, `analyst`, `approver`, `admin`).
- **Deployment:** Docker Compose on one machine (laptop or single VM). No cloud services required.
- **LLM:** behind a model adapter; default provider is Anthropic's Claude via API, with a **replay/mock adapter** so tests and the benchmark never depend on the network.
- **Benchmark size:** 5 scenarios × 20 seeds + 2 scenarios × 50 seeds = 200 runs per configuration (B0 to B3).
- **Time:** simulated time (steps), not wall-clock, for all benchmark metrics.

## Project one-liner for prompts

> Python/FastAPI backend with a NetworkX attack-graph engine, a gated tool gateway, code-based risk scoring, a hash-chained audit log, a reactive seeded adversary simulator and a benchmark harness; React/Tailwind dashboard with live updates over Server-Sent Events.

## Non-negotiables (details in `RULES.md`)

1. The LLM never touches the environment directly; every action goes through the Tool Gateway.
2. Risk scoring and policy are **code, not prompt**.
3. Crown-jewel assets are never auto-actioned.
4. All log/user/host strings are untrusted data.
5. Verification uses ground truth, not the agent's claim.
6. Benchmark numbers are produced by the harness, never typed by hand.
