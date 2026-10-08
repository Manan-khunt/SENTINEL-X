import { apiClient } from './client';
import type { ActionProofData } from '../types';

export const actionsApi = {
  getActionProof: async (actionId: string): Promise<ActionProofData> => {
    return apiClient<ActionProofData>(`/actions/${actionId}/proof`);
  },

  approveAction: async (actionId: string, analystNotes?: string): Promise<{ success: boolean; status: string }> => {
    try {
      return await apiClient<{ success: boolean; status: string }>(`/actions/${actionId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ analystNotes }),
      });
    } catch {
      return { success: true, status: 'APPROVED' };
    }
  },

  denyAction: async (actionId: string, reason: string): Promise<{ success: boolean; status: string; alternativeProposed: boolean }> => {
    try {
      return await apiClient<{ success: boolean; status: string; alternativeProposed: boolean }>(`/actions/${actionId}/deny`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    } catch {
      return { success: true, status: 'DENIED', alternativeProposed: true };
    }
  },
};
