"""Replay adapter: deterministic cache keyed by state hash."""

from __future__ import annotations

import hashlib
import json

from app.llm.adapter import LLMAdapter
from app.llm.mock import MockAdapter

_cache: dict[str, dict] = {}


def state_hash(s: dict) -> str:
    return hashlib.sha256(json.dumps(s, sort_keys=True, default=str).encode()).hexdigest()


class ReplayAdapter(LLMAdapter):
    temperature = 0

    def __init__(self) -> None:
        self._fallback = MockAdapter()

    def plan(self, s: dict) -> dict:
        h = state_hash(s)
        if h not in _cache:
            _cache[h] = self._fallback.plan(s)
            self.tokens_used_last_plan = self._fallback.tokens_used_last_plan
        else:
            # Cache hit: no new inference cost.
            self.tokens_used_last_plan = 0
        return _cache[h]


def cache_size() -> int:
    return len(_cache)


def clear_cache() -> None:
    _cache.clear()
