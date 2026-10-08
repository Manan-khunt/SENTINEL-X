"""Tool registry: closed set of allowed tools, JSON schemas."""

from __future__ import annotations

READ_TOOLS = {
    "get_user_activity",
    "get_endpoint_status",
    "get_service_tokens",
    "get_attack_graph",
    "simulate_action",
    "verify_containment",
}
WRITE_TOOLS = {
    "revoke_session",
    "revoke_token",
    "isolate_endpoint",
    "block_indicator",
    "disable_credential",
    "undo_action",
}
ALL_TOOLS = READ_TOOLS | WRITE_TOOLS

REVERSIBLE = {
    "revoke_session",
    "revoke_token",
    "isolate_endpoint",
    "block_indicator",
    "disable_credential",
    "undo_action",
}


def tool_exists(name: str) -> bool:
    return name in ALL_TOOLS


def is_write_tool(name: str) -> bool:
    return name in WRITE_TOOLS
