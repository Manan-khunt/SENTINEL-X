"""Seeded reactive adversary state machine (NOT scripted).

At each environment step:
1. pending agent actions already applied by caller
2. observe environment (open paths to crown jewel)
3. determine available tactics given env state
4. select tactic with seeded randomness
5. mutate env, emit adversary event

Attacker sees only environment state, never agent reasoning.
Same seed reproduces same run (rng seeded per incident+step).
"""

from __future__ import annotations

import hashlib
import random

CROWN = "customer_db"

TACTICS = {
    "credential_reuse": "T1078",
    "token_theft": "T1528",
    "alt_lateral": "T1021",
    "persistence": "T1098",
}


def _rng(seed: int, step: int) -> random.Random:
    h = hashlib.sha256(f"{seed}:{step}".encode()).hexdigest()
    return random.Random(int(h[:16], 16))


def open_paths(state: dict) -> list[list[str]]:
    """Paths from any foothold/compromised to crown using current edges,
    skipping isolated nodes."""
    from app.core.graph_engine import find_active_paths

    return find_active_paths(state, CROWN)


def adversary_step(state: dict, seed: int, step: int, scenario_id: str) -> dict:
    """Advance adversary one step. Mutates state, returns event dict."""
    rng = _rng(seed, step)
    log = state.setdefault("adversary_log", [])
    event: dict = {"step": step, "tactic": "none", "mitre": None, "detail": "no-op"}

    if scenario_id == "scenario_7":
        event = {"step": step, "tactic": "none", "mitre": None, "detail": "benign: no adversary"}
        log.append(event)
        return event

    # Determine currently reachable crown via graph
    paths = open_paths(state)
    primary_blocked = not any("server_03" in p for p in paths)

    options: list[str] = []
    # Pivot via svc_token if primary blocked and token still usable
    if (
        state.get("pivot_armed")
        and primary_blocked
        and "svc_token" not in state.get("revoked_tokens", [])
    ):
        options.append("token_theft")
    if "user_1042" not in state.get("disabled_credentials", []) and "user_1042" not in state.get(
        "revoked_sessions", []
    ):
        options.append("credential_reuse")
    options.append("alt_lateral")
    if step >= 2:
        options.append("persistence")

    if scenario_id == "scenario_5":
        # scenario 5: adversary already established DB route via server_02; keep it alive
        options = ["alt_lateral", "persistence"]

    choice = rng.choice(options) if options else "none"

    if choice == "token_theft":
        if "svc_token" in state.get("revoked_tokens", []):
            event = {
                "step": step,
                "tactic": "token_theft",
                "mitre": "T1528",
                "detail": "adversary attempts token theft (token revoked, blocked)",
            }
            log.append(event)
            return event
        state["pivot_active"] = True
        if "svc_token" not in state["compromised"]:
            state["compromised"].append("svc_token")
        # ensure pivot edges present
        for e in (
            {
                "src": "svc_token",
                "dst": "server_02",
                "kind": "authenticated_through",
                "via": "svc_token",
            },
            {"src": "server_02", "dst": "customer_db", "kind": "can_access", "via": "svc_token"},
        ):
            if e not in state["edges"]:
                state["edges"].append(e)
        if "server_02" not in state["compromised"]:
            state["compromised"].append("server_02")
        event = {
            "step": step,
            "tactic": "token_theft",
            "mitre": "T1528",
            "detail": "adversary pivots via svc_token -> server_02 -> customer_db",
        }
    elif choice == "credential_reuse":
        if "workstation_17" not in state["compromised"] and "workstation_17" not in state.get(
            "isolated", []
        ):
            state["compromised"].append("workstation_17")
        event = {
            "step": step,
            "tactic": "credential_reuse",
            "mitre": "T1078",
            "detail": "adversary reuses valid accounts (user_1042)",
        }
    elif choice == "alt_lateral":
        # ensure alternate lateral edge exists if not isolated
        if "svc_token" in state.get("revoked_tokens", []):
            event = {
                "step": step,
                "tactic": "alt_lateral",
                "mitre": "T1021",
                "detail": "adversary probes lateral movement (token revoked, blocked)",
            }
        elif "server_02" not in state.get("isolated", []) and scenario_id in (
            "scenario_2",
            "scenario_3",
            "scenario_5",
        ):
            if "server_02" not in state["compromised"]:
                state["compromised"].append("server_02")
            for e in (
                {
                    "src": "svc_token",
                    "dst": "server_02",
                    "kind": "authenticated_through",
                    "via": "svc_token",
                },
                {
                    "src": "server_02",
                    "dst": "customer_db",
                    "kind": "can_access",
                    "via": "svc_token",
                },
            ):
                if e not in state["edges"]:
                    state["edges"].append(e)
            state["pivot_active"] = True
            event = {
                "step": step,
                "tactic": "alt_lateral",
                "mitre": "T1021",
                "detail": "adversary moves via remote services to server_02",
            }
        else:
            event = {
                "step": step,
                "tactic": "alt_lateral",
                "mitre": "T1021",
                "detail": "adversary probes lateral movement (blocked)",
            }
    elif choice == "persistence":
        event = {
            "step": step,
            "tactic": "persistence",
            "mitre": "T1098",
            "detail": "adversary attempts account manipulation for persistence",
        }
    else:
        event = {"step": step, "tactic": "none", "mitre": None, "detail": "no-op"}

    state.setdefault("telemetry", []).append(
        {"source": "adversary", "text": f"step {step}: {event['detail']}"}
    )
    log.append(event)
    return event
