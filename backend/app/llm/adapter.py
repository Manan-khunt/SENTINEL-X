"""LLM adapter interface: structured plan in, no env access."""

from __future__ import annotations

from abc import ABC, abstractmethod


class LLMAdapter(ABC):
    temperature: float = 0
    # Measured accounting for the most recent plan() call. Each adapter sets
    # this from its actual output so the benchmark measures real usage.
    tokens_used_last_plan: int = 0

    @abstractmethod
    def plan(self, structured_state: dict, errors: list[str] | None = None) -> dict:
        """Return dict matching Plan schema. No side effects.

        errors: validation errors from previous attempts in this cycle,
        so the adapter may correct its output. May be None on first pass.
        """
        raise NotImplementedError

    @property
    def name(self) -> str:
        return self.__class__.__name__
