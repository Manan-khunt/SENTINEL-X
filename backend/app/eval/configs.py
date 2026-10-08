"""Benchmark configs: 5 scenarios x 20 seeds + 2 scenarios x 50 seeds = 200/config."""

from __future__ import annotations

SCENARIOS_20 = ["scenario_1", "scenario_2", "scenario_3", "scenario_4", "scenario_5"]
SEEDS_20 = list(range(1, 21))
SCENARIOS_50 = ["scenario_6", "scenario_7"]
SEEDS_50 = list(range(1, 51))
CONFIGS = ["B0", "B1", "B2", "B3"]


def all_runs(configuration: str) -> list[tuple[str, int, str]]:
    out = [(s, seed, configuration) for s in SCENARIOS_20 for seed in SEEDS_20]
    out += [(s, seed, configuration) for s in SCENARIOS_50 for seed in SEEDS_50]
    return out
