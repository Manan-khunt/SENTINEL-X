"""Read-only investigation tools (operate on copies, never mutate)."""

from __future__ import annotations

from app.core.graph_engine import build_graph, find_active_paths
from app.core.sanitizer import sanitize_telemetry


def get_user_activity(state: dict, target: str) -> dict:
    items, flags = sanitize_telemetry(state.get("telemetry", []))
    related = [t for t in items if target in t["text"]]
    return {"target": target, "activity": related, "flags": flags}


def get_endpoint_status(state: dict, target: str) -> dict:
    return {
        "target": target,
        "isolated": target in state.get("isolated", []),
        "compromised": target in state.get("compromised", []),
        "node": state.get("nodes", {}).get(target, {}),
    }


def get_service_tokens(state: dict, target: str = "") -> dict:
    toks = [n for n, m in state.get("nodes", {}).items() if m.get("type") == "service_token"]
    return {"tokens": [{"id": t, "revoked": t in state.get("revoked_tokens", [])} for t in toks]}


def get_attack_graph(state: dict, target: str = "") -> dict:
    g = build_graph(state)
    return {
        "nodes": [{"id": n, **g.nodes[n]} for n in g.nodes],
        "edges": [{"src": s, "dst": d, **g.edges[s, d]} for s, d in g.edges],
        "active_paths": find_active_paths(state),
    }
