// Backend-accurate types. Source of truth: FastAPI OpenAPI (/openapi.json)
// + app/core/models.py. No mock shapes.

export type Role = 'viewer' | 'analyst' | 'approver' | 'admin';

export type IncidentStatus =
  | 'RUNNING'
  | 'AWAITING_APPROVAL'
  | 'CONTAINED'
  | 'ESCALATED'
  | 'FAILED'
  | 'HALTED';

export type Mode = 'SHADOW' | 'ENFORCE';
export type Configuration = 'B0' | 'B1' | 'B2' | 'B3';
export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH';
export type PathState = 'ACTIVE' | 'BLOCKED' | 'SAFE';

export interface User {
  id: number;
  username: string;
  role: Role;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
}

export interface Incident {
  id: string;
  scenario: string;
  seed: number;
  mode: Mode;
  configuration: Configuration;
  status: IncidentStatus;
  simulation_step: number;
  replans: number;
  graph_version: number;
}

export interface GraphNode {
  id: string;
  type: string;
  criticality: number;
  protected?: boolean;
  [k: string]: unknown;
}

export interface GraphEdge {
  src: string;
  dst: string;
  kind: string;
  via?: string;
  [k: string]: unknown;
}

export interface GraphSnapshot {
  version: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface PathEntry {
  nodes: string[];
  state: PathState;
}

export interface PathsResponse {
  paths: PathEntry[];
  status: string;
}

export interface TimelineStep {
  phase: string;
  payload: Record<string, unknown>;
}

export interface TimelineAuditEvent {
  event: string;
  actor: string;
  payload: Record<string, unknown>;
}

export interface Timeline {
  steps: TimelineStep[];
  events: TimelineAuditEvent[];
}

export interface ActionItem {
  id: string;
  incident_id: string;
  tool: string;
  target: string;
  reason: string;
  reversible: boolean;
  risk_score: number;
  risk_tier: RiskTier;
  approval_status: string;
  result: string;
  undo_of: string | null;
  undone: boolean;
  created_at: string | null;
}

export interface ActionProof {
  incident: string;
  agent: string;
  threat: string;
  target: string;
  action: string;
  reason: string;
  risk: string;
  criticality: number;
  blast: number;
  irreversibility: number;
  uncertainty: number;
  dry_run: string;
  approval: string;
  reversible: boolean;
  undo: string | null;
  result: string;
  log_hash: string;
  previous_hash: string;
}

export interface AuditRecord {
  id: number;
  incident_id?: string | null;
  actor: string;
  event: string;
  payload: Record<string, unknown>;
  previous_hash: string;
  hash: string;
}

export interface AuditDetail {
  incident_id: string;
  chain: string;
  entries: AuditRecord[];
}

export interface AuditVerify {
  ok: boolean;
  status: string;
  broken_at: number | null;
  incident_id: string | null;
}

export interface BenchmarkBatch {
  batch_id: string;
  status: string;
  metrics: Record<string, unknown>;
  comparison: Record<string, unknown>;
}

export interface Replay {
  incident_id: string;
  events: { id: number; event: string; hash: string; previous_hash: string }[];
}

export interface Health {
  api: string;
  database: string;
  environment: string;
  agent: string;
  version: string;
}

export interface GraphDiffPayload {
  new_nodes: string[];
  removed_nodes: string[];
  changed_edges: { src: string; dst: string; kind: string }[];
  new_active_paths: string[][];
  blocked_paths: string[][];
}

export interface LiveEvent {
  type: string;
  data: unknown;
  at: string;
}

export const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  analyst: 1,
  approver: 2,
  admin: 3,
};

export function roleAtLeast(role: Role | undefined, min: Role): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}
