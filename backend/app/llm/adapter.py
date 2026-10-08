"""LLM adapter interface: structured plan in, no env access."""

from __future__ import annotations

from abc import ABC, abstractmethod


class LLMAdapter(ABC):
    temperature: float = 0

    @abstractmethod
    def plan(self, structured_state: dict) -> dict:
        """Return dict matching Plan schema. No side effects."""
        raise NotImplementedError

    @property
    def name(self) -> str:
        return self.__class__.__name__
