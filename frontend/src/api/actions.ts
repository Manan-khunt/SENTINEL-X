import { apiClient, IS_DEMO_MODE } from './client';
import type { ActionProofData } from '../types';

export const actionsApi = {
  getActionProof: async (actionId: string): Promise<ActionProofData> => {
    try {
      return await apiClient<ActionProofData>(`/actions/${actionId}/proof`);
    } catch (err: any) {
      if (IS_DEMO_MODE) {
        return {
          action: 'isolate_endpoint',
          target: 'workstation_17',
          riskScore: 22,
          approval: { status: 'APPROVED_AUTO', required: false, timeoutSeconds: 300 },
          dryRun: { predictedPathRemoval: 'Path A blocked', sideEffects: 'None' },
          result: 'EXECUTED',
        } as unknown as ActionProofData;
      }
      throw err;
    }
  },

  approveAction: async (actionId: string, analystNotes?: string): Promise<{ success: boolean; status: string }> => {
    try {
      return await apiClient<{ success: boolean; status: string }>(`/actions/${actionId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ analystNotes }),
      });
    } catch (err: any) {
      if (IS_DEMO_MODE) {
        return { success: true, status: 'APPROVED' };
      }
      throw err;
    }
  },

  denyAction: async (actionId: string, reason: string): Promise<{ success: boolean; status: string; alternativeProposed: boolean }> => {
    try {
      return await apiClient<{ success: boolean; status: string; alternativeProposed: boolean }>(`/actions/${actionId}/deny`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    } catch (err: any) {
      if (IS_DEMO_MODE) {
        return { success: true, status: 'DENIED', alternativeProposed: true };
      }
      throw err;
    }
  },
};
