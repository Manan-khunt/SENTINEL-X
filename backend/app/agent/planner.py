"""Plan validation: Pydantic schema + closed tool/target set."""

from __future__ import annotations

from app.core.models import Plan
from app.tools import registry


def validate_plan(raw: dict) -> tuple[Plan | None, str]:
    try:
        plan = Plan(**raw)
    except Exception as e:
        return None, f"schema error: {e}"
    for a in plan.actions:
        if not registry.tool_exists(a.tool):
            return None, f"unknown tool: {a.tool}"
        if not a.target or len(a.target) > 128:
            return None, f"bad target: {a.target}"
    return plan, "ok"
