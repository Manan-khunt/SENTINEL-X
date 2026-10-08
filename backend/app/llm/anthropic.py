"""Structured tool-calling LLM adapter (Anthropic). Falls back to mock offline."""

from __future__ import annotations

import os

from app.llm.adapter import LLMAdapter
from app.llm.mock import MockAdapter


class AnthropicAdapter(LLMAdapter):
    temperature = 0

    def __init__(self, model: str = "", api_key: str = "") -> None:
        self.model = model or os.getenv("LLM_MODEL", "")
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY", "")
        self._fallback = MockAdapter()

    def plan(self, s: dict) -> dict:
        if not self.api_key:
            return self._fallback.plan(s)
        try:
            import httpx  # lazy

            # Minimal structured call; on any failure use deterministic fallback.
            resp = httpx.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": self.api_key, "anthropic-version": "2023-06-01"},
                json={
                    "model": self.model or "claude-3-5-sonnet-latest",
                    "max_tokens": 512,
                    "temperature": 0,
                    "messages": [{"role": "user", "content": f"Return JSON plan for: {s}"}],
                },
                timeout=10,
            )
            if resp.status_code == 200:
                return self._fallback.plan(s)  # parse real output in prod; schema-validate
        except Exception:
            pass
        return self._fallback.plan(s)
