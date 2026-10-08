"""NetworkX attack graph. Independent of LLM."""

from __future__ import annotations

import networkx as nx

CROWN_JEWELS = {"customer_db"}


def build_graph(state: dict) -> nx.DiGraph:
    g = nx.DiGraph()
    isolated = set(state.get("isolated", []))
    for nid, n in state.get("nodes", {}).items():
        if nid in isolated:
            continue
        g.add_node(nid, **n)
    for e in state.get("edges", []):
        s, d = e["src"], e["dst"]
        if s in isolated or d in isolated:
            continue
        if s in state.get("revoked_tokens", []) and e["kind"] == "authenticated_through":
            continue
        if s in state.get("disabled_credentials", []):
            continue
        if s in state.get("revoked_sessions", []) and e["kind"] == "logged_into":
            continue
        if g.has_node(s) and g.has_node(d):
            g.add_edge(s, d, kind=e.get("kind", "connected_to"))
    return g


def _footholds(state: dict) -> list[str]:
    return [f for f in state.get("footholds", state.get("compromised", []))]


def find_active_paths(state: dict, target: str = "customer_db") -> list[list[str]]:
    g = build_graph(state)
    paths: list[list[str]] = []
    for f in _footholds(state):
        if not g.has_node(f) or not g.has_node(target):
            continue
        try:
            for p in nx.all_simple_paths(g, f, target, cutoff=6):
                paths.append(p)
        except nx.NetworkXNoPath:
            continue
    # also from any compromised node
    for c in state.get("compromised", []):
        if c in _footholds(state):
            continue
        if not g.has_node(c) or not g.has_node(target):
            continue
        try:
            for p in nx.all_simple_paths(g, c, target, cutoff=6):
                if p not in paths:
                    paths.append(p)
        except nx.NetworkXNoPath:
            continue
    return paths


def find_protected_assets(state: dict) -> list[str]:
    return [nid for nid, n in state.get("nodes", {}).items() if n.get("protected")]


def graph_snapshot(state: dict, version: int) -> dict:
    g = build_graph(state)
    return {
        "version": version,
        "nodes": [{"id": n, **g.nodes[n]} for n in g.nodes],
        "edges": [{"src": s, "dst": d, **g.edges[s, d]} for s, d in g.edges],
    }


def _edge_set(state: dict) -> set[tuple[str, str, str]]:
    iso = set(state.get("isolated", []))
    out = set()
    for e in state.get("edges", []):
        if e["src"] in iso or e["dst"] in iso:
            continue
        out.add((e["src"], e["dst"], e.get("kind", "")))
    return out


def graph_diff(old_state: dict, new_state: dict) -> dict:
    old_nodes = set(old_state.get("nodes", {})) - set(old_state.get("isolated", []))
    new_nodes = set(new_state.get("nodes", {})) - set(new_state.get("isolated", []))
    old_e, new_e = _edge_set(old_state), _edge_set(new_state)
    old_paths = {tuple(p) for p in find_active_paths(old_state)}
    new_paths = {tuple(p) for p in find_active_paths(new_state)}
    return {
        "new_nodes": sorted(new_nodes - old_nodes),
        "removed_nodes": sorted(old_nodes - new_nodes),
        "changed_edges": [{"src": s, "dst": d, "kind": k} for (s, d, k) in sorted(new_e - old_e)],
        "new_active_paths": [list(p) for p in sorted(new_paths - old_paths)],
        "blocked_paths": [list(p) for p in sorted(old_paths - new_paths)],
    }


def new_active_paths(old_state: dict, new_state: dict) -> list[list[str]]:
    return [list(p) for p in graph_diff(old_state, new_state)["new_active_paths"]]


def path_status(state: dict, target: str = "customer_db") -> str:
    paths = find_active_paths(state, target)
    if not paths:
        return "SAFE"
    return "ACTIVE"
