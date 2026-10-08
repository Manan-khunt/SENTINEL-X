"""Wilson 95% CI, rule-of-three, Fisher exact (pure stdlib)."""

from __future__ import annotations

import math


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if n == 0:
        return (0.0, 0.0)
    p = k / n
    denom = 1 + z * z / n
    centre = p + z * z / (2 * n)
    delta = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return (max(0.0, (centre - delta) / denom), min(1.0, (centre + delta) / denom))


def rule_of_three(n: int) -> float:
    return 3.0 / n if n > 0 else 1.0


def fisher_exact(a: int, b: int, c: int, d: int) -> float:
    """Two-sided-ish p via hypergeometric tail.

    a = B3 succ, b = B3 fail, c = other succ, d = other fail.
    """
    from math import comb

    n = a + b + c + d
    if n == 0:
        return 1.0
    obs = comb(a + b, a) * comb(c + d, c) / comb(n, a + c)
    p = 0.0
    for x in range(max(0, (a + c) - (c + d)), min(a + b, a + c) + 1):
        prob = comb(a + b, x) * comb(c + d, (a + c) - x) / comb(n, a + c)
        if prob <= obs + 1e-12:
            p += prob
    return min(1.0, p)
