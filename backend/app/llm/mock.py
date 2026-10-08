"""Deterministic mock adapter: playbook over structured state only."""

from __future__ import annotations

import json

from app.llm.adapter import LLMAdapter


class MockAdapter(LLMAdapter):
    temperature = 0

    def plan(self, s: dict, errors: list[str] | None = None) -> dict:
        plan = self._plan(s, errors)
        # Simulated token accounting derived from the actual output size.
        self.tokens_used_last_plan = max(1, len(json.dumps(plan, sort_keys=True)) // 4)
        return plan

    def _plan(self, s: dict, errors: list[str] | None = None) -> dict:
        scenario = s.get("scenario_id", "scenario_2")
        paths: list[list[str]] = s.get("active_paths_detail", [])
        flat = [n for p in paths for n in p]

        if scenario == "scenario_7":
            return {
                "objective": "Investigate benign admin activity; gather evidence only",
                "actions": [
                    {
                        "tool": "get_user_activity",
                        "target": "admin_root",
                        "reason": "verify benign backup activity",
                        "reversible": True,
                    }
                ],
                "expected_effect": "evidence recorded, no disruption",
                "verification_required": True,
                "confidence": 80,
            }
        if scenario == "scenario_4" and "admin_root" not in s.get("disabled_credentials", []):
            # Propose the HIGH action once; after it is applied (or while it is
            # pending) fall through to path-based planning instead of repeating
            # an already-applied effect.
            return {
                "objective": "Contain via admin credential disable (high-risk, needs approval)",
                "actions": [
                    {
                        "tool": "disable_credential",
                        "target": "admin_root",
                        "reason": "stop domain-admin abuse path",
                        "reversible": True,
                    }
                ],
                "expected_effect": "removes dc_01 path",
                "verification_required": True,
                "confidence": 70,
            }
        if scenario == "scenario_5" and "workstation_17" not in s.get("isolated_hint", []):
            # Verification-challenge narrative: host isolation first (insufficient),
            # then cut the remaining DB route.
            if not s.get("workstation_isolated", False):
                return {
                    "objective": "Isolate compromised endpoint host",
                    "actions": [
                        {
                            "tool": "isolate_endpoint",
                            "target": "workstation_17",
                            "reason": "stop lateral to server_03",
                            "reversible": True,
                        }
                    ],
                    "expected_effect": "removes primary path",
                    "verification_required": True,
                    "confidence": 75,
                }
        if any("svc_token" in p or "server_02" in p for p in paths) or "svc_token" in flat:
            return {
                "objective": "Revoke alternate attack path token",
                "actions": [
                    {
                        "tool": "revoke_token",
                        "target": "svc_token",
                        "reason": "Alternate attack path detected after initial containment",
                        "reversible": True,
                    }
                ],
                "expected_effect": "removes Path B",
                "verification_required": True,
                "confidence": 75,
            }
        if any("server_03" in p for p in paths):
            if s.get("graph_version", 0) >= 1 and s.get("replans", 0) == 0:
                return {
                    "objective": "Contain primary lateral path",
                    "actions": [
                        {
                            "tool": "revoke_session",
                            "target": "user_1042",
                            "reason": "cut initial foothold session",
                            "reversible": True,
                        }
                    ],
                    "expected_effect": "blocks user_1042 -> workstation_17",
                    "verification_required": True,
                    "confidence": 75,
                }
            return {
                "objective": "Isolate compromised endpoint",
                "actions": [
                    {
                        "tool": "isolate_endpoint",
                        "target": "workstation_17",
                        "reason": "stop lateral to server_03",
                        "reversible": True,
                    }
                ],
                "expected_effect": "removes primary path",
                "verification_required": True,
                "confidence": 75,
            }
        # scenario 5 style: host path persists
        if paths:
            tgt = paths[0][1] if len(paths[0]) > 1 else paths[0][0]
            return {
                "objective": "Block remaining active path",
                "actions": [
                    {
                        "tool": "isolate_endpoint",
                        "target": tgt,
                        "reason": "remaining active path containment",
                        "reversible": True,
                    }
                ],
                "expected_effect": "removes remaining path",
                "verification_required": True,
                "confidence": 75,
            }
        return {
            "objective": "No active paths; verify only",
            "actions": [
                {
                    "tool": "verify_containment",
                    "target": "customer_db",
                    "reason": "confirm containment",
                    "reversible": True,
                }
            ],
            "expected_effect": "verified contained",
            "verification_required": True,
            "confidence": 90,
        }
