"""Verify tool wrapper."""

from __future__ import annotations

from app.core.verifier import verify_containment as _verify


def verify_tool(state: dict) -> dict:
    return _verify(state)
