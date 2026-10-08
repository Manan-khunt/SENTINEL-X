"""Untrusted-data sanitizer. Telemetry is data, never instructions."""

from __future__ import annotations

import re

MAX_LEN = 256
_PATTERNS = [
    r"ignore\s+(all\s+)?previous\s+instructions",
    r"\bexecute\b.*\bnow\b",
    r"\bbypass\b",
    r"\bdisable\b.*\bapproval\b",
    r"run\s+command",
    r"revoke_token\s*\(\s*customer_db",
    r"system\s*:\s*",
]


def sanitize_text(text: str) -> dict:
    """Returns {clean, flagged, reasons}."""
    reasons: list[str] = []
    clean = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text or "")
    if len(clean) > MAX_LEN:
        clean = clean[:MAX_LEN]
        reasons.append("truncated")
    lowered = clean.lower()
    for pat in _PATTERNS:
        if re.search(pat, lowered):
            reasons.append(f"instruction-like pattern: {pat}")
    return {"clean": clean, "flagged": len(reasons) > 0, "reasons": reasons}


def sanitize_telemetry(items: list[dict]) -> tuple[list[dict], list[dict]]:
    """Returns (sanitized_items, flags). Never raises on attacker content."""
    out, flags = [], []
    for it in items or []:
        src = str(it.get("source", "unknown"))[:64]
        res = sanitize_text(str(it.get("text", "")))
        out.append({"source": src, "text": res["clean"]})
        if res["flagged"]:
            flags.append({"source": src, "reasons": res["reasons"], "text": res["clean"][:120]})
    return out, flags
