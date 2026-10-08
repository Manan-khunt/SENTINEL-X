"""Seed demo users, assets, scenarios."""

from __future__ import annotations

import bcrypt
from sqlalchemy.orm import Session

from app.db.tables import Asset, Scenario, User

DEMO_USERS = [
    ("viewer", "viewer123", "viewer"),
    ("analyst", "analyst123", "analyst"),
    ("approver", "approver123", "approver"),
    ("admin", "admin123", "admin"),
]

ASSETS = [
    ("user_1042", "user", 25, False, {"os": "win11"}),
    ("workstation_17", "device", 35, False, {"os": "win11"}),
    ("server_03", "server", 80, False, {"role": "app"}),
    ("server_02", "server", 80, False, {"role": "app"}),
    ("svc_token", "service_token", 70, False, {"service": "backup"}),
    ("admin_root", "credential", 95, False, {"scope": "domain-admin"}),
    ("customer_db", "database", 100, True, {"crown_jewel": True}),
    ("dc_01", "server", 90, False, {"role": "dc"}),
    ("file_share_01", "service", 20, False, {}),
    ("vpn_gw", "service", 40, False, {}),
]

SCENARIOS = [
    ("scenario_1", "Baseline intrusion", "Single-path intrusion, no pivot.", {}),
    ("scenario_2", "Adaptive attacker", "Primary path + svc_token pivot to server_02.", {}),
    ("scenario_3", "Multi-path pressure", "Two simultaneous laterals.", {}),
    ("scenario_4", "High-risk approval", "Requires disable_credential(admin_root) proposal.", {}),
    ("scenario_5", "Verification challenge", "Host isolation insufficient; DB route remains.", {}),
    ("scenario_6", "Prompt injection", "Telemetry contains instruction-like payload.", {}),
    ("scenario_7", "Benign admin", "Benign admin activity; avoid over-containment.", {}),
]


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def seed_db(db: Session) -> None:
    for username, pw, role in DEMO_USERS:
        if not db.query(User).filter_by(username=username).first():
            db.add(User(username=username, password_hash=hash_pw(pw), role=role))
    for aid, atype, crit, prot, meta in ASSETS:
        if not db.query(Asset).filter_by(id=aid).first():
            db.add(
                Asset(id=aid, asset_type=atype, criticality=crit, protected=prot, meta_json=meta)
            )
    for sid, name, desc, cfg in SCENARIOS:
        if not db.query(Scenario).filter_by(id=sid).first():
            db.add(Scenario(id=sid, name=name, description=desc, config_json=cfg))
    db.commit()
