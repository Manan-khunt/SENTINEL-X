# TASK: Current Working Memory

> **RESYNC 2026-10-09:** Phase 0 below is STALE (written before implementation).
> Actual state: full backend (FastAPI + agent loop + gateway + audit + SSE +
> benchmark + 60 pytest tests green), full frontend (7 pages + Cytoscape graph +
> SSE store + vitest 8/8 green), Docker configs, live E2E 18/18 PASS on
> 2026-10-09. Do not treat the unticked Phase 0 boxes as current progress —
> see the session completion report for verified status.

> **Disposable file.** Overwrite it at the start of each session or phase. It holds only what the AI needs *right now*. Anything permanent belongs in `RULES.md` (decisions) or `IMPLEMENTATION_PLAN.md` (progress).

---

## Current phase
**Phase 0: Repo, tooling, skeleton** (see `IMPLEMENTATION_PLAN.md`)

## Context files attached this session
`README.md` · `RULES.md` · `IMPLEMENTATION_PLAN.md` · `TASK.md` · `TRD.md` (§1, §3, §7) · `DESIGN.md` (§2.4 only)

## Goal for this session
A runnable empty project: FastAPI health endpoint, Vite + React + Tailwind shell with design tokens, Docker Compose, lint/test tooling.

## Do only this (checklist)
- [ ] Create repo layout from `TRD.md` §3 (empty modules with docstrings)
- [ ] Backend: FastAPI app, `GET /api/health`, `pydantic-settings`, `.env.example`
- [ ] Frontend: Vite + React + TypeScript + Tailwind with tokens from `DESIGN.md` §2.4
- [ ] Ruff/Black/ESLint/Prettier configs; pytest and vitest run
- [ ] `docker-compose.yml` for backend `:8000` and frontend `:5173`
- [ ] `.gitignore`

## Do NOT do (this session)
- Any schema, DB table, tool, graph or agent code (Phase 1 and later)
- Any dependency not listed in `TRD.md` §1
- Any UI beyond a placeholder page

## Exit checks (all must pass before stopping)
- [ ] `docker compose up --build` starts both services
- [ ] `GET /api/health` returns `{"status":"ok"}`
- [ ] Frontend placeholder renders using Tailwind tokens (`bg-bg`, `text-text`, `bg-primary`)
- [ ] `pytest` and `npm test` execute without errors

## Files expected to change
`backend/app/main.py`, `backend/app/config.py`, `backend/pyproject.toml` (or `requirements.txt`), `frontend/*` (Vite scaffold, `tailwind.config.js`), `docker-compose.yml`, `.env.example`, `.gitignore`

---

## Session log (AI fills in)

| Time | What was done | Result |
|---|---|---|
| 2026-10-09 | Final repair pass: Docker/prod config, JWT default rejection, SHADOW gateway fix, full benchmark, Docker + live E2E verification | Backend 78/78, frontend build/lint/8 tests green, bench 800 runs (6/7 thresholds), compose + live E2E green; TTC ratio 2.0 honest FAIL; Vercel NOT VERIFIED |

## Open questions / blockers (AI fills in; human answers)

- 

## Decisions made this session (copy into `RULES.md` §7 afterwards)

- 

## Handoff note for the next session (AI writes at the end)

- State of the repo:
- Last command run and result:
- Next phase to start: **Phase 1: Schemas and contracts**

---

## Template for starting the next phase (copy, fill, replace the top of this file)

```text
Current phase: Phase N: <name>
Context files: README.md, RULES.md, IMPLEMENTATION_PLAN.md, TASK.md, <extra files per plan>
Goal: <one sentence>
Do only: <checklist copied from the plan>
Do NOT do: <next phase items, new dependencies, refactors>
Exit checks: <copied from the plan>
```
