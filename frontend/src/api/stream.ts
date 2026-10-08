import { apiClient } from './client';
import type { SSEEventPayload } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export interface StreamTicket {
  ticket: string;
  expiresInSeconds: number;
}

export const streamApi = {
  requestStreamTicket: async (incidentId: string): Promise<StreamTicket> => {
    try {
      return await apiClient<StreamTicket>(`/stream/ticket`, {
        method: 'POST',
        body: JSON.stringify({ incidentId }),
      });
    } catch {
      return {
        ticket: 'demo_ticket_' + Math.random().toString(36).substring(2),
        expiresInSeconds: 3600,
      };
    }
  },

  createIncidentStream: (
    incidentId: string,
    ticket: string,
    onMessage: (event: SSEEventPayload) => void,
    onError?: (err: Event) => void
  ): { close: () => void } => {
    const url = `${API_BASE_URL.replace(/\/$/, '')}/incidents/${incidentId}/stream?ticket=${ticket}`;
    
    // Check if EventSource is supported
    if (typeof EventSource === 'undefined') {
      console.warn('Native EventSource is not supported in this runtime environment.');
      return { close: () => {} };
    }

    try {
      const eventSource = new EventSource(url);

      const registeredEvents = [
        'incident.started',
        'agent.step',
        'graph.updated',
        'graph.diff',
        'action.proposed',
        'action.approved',
        'action.denied',
        'action.executed',
        'verification.completed',
        'adversary.action',
        'incident.replanned',
        'incident.contained',
        'incident.failed',
        'incident.halted',
      ];

      registeredEvents.forEach((eventName) => {
        eventSource.addEventListener(eventName, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            onMessage({
              event: eventName as SSEEventPayload['event'],
              data,
              timestamp: new Date().toISOString(),
            });
          } catch (err) {
            console.error('Failed to parse SSE payload', err);
          }
        });
      });

      eventSource.onerror = (err) => {
        if (onError) onError(err);
        eventSource.close();
      };

      return {
        close: () => eventSource.close(),
      };
    } catch (e) {
      console.warn('SSE connection failed (synthetic demo fallback active):', e);
      return { close: () => {} };
    }
  },
};
