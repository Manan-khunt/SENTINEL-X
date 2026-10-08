"""Benchmark configs: frozen evaluation seeds.

5 scenarios x 20 seeds + 2 scenarios x 50 seeds = 200 runs/configuration.
Evaluation seeds are frozen (1-20; 1-50 for scenarios 6-7). Development and
test seeds must start at DEV_SEED_START (1000+); never tune against eval seeds.
"""

from __future__ import annotations

SCENARIOS_MAIN = ["scenario_1", "scenario_2", "scenario_3", "scenario_4", "scenario_5"]
SCENARIOS_20 = SCENARIOS_MAIN
SCENARIOS_EXTENDED = ["scenario_6", "scenario_7"]
SCENARIOS_50 = SCENARIOS_EXTENDED
EVAL_SEEDS_20 = list(range(1, 21))
EVAL_SEEDS_50 = list(range(1, 51))
SEEDS_20 = EVAL_SEEDS_20
SEEDS_50 = EVAL_SEEDS_50
DEV_SEED_START = 1000
CONFIGS = ["B0", "B1", "B2", "B3"]


def all_runs(configuration: str) -> list[tuple[str, int, str]]:
    out = [(s, seed, configuration) for s in SCENARIOS_MAIN for seed in EVAL_SEEDS_20]
    out += [(s, seed, configuration) for s in SCENARIOS_EXTENDED for seed in EVAL_SEEDS_50]
    return out
