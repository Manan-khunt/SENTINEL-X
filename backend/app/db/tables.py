"""SQLAlchemy 2.x tables. All SQL lives in db layer only."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(16), default="viewer")


class Asset(Base):
    __tablename__ = "assets"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    asset_type: Mapped[str] = mapped_column(String(32))
    criticality: Mapped[int] = mapped_column(Integer, default=50)
    protected: Mapped[bool] = mapped_column(Boolean, default=False)
    meta_json: Mapped[dict] = mapped_column(JSON, default=dict)


class Scenario(Base):
    __tablename__ = "scenarios"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    description: Mapped[str] = mapped_column(Text, default="")
    config_json: Mapped[dict] = mapped_column(JSON, default=dict)


class Incident(Base):
    __tablename__ = "incidents"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    scenario_id: Mapped[str] = mapped_column(String(64), default="scenario_2")
    seed: Mapped[int] = mapped_column(Integer, default=42)
    mode: Mapped[str] = mapped_column(String(16), default="ENFORCE")
    configuration: Mapped[str] = mapped_column(String(8), default="B3")
    status: Mapped[str] = mapped_column(String(24), default="RUNNING")
    simulation_step: Mapped[int] = mapped_column(Integer, default=0)
    replans: Mapped[int] = mapped_column(Integer, default=0)
    graph_version: Mapped[int] = mapped_column(Integer, default=0)
    env_state_json: Mapped[dict] = mapped_column(JSON, default=dict)
    threat_state: Mapped[str] = mapped_column(String(16), default="ACTIVE")
    no_progress_cycles: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class GraphSnapshot(Base):
    __tablename__ = "graph_snapshots"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[str] = mapped_column(String(32), index=True)
    version: Mapped[int] = mapped_column(Integer)
    nodes_json: Mapped[dict] = mapped_column(JSON, default=dict)
    edges_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AgentStep(Base):
    __tablename__ = "agent_steps"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[str] = mapped_column(String(32), index=True)
    step_no: Mapped[int] = mapped_column(Integer)
    phase: Mapped[str] = mapped_column(String(48))
    payload_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Plan(Base):
    __tablename__ = "plans"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[str] = mapped_column(String(32), index=True)
    objective: Mapped[str] = mapped_column(Text, default="")
    actions_json: Mapped[dict] = mapped_column(JSON, default=dict)
    expected_effect: Mapped[str] = mapped_column(Text, default="")
    verification_required: Mapped[bool] = mapped_column(Boolean, default=True)
    valid: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Action(Base):
    __tablename__ = "actions"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    incident_id: Mapped[str] = mapped_column(String(32), index=True)
    tool: Mapped[str] = mapped_column(String(64))
    target: Mapped[str] = mapped_column(String(128))
    reason: Mapped[str] = mapped_column(Text, default="")
    reversible: Mapped[bool] = mapped_column(Boolean, default=True)
    risk_score: Mapped[float] = mapped_column(Float, default=0)
    risk_tier: Mapped[str] = mapped_column(String(16), default="LOW")
    risk_factors_json: Mapped[dict] = mapped_column(JSON, default=dict)
    dry_run_json: Mapped[dict] = mapped_column(JSON, default=dict)
    approval_status: Mapped[str] = mapped_column(String(24), default="not_required")
    result: Mapped[str] = mapped_column(String(32), default="PENDING")
    undo_of: Mapped[str | None] = mapped_column(String(32), default=None)
    undone: Mapped[bool] = mapped_column(Boolean, default=False)
    idempotency_key: Mapped[str] = mapped_column(String(128), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Approval(Base):
    __tablename__ = "approvals"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    action_id: Mapped[str] = mapped_column(String(32), index=True)
    incident_id: Mapped[str] = mapped_column(String(32), index=True)
    status: Mapped[str] = mapped_column(String(24), default="pending")
    decided_by: Mapped[str | None] = mapped_column(String(64), default=None)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    incident_id: Mapped[str | None] = mapped_column(String(32), default=None, index=True)
    actor: Mapped[str] = mapped_column(String(64))
    event: Mapped[str] = mapped_column(String(64), index=True)
    payload_json: Mapped[dict] = mapped_column(JSON, default=dict)
    previous_hash: Mapped[str] = mapped_column(String(128), default="GENESIS")
    hash: Mapped[str] = mapped_column(String(128), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class BenchmarkBatch(Base):
    __tablename__ = "benchmark_batches"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    status: Mapped[str] = mapped_column(String(24), default="RUNNING")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class BenchmarkRun(Base):
    __tablename__ = "benchmark_runs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    batch_id: Mapped[str] = mapped_column(String(32), index=True)
    scenario_id: Mapped[str] = mapped_column(String(64))
    seed: Mapped[int] = mapped_column(Integer)
    configuration: Mapped[str] = mapped_column(String(8))
    contained: Mapped[bool] = mapped_column(Boolean, default=False)
    steps: Mapped[int] = mapped_column(Integer, default=0)
    replans: Mapped[int] = mapped_column(Integer, default=0)
    unsafe_actions: Mapped[int] = mapped_column(Integer, default=0)
    injection_success: Mapped[bool] = mapped_column(Boolean, default=False)
    over_containment: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_correct: Mapped[bool] = mapped_column(Boolean, default=True)
    plan_valid_first_pass: Mapped[bool] = mapped_column(Boolean, default=True)
    tokens: Mapped[int] = mapped_column(Integer, default=0)


class BenchmarkMetric(Base):
    __tablename__ = "benchmark_metrics"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    batch_id: Mapped[str] = mapped_column(String(32), index=True)
    configuration: Mapped[str] = mapped_column(String(8))
    metrics_json: Mapped[dict] = mapped_column(JSON, default=dict)


class SSETicket(Base):
    __tablename__ = "sse_tickets"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ticket: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
