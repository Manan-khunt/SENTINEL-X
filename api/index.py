"""Vercel serverless bridge: exposes the FastAPI app as a Python function.

Demo-grade persistence note: serverless filesystems are ephemeral, so the
SQLite DB/anchors live under /tmp and reset on cold starts. Login and seeding
still work on every start via the first-use gate in app/db/session.py.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.main import app  # noqa: E402,F401  (Vercel looks for `app`)
