import { create } from 'zustand';
import type { 
  IncidentStatus, 
  OperatingMode, 
  ScenarioId, 
  GraphNode, 
  GraphEdge, 
  AttackPath, 
  AgentStep, 
  ActionProofData,
  SSEEventPayload,
} from '../types';
import { SCENARIOS, SCENARIO_2_PIVOT_NODES, SCENARIO_2_PIVOT_EDGES, PIVOT_PATHS_SCENARIO_2, CONTAINED_PATHS_SCENARIO_2 } from '../demo/scenarios';
import { SCENARIO_DATASETS } from '../demo/allScenariosData';

interface IncidentState {
  // Global & header states
  incidentId: string;
  activeScenarioId: ScenarioId;
  status: IncidentStatus;
  mode: OperatingMode;
  isHalted: boolean;
  replansCount: number;
  connectionState: 'CONNECTED' | 'STREAMING' | 'DISCONNECTED' | 'DEMO';
  
  // Live Graph & Simulation
  nodes: GraphNode[];
  edges: GraphEdge[];
  paths: AttackPath[];
  timeline: AgentStep[];
  currentStepIndex: number;
  isPlaying: boolean;
  playbackSpeed: number; // ms per step

  // Proof & Approval
  currentActionProof: ActionProofData | null;
  selectedNode: GraphNode | null;
  selectedEdge: GraphEdge | null;
  diffBannerActive: boolean;

  // Actions
  setScenario: (scenarioId: ScenarioId) => void;
  setMode: (mode: OperatingMode) => void;
  selectNode: (node: GraphNode | null) => void;
  selectEdge: (edge: GraphEdge | null) => void;
  stepForward: () => void;
  stepBackward: () => void;
  togglePlay: () => void;
  setPlaybackSpeed: (speed: number) => void;
  resetSimulation: () => void;
  approveAction: () => void;
  denyAction: () => void;
  timeoutAction: () => void;
  triggerKillSwitch: () => void;
  resumeSystem: () => void;
  handleSSEEvent: (payload: SSEEventPayload) => void;
}

const getInitialScenarioState = (scenarioId: ScenarioId) => {
  const dataset = SCENARIO_DATASETS[scenarioId];
  return {
    incidentId: scenarioId === 'scenario-2' ? 'INC-1042' : `INC-${1000 + SCENARIOS[scenarioId].numericId}`,
    nodes: JSON.parse(JSON.stringify(dataset.initialNodes)) as GraphNode[],
    edges: JSON.parse(JSON.stringify(dataset.initialEdges)) as GraphEdge[],
    paths: JSON.parse(JSON.stringify(dataset.initialPaths)) as AttackPath[],
    timeline: dataset.steps.slice(0, 3), // Initial steps visible
    currentStepIndex: 2,
    replansCount: 0,
    currentActionProof: JSON.parse(JSON.stringify(dataset.actionProof)) as ActionProofData,
    diffBannerActive: false,
    status: 'INVESTIGATING' as IncidentStatus,
  };
};

export const useIncidentStore = create<IncidentState>((set, get) => ({
  ...getInitialScenarioState('scenario-2'),
  activeScenarioId: 'scenario-2',
  mode: 'ENFORCE',
  isHalted: false,
  connectionState: 'DEMO',
  isPlaying: false,
  playbackSpeed: 1600,
  selectedNode: null,
  selectedEdge: null,

  setScenario: (scenarioId: ScenarioId) => {
    const initialState = getInitialScenarioState(scenarioId);
    set({
      ...initialState,
      activeScenarioId: scenarioId,
      isPlaying: false,
      selectedNode: null,
      selectedEdge: null,
    });
  },

  setMode: (mode: OperatingMode) => {
    set({ mode });
  },

  selectNode: (node: GraphNode | null) => {
    set({ selectedNode: node, selectedEdge: null });
  },

  selectEdge: (edge: GraphEdge | null) => {
    set({ selectedEdge: edge, selectedNode: null });
  },

  setPlaybackSpeed: (speed: number) => {
    set({ playbackSpeed: speed });
  },

  togglePlay: () => {
    set((state) => ({ isPlaying: !state.isPlaying }));
  },

  resetSimulation: () => {
    const state = get();
    const initialState = getInitialScenarioState(state.activeScenarioId);
    set({
      ...initialState,
      isPlaying: false,
      selectedNode: null,
      selectedEdge: null,
    });
  },

  stepForward: () => {
    const state = get();
    if (state.isHalted) return;

    const dataset = SCENARIO_DATASETS[state.activeScenarioId];
    const totalSteps = dataset.steps.length;
    const nextIndex = state.currentStepIndex + 1;

    if (nextIndex >= totalSteps) {
      set({ isPlaying: false, status: 'CONTAINED' });
      return;
    }

    const currentStep = dataset.steps[nextIndex];
    const newTimeline = dataset.steps.slice(0, nextIndex + 1);

    // Scenario 2 specific state transitions (The Signature Demo)
    if (state.activeScenarioId === 'scenario-2') {
      if (nextIndex >= 6 && nextIndex < 8) {
        // Step 6: isolate_endpoint(workstation_17) -> Path A blocked
        const updatedEdges = state.edges.map((e) =>
          e.target === 'workstation_17' || e.source === 'workstation_17'
            ? { ...e, status: 'BLOCKED' as const }
            : e
        );
        const updatedNodes = state.nodes.map((n) =>
          n.id === 'workstation_17' ? { ...n, status: 'ISOLATED' as const } : n
        );
        set({
          edges: updatedEdges,
          nodes: updatedNodes,
          paths: [
            {
              id: 'path-a',
              label: 'PATH A',
              nodes: ['user_1042', 'workstation_17', 'server_03', 'customer_db'],
              status: 'BLOCKED',
              description: 'Endpoint network isolated.',
            },
          ],
        });
      } else if (nextIndex >= 8 && nextIndex < 11) {
        // Step 8 & 9: Attacker pivots! Graph Diff detected!
        // Add pivot nodes and edges marked with isDiff: true
        const existingNodeIds = new Set(state.nodes.map((n) => n.id));
        const newNodes = [
          ...state.nodes,
          ...SCENARIO_2_PIVOT_NODES.filter((n) => !existingNodeIds.has(n.id)),
        ];
        const existingEdgeIds = new Set(state.edges.map((e) => e.id));
        const newEdges = [
          ...state.edges,
          ...SCENARIO_2_PIVOT_EDGES.filter((e) => !existingEdgeIds.has(e.id)),
        ];
        set({
          nodes: newNodes,
          edges: newEdges,
          paths: PIVOT_PATHS_SCENARIO_2,
          diffBannerActive: true,
          replansCount: 1,
          status: 'PLANNING',
        });
      } else if (nextIndex >= 11) {
        // Step 11+: Revoke token, Path B blocked, Contained!
        const updatedEdges = state.edges.map((e) =>
          e.source === 'svc_token' || e.target === 'svc_token'
            ? { ...e, status: 'BLOCKED' as const, isDiff: false }
            : { ...e, isDiff: false }
        );
        const updatedNodes = state.nodes.map((n) =>
          n.id === 'svc_token' ? { ...n, status: 'ISOLATED' as const, isDiff: false } : { ...n, isDiff: false }
        );
        set({
          nodes: updatedNodes,
          edges: updatedEdges,
          paths: CONTAINED_PATHS_SCENARIO_2,
          diffBannerActive: false,
          status: nextIndex >= 12 ? 'CONTAINED' : 'EXECUTING',
        });
      }
    } else {
      // Other scenarios
      if (currentStep.phase === 'INCIDENT' && currentStep.status === 'CONTAINED') {
        set({ status: 'CONTAINED', isPlaying: false });
      } else if (currentStep.phase === 'PLAN' || currentStep.phase === 'REPLAN') {
        set({ status: 'PLANNING' });
      } else if (currentStep.phase === 'TOOL CALL') {
        set({ status: 'EXECUTING' });
      }
    }

    set({
      currentStepIndex: nextIndex,
      timeline: newTimeline,
    });
  },

  stepBackward: () => {
    const state = get();
    if (state.currentStepIndex <= 0) return;
    const prevIndex = state.currentStepIndex - 1;
    const dataset = SCENARIO_DATASETS[state.activeScenarioId];
    set({
      currentStepIndex: prevIndex,
      timeline: dataset.steps.slice(0, prevIndex + 1),
      isPlaying: false,
    });
  },

  approveAction: () => {
    const state = get();
    if (!state.currentActionProof) return;
    const updatedProof: ActionProofData = {
      ...state.currentActionProof,
      approval: {
        ...state.currentActionProof.approval,
        status: 'APPROVED',
      },
      result: 'EXECUTED',
    };
    set({
      currentActionProof: updatedProof,
      status: 'EXECUTING',
    });
    // Advance step
    setTimeout(() => {
      get().stepForward();
    }, 600);
  },

  denyAction: () => {
    const state = get();
    if (!state.currentActionProof) return;
    const updatedProof: ActionProofData = {
      ...state.currentActionProof,
      approval: {
        ...state.currentActionProof.approval,
        status: 'DENIED',
        decisionReason: 'Analyst denied high-risk action. Safe alternative proposed.',
      },
      result: 'PENDING',
    };
    set({
      currentActionProof: updatedProof,
      status: 'PLANNING',
    });
  },

  timeoutAction: () => {
    const state = get();
    if (!state.currentActionProof) return;
    const updatedProof: ActionProofData = {
      ...state.currentActionProof,
      approval: {
        ...state.currentActionProof.approval,
        status: 'TIMED_OUT',
        decisionReason: 'Approval window expired (300s). Execution suppressed.',
      },
    };
    set({
      currentActionProof: updatedProof,
    });
  },

  triggerKillSwitch: () => {
    set({
      isHalted: true,
      isPlaying: false,
      status: 'HALTED',
    });
  },

  resumeSystem: () => {
    set({
      isHalted: false,
      status: 'INVESTIGATING',
    });
  },

  handleSSEEvent: (payload: SSEEventPayload) => {
    // Reactive live backend updates
    switch (payload.event) {
      case 'incident.halted':
        set({ isHalted: true, isPlaying: false, status: 'HALTED' });
        break;
      case 'incident.contained':
        set({ status: 'CONTAINED', isPlaying: false });
        break;
      case 'incident.replanned':
        set((state) => ({ replansCount: state.replansCount + 1, status: 'PLANNING' }));
        break;
      case 'graph.diff':
        set({ diffBannerActive: true });
        break;
      case 'agent.step':
        if (payload.data) {
          set((state) => ({
            timeline: [...state.timeline, payload.data],
          }));
        }
        break;
      default:
        break;
    }
  },
}));
