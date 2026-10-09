"""Policy gateway: code-only safety. Never LLM-prompt-based."""

from __future__ import annotations


def policy_check(tier: str, target: str, state: dict, mode: str) -> dict:
    """Returns {allowed, approval_required, reason}."""
    nodes = state.get("nodes", {})
    is_protected = bool(nodes.get(target, {}).get("protected", False))
    if is_protected:
        return {
            "allowed": False,
            "approval_required": True,
            "reason": "crown-jewel target: never auto-execute",
        }
    if mode == "SHADOW":
        # Recommend-only: the gateway records SHADOW_RECOMMEND and never
        # executes. `allowed` must be True here so the gateway reaches its
        # SHADOW branch instead of mislabeling the action BLOCKED.
        # Protected targets are handled above and still require approval.
        return {
            "allowed": True,
            "approval_required": False,
            "reason": "shadow mode: recommend only",
        }
    if tier == "HIGH":
        return {
            "allowed": False,
            "approval_required": True,
            "reason": "high-risk action requires human approval",
        }
    if tier == "MEDIUM":
        return {
            "allowed": True,
            "approval_required": False,
            "reason": "medium: validated + dry-run + execute + notify",
        }
    return {
        "allowed": True,
        "approval_required": False,
        "reason": "low: auto-execute bounded action",
    }
