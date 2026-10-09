"""Pydantic v2 schemas: incident state, plan, API responses."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

Mode = Literal["SHADOW", "ENFORCE"]
Configuration = Literal["B0", "B1", "B2", "B3"]
IncidentStatus = Literal[
    "RUNNING", "AWAITING_APPROVAL", "CONTAINED", "ESCALATED", "FAILED", "HALTED"
]
Role = Literal["viewer", "analyst", "approver", "admin"]
RiskTier = Literal["LOW", "MEDIUM", "HIGH"]
PathState = Literal["ACTIVE", "BLOCKED", "SAFE"]


class StructuredIncidentState(BaseModel):
    incident: str
    compromised_identity: str
    affected_assets: list[str] = Field(default_factory=list)
    known_indicators: list[str] = Field(default_factory=list)
    reachable_targets: list[str] = Field(default_factory=list)
    active_paths: int = 0
    graph_version: int = 0


class PlanAction(BaseModel):
    tool: str
    target: str
    reason: str = ""
    reversible: bool = True


class Plan(BaseModel):
    objective: str
    actions: list[PlanAction] = Field(min_length=1, max_length=5)
    expected_effect: str = ""
    verification_required: bool = True
    confidence: int = Field(default=75, ge=0, le=100)


class RiskFactors(BaseModel):
    criticality: float
    blast_radius: float
    irreversibility: float
    uncertainty: float


class RiskScore(BaseModel):
    score: float
    tier: RiskTier
    factors: RiskFactors


class GraphPath(BaseModel):
    nodes: list[str]
    state: PathState


class GraphSnapshotOut(BaseModel):
    version: int
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]


class GraphDiff(BaseModel):
    new_nodes: list[str] = Field(default_factory=list)
    removed_nodes: list[str] = Field(default_factory=list)
    changed_edges: list[dict[str, Any]] = Field(default_factory=list)
    new_active_paths: list[list[str]] = Field(default_factory=list)
    blocked_paths: list[list[str]] = Field(default_factory=list)


class IncidentOut(BaseModel):
    id: str
    scenario: str
    seed: int
    mode: Mode
    configuration: Configuration
    status: IncidentStatus
    simulation_step: int
    replans: int
    graph_version: int


class ActionOut(BaseModel):
    id: str
    incident_id: str
    tool: str
    target: str
    reason: str = ""
    reversible: bool = True
    risk_score: float = 0
    risk_tier: RiskTier = "LOW"
    approval_status: str = "not_required"
    result: str = "PENDING"
    undo_of: str | None = None
    undone: bool = False
    created_at: datetime | None = None


class ActionProof(BaseModel):
    incident: str
    agent: str = "SENTINEL-X"
    threat: str
    target: str
    action: str
    reason: str
    risk: str
    criticality: float
    blast: float
    irreversibility: float
    uncertainty: float
    dry_run: str
    approval: str
    reversible: bool
    undo: str | None = None
    result: str
    log_hash: str = ""
    previous_hash: str = ""


class AuditEntryOut(BaseModel):
    id: int
    incident_id: str | None = None
    actor: str
    event: str
    payload: dict[str, Any] = Field(default_factory=dict)
    previous_hash: str
    hash: str
    created_at: datetime | None = None


class LoginRequest(BaseModel):
    username: str = Field(examples=["analyst"])
    password: str = Field(examples=["analyst123"])


class TokenResponse(BaseModel):
    access_token: str = Field(examples=["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."])
    token_type: str = Field(default="bearer", examples=["bearer"])


class UserOut(BaseModel):
    id: int
    username: str
    role: Role


class CreateIncidentRequest(BaseModel):
    scenario_id: str = Field(default="scenario_2", examples=["scenario_2"])
    seed: int = Field(default=42, examples=[42])
    mode: Mode = Field(default="ENFORCE", examples=["ENFORCE"])
    configuration: Configuration = Field(default="B3", examples=["B3"])


class HealthOut(BaseModel):
    api: str = Field(examples=["ok"])
    database: str = Field(examples=["ok"])
    environment: str = Field(examples=["ok"])
    agent: str = Field(examples=["RUNNING"])
    version: str = Field(examples=["3.0.0"])


class DiagnosticCheck(BaseModel):
    status: str = Field(examples=["healthy"])
    detail: str = Field(default="", examples=["SELECT 1 ok in 1.2ms"])
    latency_ms: float | None = None


class DiagnosticsOut(BaseModel):
    status: str = Field(examples=["healthy"])
    version: str = Field(examples=["3.0.0"])
    checks: dict[str, DiagnosticCheck] = Field(default_factory=dict)
