# SENTINEL-X Tactical Console

The frontend is a focused operator console for the existing FastAPI service. It uses React, TypeScript, Vite, Tailwind CSS, TanStack Query, and Cytoscape.js. All incident, graph, action, audit, system, and evaluation data comes from the backend; the UI does not substitute demo data when requests fail.

## Run locally

Start the backend from the repository root:

```sh
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

In a second terminal, start the frontend:

```sh
cd frontend
npm ci
npm run dev
```

Vite serves the UI at `http://localhost:5173` and proxies `/api` requests to `http://localhost:8000`. Set `VITE_API_BASE_URL` in `frontend/.env` only when the API is hosted elsewhere; the default is `/api`. Use `.env.example` as the safe configuration reference.

## Demo flow

The backend seeds demo users in `backend/app/db/seed.py`. For the analyst walkthrough, sign in with username `analyst` and the seeded development password `analyst123`.

On Dashboard, choose **Adaptive attacker** (`scenario_2`), keep configuration B3, choose ENFORCE mode, and start the incident. Incident creation runs the backend agent loop. The dashboard and incident detail show the graph, timeline events, actions, approval state, and the backend's containment result. In the verified local run, scenario 2 with seed `4209` produced two graph-diff events, an agent replan, two response actions, and a contained result. Runtime outcomes depend on the selected scenario, seed, and backend state.

If an incident remains `RUNNING`, use **Run next cycle** on its detail page. High-risk actions remain pending until an approver or admin decides them. The frontend does not approve actions automatically.

## Checks

From `frontend/` run:

```sh
npm run build
npm test
npm run lint
npm run dev
```

Authentication tokens remain in browser memory. Signing out or reloading requires signing in again.
