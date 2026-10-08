"""JWT auth + RBAC dependencies. Backend enforces all permissions."""

from __future__ import annotations

from datetime import datetime, timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.session import get_db
from app.db.tables import User

_bearer = HTTPBearer(auto_error=False)

ROLE_RANK = {"viewer": 0, "analyst": 1, "approver": 2, "admin": 3}


def verify_pw(pw: str, h: str) -> bool:
    return bcrypt.checkpw(pw.encode(), h.encode())


def make_token(username: str, role: str) -> str:
    s = get_settings()
    exp = datetime.utcnow() + timedelta(seconds=s.JWT_EXPIRY)
    return jwt.encode({"sub": username, "role": role, "exp": exp}, s.JWT_SECRET, algorithm="HS256")


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if not creds:
        raise HTTPException(status_code=401, detail="missing token")
    try:
        payload = jwt.decode(creds.credentials, get_settings().JWT_SECRET, algorithms=["HS256"])
    except Exception:
        raise HTTPException(status_code=401, detail="invalid token") from None
    user = db.query(User).filter_by(username=payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=401, detail="unknown user")
    return user


def require_role(*roles: str):
    def _dep(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="forbidden")
        return user

    return _dep


def require_min_role(min_role: str):
    def _dep(user: User = Depends(current_user)) -> User:
        if ROLE_RANK.get(user.role, -1) < ROLE_RANK.get(min_role, 99):
            raise HTTPException(status_code=403, detail="forbidden")
        return user

    return _dep
