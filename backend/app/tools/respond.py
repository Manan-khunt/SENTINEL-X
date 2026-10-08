"""Response tools: pure state transitions on cloned env state."""

from __future__ import annotations

from app.env.environment import apply_agent_effect, clone


def simulate_action(state: dict, tool: str, target: str) -> dict:
    """Dry-run: clone state, apply effect, report removed paths."""
    from app.core.graph_engine import find_active_paths

    before = find_active_paths(state)
    trial = clone(state)
    apply_agent_effect(trial, tool, target)
    # simulate isolation also for dry-run of graph removal
    after = find_active_paths(trial)
    removed = [p for p in before if p not in after]
    return {
        "tool": tool,
        "target": target,
        "removes_paths": removed,
        "paths_before": len(before),
        "paths_after": len(after),
    }


def apply_response_action(state: dict, tool: str, target: str) -> dict:
    """Apply a validated write tool to live state."""
    return apply_agent_effect(state, tool, target)
