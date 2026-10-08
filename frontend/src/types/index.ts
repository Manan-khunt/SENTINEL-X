export type Role = 'viewer' | 'analyst' | 'approver' | 'admin';

export interface User {
  username: string;
  role: Role;
  displayName: string;
}

export type IncidentStatus = 
  | 'INVESTIGATING'
  | 'PLANNING'
  | 'EXECUTING'
  | 'CONTAINED'
  | 'FAILED'
  | 'HALTED';

export type OperatingMode = 'ENFORCE' | 'SHADOW';

export type ScenarioId = 
  | 'scenario-1'
  | 'scenario-2'
  | 'scenario-3'
  | 'scenario-4'
  | 'scenario-5'
  | 'scenario-6'
  | 'scenario-7';

export interface Scenario {
  id: ScenarioId;
  numericId: number;
  name: string;
  title: string;
  purpose: string;
  expectedResult: string;
  description: string;
}

export type AssetType = 
  | 'user'
  | 'device'
  | 'workstation'
  | 'server'
  | 'credential'
  | 'service_token'
  | 'service'
  | 'database';

export type NodeStatus = 'COMPROMISED' | 'ISOLATED' | 'TARGETED' | 'SAFE' | 'UNKNOWN';

export interface GraphNode {
  id: string;
  label: string;
  type: AssetType;
  criticality: number; // 0 - 100
  isCrownJewel?: boolean;
  status: NodeStatus;
  isDiff?: boolean;
  diffType?: 'ADDED' | 'REMOVED' | 'CHANGED';
  ipAddress?: string;
  hostname?: string;
  lastObserved?: string;
  activePathsCount?: number;
}

export type EdgeStatus = 'ACTIVE' | 'BLOCKED' | 'SAFE';

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: 'Logged into' | 'Connected to' | 'Can access' | 'Authenticated through' | 'Communicates with';
  status: EdgeStatus;
  isDiff?: boolean;
  diffType?: 'ADDED' | 'REMOVED' | 'CHANGED';
  firstObserved?: string;
  lastObserved?: string;
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  edges: GraphEdge[];
  timestamp: string;
  diffCount: number;
}

export interface GraphDiff {
  addedNodes: string[];
  removedNodes: string[];
  addedEdges: string[];
  removedEdges: string[];
  reason: string;
}

export interface AttackPath {
  id: string;
  label: string;
  nodes: string[];
  status: 'ACTIVE' | 'BLOCKED' | 'SAFE';
  isDiffHighlighted?: boolean;
  description?: string;
}

export type AgentPhase = 
  | 'OBSERVE'
  | 'PLAN'
  | 'DRY-RUN'
  | 'RISK'
  | 'POLICY'
  | 'TOOL CALL'
  | 'VERIFY'
  | 'ADVERSARY'
  | 'GRAPH DIFF'
  | 'REPLAN'
  | 'INCIDENT';

export type StepStatus = 
  | 'SUCCESS'
  | 'EXECUTED'
  | 'NEW PATH'
  | 'REPLAN REQUIRED'
  | 'CONTAINED'
  | 'FAILED'
  | 'PENDING'
  | 'WARNING'
  | 'SANITIZED'
  | 'ESCALATED';

export interface AgentStep {
  id: string;
  stepNumber: number;
  timestamp: string;
  phase: AgentPhase;
  eventType: string;
  summary: string;
  status: StepStatus;
  details?: string;
  structuredReasoning?: string;
  riskScore?: number;
  toolCall?: string;
  target?: string;
  diffDetected?: boolean;
}

export interface RiskFactors {
  criticality: number; // weight 0.35
  blastRadius: number; // weight 0.25
  irreversibility: number; // weight 0.25
  uncertainty: number; // weight 0.15
}

export type ApprovalStatus = 'WAITING' | 'APPROVED' | 'DENIED' | 'TIMED_OUT' | 'NOT_REQUIRED';

export interface ActionProofData {
  id: string;
  incidentId: string;
  agent: string;
  currentThreat: 'ACTIVE' | 'CONTAINED' | 'EVALUATING';
  target: string;
  action: string;
  reason: string;
  riskScore: number;
  riskCategory: 'LOW' | 'MEDIUM' | 'HIGH';
  riskFactors: RiskFactors;
  dryRun: {
    predictedPathRemoval: string;
    protectedAssetImpact: string;
    details: string;
  };
  approval: {
    policyValidated: boolean;
    required: boolean;
    status: ApprovalStatus;
    timeoutSeconds?: number;
    decisionReason?: string;
  };
  reversible: boolean;
  undoId: string;
  result: 'PENDING' | 'EXECUTED' | 'VERIFIED_CONTAINED' | 'FAILED';
  logHash: string;
  previousLogHash: string;
}

export interface Incident {
  id: string;
  scenarioId: ScenarioId;
  scenarioName: string;
  status: IncidentStatus;
  mode: OperatingMode;
  seed: string;
  replans: number;
  currentStep: number;
  totalSteps: number;
  createdAt: string;
  updatedAt: string;
  threatLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  activePaths: AttackPath[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  currentAction?: ActionProofData;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  incidentId: string;
  actor: string;
  event: string;
  action: string;
  target: string;
  result: string;
  hash: string;
  previousHash: string;
}

export interface BenchmarkThreshold {
  name: string;
  target: string;
  description: string;
}

export interface BenchmarkMetricRow {
  name: string;
  target: string;
  unit?: string;
  b0: string | number | null;
  b1: string | number | null;
  b2: string | number | null;
  b3: string | number | null;
}

export interface BenchmarkRun {
  id: string;
  timestamp: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED';
  totalIncidents: number;
  dataset: string;
  metrics: BenchmarkMetricRow[] | null;
}

export interface SystemComponentStatus {
  name: string;
  category: 'CORE' | 'AI' | 'EXECUTION' | 'AUDIT';
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'HALTED';
  latencyMs: number;
  details: string;
  version?: string;
  lastChecked: string;
}

export interface SSEEventPayload {
  event: 
    | 'incident.started'
    | 'agent.step'
    | 'graph.updated'
    | 'graph.diff'
    | 'action.proposed'
    | 'action.approved'
    | 'action.denied'
    | 'action.executed'
    | 'verification.completed'
    | 'adversary.action'
    | 'incident.replanned'
    | 'incident.contained'
    | 'incident.failed'
    | 'incident.halted';
  data: any;
  timestamp: string;
}
