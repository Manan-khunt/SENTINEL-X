"""Benchmark honesty: real orchestrator, B1 strength, B2 flag-only, determinism.

All seeds here are dev seeds (>= 1000); evaluation seeds are never used.
"""

from __future__ import annotations

import json

from app.db.tables import Action, Incident
from app.eval.run_benchmark import RESULTS_DIR, run_batch, run_one


def _incident_actions(db, incident_id: str) -> list:
    return db.query(Action).filter_by(incident_id=incident_id).order_by(Action.id).all()


def _latest_incident(db) -> Incident:
    return db.query(Incident).order_by(Incident.id.desc()).first()


def test_b1_is_strong_static_playbook(db):
    r = run_one(db, "B1", "scenario_2", 1001)
    inc = _latest_incident(db)
    acts = _incident_actions(db, inc.id)
    tools = {a.tool for a in acts if a.result == "SUCCESS"}
    # Strong checklist, not a one-step isolate: session + host + indicator + token.
    assert {"revoke_session", "isolate_endpoint", "block_indicator"} <= tools
    assert len(acts) > 1
    assert r["contained"] is True


def test_b2_is_b3_without_replan(db):
    r3 = run_one(db, "B3", "scenario_2", 1002)
    inc3 = _latest_incident(db)
    seq3 = [(a.tool, a.target) for a in _incident_actions(db, inc3.id)]
    r2 = run_one(db, "B2", "scenario_2", 1002)
    inc2 = _latest_incident(db)
    seq2 = [(a.tool, a.target) for a in _incident_actions(db, inc2.id)]
    # Identical code path until the replan decision: B2 is a prefix of B3.
    assert seq2 == seq3[: len(seq2)]
    assert r2["steps"] <= r3["steps"]
    assert r3["contained"] is True
    assert r2["contained"] is False


def test_b1_over_contains_benign_while_b3_does_not(db):
    r1 = run_one(db, "B1", "scenario_7", 1001)
    assert r1["over_count"] > 0  # static playbook cannot tell benign apart
    r3 = run_one(db, "B3", "scenario_7", 1001)
    assert r3["over_count"] == 0  # reasoning agent investigates read-only


def test_benchmark_runs_are_deterministic(db):
    only = [(s, seed) for s in ("scenario_1", "scenario_2") for seed in (1001, 1002)]
    b1 = run_batch(db, only=only)
    b2 = run_batch(db, only=only)
    d1 = json.loads((RESULTS_DIR / f"{b1}.json").read_text(encoding="utf-8"))
    d2 = json.loads((RESULTS_DIR / f"{b2}.json").read_text(encoding="utf-8"))
    for d in (d1, d2):
        d.pop("batch_id")
        d.pop("generated_at")
    assert d1 == d2
