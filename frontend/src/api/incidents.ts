import { apiClient, IS_DEMO_MODE } from './client';
import type { Incident, GraphNode, GraphEdge, AttackPath, AgentStep } from '../types';
import { SCENARIO_DATASETS } from '../demo/allScenariosData';

export const DEMO_INCIDENT_LIST: Incident[] = [
  {
    id: 'INC-1042',
    scenarioId: 'scenario-2',
    scenarioName: 'Adaptive Attacker (Primary Demo)',
    status: 'INVESTIGATING',
    mode: 'ENFORCE',
    seed: 'seed_94821a',
    replans: 1,
    currentStep: 7,
    totalSteps: 13,
    createdAt: '2026-10-08 12:44:00 UTC',
    updatedAt: '2026-10-08 12:44:22 UTC',
    threatLevel: 'CRITICAL',
    activePaths: SCENARIO_DATASETS['scenario-2'].initialPaths,
    nodes: SCENARIO_DATASETS['scenario-2'].initialNodes,
    edges: SCENARIO_DATASETS['scenario-2'].initialEdges,
    currentAction: SCENARIO_DATASETS['scenario-2'].actionProof,
  },
  {
    id: 'INC-1001',
    scenarioId: 'scenario-1',
    scenarioName: 'Standard Attack Path',
    status: 'CONTAINED',
    mode: 'ENFORCE',
    seed: 'seed_100100',
    replans: 0,
    currentStep: 8,
    totalSteps: 8,
    createdAt: '2026-10-08 10:15:00 UTC',
    updatedAt: '2026-10-08 10:15:08 UTC',
    threatLevel: 'HIGH',
    activePaths: SCENARIO_DATASETS['scenario-1'].initialPaths,
    nodes: SCENARIO_DATASETS['scenario-1'].initialNodes,
    edges: SCENARIO_DATASETS['scenario-1'].initialEdges,
    currentAction: SCENARIO_DATASETS['scenario-1'].actionProof,
  },
  {
    id: 'INC-1003',
    scenarioId: 'scenario-3',
    scenarioName: 'Lateral Movement Spread',
    status: 'CONTAINED',
    mode: 'ENFORCE',
    seed: 'seed_300300',
    replans: 0,
    currentStep: 7,
    totalSteps: 7,
    createdAt: '2026-10-08 14:20:00 UTC',
    updatedAt: '2026-10-08 14:20:05 UTC',
    threatLevel: 'CRITICAL',
    activePaths: SCENARIO_DATASETS['scenario-3'].initialPaths,
    nodes: SCENARIO_DATASETS['scenario-3'].initialNodes,
    edges: SCENARIO_DATASETS['scenario-3'].initialEdges,
    currentAction: SCENARIO_DATASETS['scenario-3'].actionProof,
  },
  {
    id: 'INC-1004',
    scenarioId: 'scenario-4',
    scenarioName: 'High-Risk Action & Human Approval',
    status: 'PLANNING',
    mode: 'ENFORCE',
    seed: 'seed_400400',
    replans: 0,
    currentStep: 6,
    totalSteps: 7,
    createdAt: '2026-10-08 16:05:00 UTC',
    updatedAt: '2026-10-08 16:05:13 UTC',
    threatLevel: 'CRITICAL',
    activePaths: SCENARIO_DATASETS['scenario-4'].initialPaths,
    nodes: SCENARIO_DATASETS['scenario-4'].initialNodes,
    edges: SCENARIO_DATASETS['scenario-4'].initialEdges,
    currentAction: SCENARIO_DATASETS['scenario-4'].actionProof,
  },
  {
    id: 'INC-1005',
    scenarioId: 'scenario-5',
    scenarioName: 'Verification Failure & Replan',
    status: 'CONTAINED',
    mode: 'ENFORCE',
    seed: 'seed_500500',
    replans: 1,
    currentStep: 9,
    totalSteps: 9,
    createdAt: '2026-10-08 17:10:00 UTC',
    updatedAt: '2026-10-08 17:10:09 UTC',
    threatLevel: 'CRITICAL',
    activePaths: SCENARIO_DATASETS['scenario-5'].initialPaths,
    nodes: SCENARIO_DATASETS['scenario-5'].initialNodes,
    edges: SCENARIO_DATASETS['scenario-5'].initialEdges,
    currentAction: SCENARIO_DATASETS['scenario-5'].actionProof,
  },
  {
    id: 'INC-1006',
    scenarioId: 'scenario-6',
    scenarioName: 'Prompt Injection in Telemetry',
    status: 'CONTAINED',
    mode: 'SHADOW',
    seed: 'seed_600600',
    replans: 0,
    currentStep: 5,
    totalSteps: 5,
    createdAt: '2026-10-08 18:30:00 UTC',
    updatedAt: '2026-10-08 18:30:03 UTC',
    threatLevel: 'MEDIUM',
    activePaths: SCENARIO_DATASETS['scenario-6'].initialPaths,
    nodes: SCENARIO_DATASETS['scenario-6'].initialNodes,
    edges: SCENARIO_DATASETS['scenario-6'].initialEdges,
    currentAction: SCENARIO_DATASETS['scenario-6'].actionProof,
  },
  {
    id: 'INC-1007',
    scenarioId: 'scenario-7',
    scenarioName: 'Benign Admin Activity False-Positive',
    status: 'CONTAINED',
    mode: 'ENFORCE',
    seed: 'seed_700700',
    replans: 0,
    currentStep: 5,
    totalSteps: 5,
    createdAt: '2026-10-08 22:00:00 UTC',
    updatedAt: '2026-10-08 22:00:05 UTC',
    threatLevel: 'LOW',
    activePaths: SCENARIO_DATASETS['scenario-7'].initialPaths,
    nodes: SCENARIO_DATASETS['scenario-7'].initialNodes,
    edges: SCENARIO_DATASETS['scenario-7'].initialEdges,
    currentAction: SCENARIO_DATASETS['scenario-7'].actionProof,
  },
];

export const incidentsApi = {
  getIncidents: async (): Promise<Incident[]> => {
    try {
      return await apiClient<Incident[]>('/incidents');
    } catch (err: any) {
      if (IS_DEMO_MODE) {
        return DEMO_INCIDENT_LIST;
      }
      throw err;
    }
  },

  getIncidentById: async (id: string): Promise<Incident> => {
    try {
      return await apiClient<Incident>(`/incidents/${id}`);
    } catch (err: any) {
      if (IS_DEMO_MODE) {
        const match = DEMO_INCIDENT_LIST.find((i) => i.id === id);
        if (match) return match;
        return DEMO_INCIDENT_LIST[0];
      }
      throw err;
    }
  },

  getIncidentGraph: async (id: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> => {
    try {
      return await apiClient<{ nodes: GraphNode[]; edges: GraphEdge[] }>(`/incidents/${id}/graph`);
    } catch (err: any) {
      if (IS_DEMO_MODE) {
        const inc = DEMO_INCIDENT_LIST.find((i) => i.id === id) || DEMO_INCIDENT_LIST[0];
        return { nodes: inc.nodes, edges: inc.edges };
      }
      throw err;
    }
  },

  getIncidentTimeline: async (id: string): Promise<AgentStep[]> => {
    try {
      return await apiClient<AgentStep[]>(`/incidents/${id}/timeline`);
    } catch (err: any) {
      if (IS_DEMO_MODE) {
        const inc = DEMO_INCIDENT_LIST.find((i) => i.id === id) || DEMO_INCIDENT_LIST[0];
        const dataset = SCENARIO_DATASETS[inc.scenarioId];
        return dataset.steps;
      }
      throw err;
    }
  },

  getIncidentPaths: async (id: string): Promise<AttackPath[]> => {
    try {
      return await apiClient<AttackPath[]>(`/incidents/${id}/paths`);
    } catch (err: any) {
      if (IS_DEMO_MODE) {
        const inc = DEMO_INCIDENT_LIST.find((i) => i.id === id) || DEMO_INCIDENT_LIST[0];
        return inc.activePaths;
      }
      throw err;
    }
  },
};
