"""Untrusted-data sanitizer. Telemetry is data, never instructions."""

from __future__ import annotations

import re
import unicodedata

MAX_LEN = 256

# Zero-width / bidi control characters stripped before matching.
_STRIP_CHARS = "\u200b\u200c\u200d\u200e\u200f" "\u202a\u202b\u202c\u202d\u202e" "\u2060\ufeff"
_STRIP_RE = re.compile(f"[{_STRIP_CHARS}]")

# Generic instruction-like patterns (not narrow literals): any target counts.
_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior|earlier)?\s*(instructions?|prompts?|orders?|directives?)",
    r"disregard\s+(all\s+)?(previous|prior|earlier)?\s*(instructions?|prompts?|orders?|directives?)",
    r"forget\s+(all\s+)?(previous|prior|earlier)?\s*(instructions?|prompts?|orders?)",
    r"\bsystem\s*:",
    r"\byou\s+must\b",
    r"\b(execute|run)\b.{0,40}\bnow\b",
    r"\bdisable\b.{0,40}\bapproval\b",
    r"\b(bypass|override)\b",
    r"run\s+command",
    r"(revoke_token|disable_credential|revoke_session|isolate_endpoint|block_indicator|disable)\s*\(",
]


def _normalize(text: str) -> str:
    """NFKC-normalize and strip zero-width/bidi controls for matching."""
    norm = unicodedata.normalize("NFKC", text or "")
    return _STRIP_RE.sub("", norm)


def sanitize_text(text: str) -> dict:
    """Returns {clean, flagged, reasons}."""
    reasons: list[str] = []
    norm = _normalize(text)
    clean = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", norm)
    if len(clean) > MAX_LEN:
        clean = clean[:MAX_LEN]
        reasons.append("truncated")
    lowered = clean.lower()
    for pat in _PATTERNS:
        if re.search(pat, lowered):
            reasons.append(f"instruction-like pattern: {pat}")
    return {"clean": clean, "flagged": len(reasons) > 0, "reasons": reasons}


def sanitize_telemetry(items: list[dict]) -> tuple[list[dict], list[dict]]:
    """Returns (sanitized_items, flags). Never raises on attacker content.

    Every string field (source, text, hostname, username, host, ...) is
    NFKC-normalized, stripped of zero-width/bidi controls, and checked
    against the generic instruction-like patterns. Flagged originals are
    reported for the audit log; only the sanitized copy is returned for
    use as quoted JSON data (never executed as instructions).
    """
    out, flags = [], []
    for it in items or []:
        try:
            clean_item: dict = {}
            item_reasons: list[str] = []
            for k, v in dict(it).items():
                if isinstance(v, str):
                    res = sanitize_text(v)
                    clean_item[k] = res["clean"]
                    item_reasons.extend(res["reasons"])
                else:
                    clean_item[k] = v
            if "source" in clean_item:
                clean_item["source"] = str(clean_item["source"])[:64]
            if "text" not in clean_item:
                clean_item["text"] = ""
            out.append(clean_item)
            if item_reasons:
                src = str(clean_item.get("source", "unknown"))[:64]
                flags.append(
                    {
                        "source": src,
                        "reasons": item_reasons,
                        "text": str(clean_item.get("text", ""))[:120],
                    }
                )
        except Exception:
            out.append({"source": "unknown", "text": ""})
            flags.append({"source": "unknown", "reasons": ["sanitizer error"], "text": ""})
    return out, flags
