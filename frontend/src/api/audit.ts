import { apiClient } from './client';
import type { AuditEntry } from '../types';

export const INITIAL_AUDIT_LOGS: AuditEntry[] = [
  {
    id: 'aud_001',
    timestamp: '2026-10-08 12:44:02.105',
    incidentId: 'INC-1042',
    actor: 'TELEMETRY_INGEST',
    event: 'INGRESS_ALERT',
    action: 'ingest_alert',
    target: 'workstation_17',
    result: 'SUCCESS',
    previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
    hash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
  },
  {
    id: 'aud_002',
    timestamp: '2026-10-08 12:44:17.050',
    incidentId: 'INC-1042',
    actor: 'SENTINEL_PLANNER',
    event: 'DRY_RUN_EXECUTION',
    action: 'dry_run_isolation',
    target: 'workstation_17',
    result: 'SAFETY_PASS',
    previousHash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
    hash: 'b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef01',
  },
  {
    id: 'aud_003',
    timestamp: '2026-10-08 12:44:18.410',
    incidentId: 'INC-1042',
    actor: 'POLICY_GATEWAY',
    event: 'POLICY_EVALUATION',
    action: 'authorize_containment',
    target: 'workstation_17',
    result: 'APPROVED_AUTO',
    previousHash: 'b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef01',
    hash: 'c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef012',
  },
  {
    id: 'aud_004',
    timestamp: '2026-10-08 12:44:19.520',
    incidentId: 'INC-1042',
    actor: 'TOOL_GATEWAY',
    event: 'TOOL_INVOCATION',
    action: 'isolate_endpoint',
    target: 'workstation_17',
    result: 'EXECUTED',
    previousHash: 'c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef012',
    hash: 'd4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0123',
  },
  {
    id: 'aud_005',
    timestamp: '2026-10-08 12:44:20.730',
    incidentId: 'INC-1042',
    actor: 'GROUND_VERIFIER',
    event: 'GROUND_TRUTH_PROBE',
    action: 'verify_route_elimination',
    target: 'workstation_17',
    result: 'VERIFIED_ISOLATED',
    previousHash: 'd4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0123',
    hash: '91be4139d042bf901a642e7d825c34125b6a71e0c9041b38f870248c892b1a0',
  },
  {
    id: 'aud_006',
    timestamp: '2026-10-08 12:44:25.120',
    incidentId: 'INC-1042',
    actor: 'TOOL_GATEWAY',
    event: 'TOOL_INVOCATION',
    action: 'revoke_token',
    target: 'svc_token',
    result: 'EXECUTED',
    previousHash: '91be4139d042bf901a642e7d825c34125b6a71e0c9041b38f870248c892b1a0',
    hash: '3f9a882e70b9432f146a89c201e74a8105c3d2b1f09e8d7c6b5a493827101fa2',
  },
  {
    id: 'aud_007',
    timestamp: '2026-10-08 12:44:27.450',
    incidentId: 'INC-1042',
    actor: 'GROUND_VERIFIER',
    event: 'CONTAINMENT_CERTIFICATION',
    action: 'verify_complete_quarantine',
    target: 'customer_db',
    result: 'VERIFIED_CONTAINED',
    previousHash: '3f9a882e70b9432f146a89c201e74a8105c3d2b1f09e8d7c6b5a493827101fa2',
    hash: 'fa208c19b43e8701923485710293485710293485710293485710293485710293',
  },
];

export interface AuditVerificationResult {
  isIntact: boolean;
  brokenIndex: number | null;
  totalEntries: number;
  lastHash: string;
}

export const auditApi = {
  getAuditLogs: async (incidentId?: string): Promise<AuditEntry[]> => {
    try {
      const endpoint = incidentId ? `/audit?incidentId=${incidentId}` : '/audit';
      return await apiClient<AuditEntry[]>(endpoint);
    } catch {
      if (incidentId) {
        return INITIAL_AUDIT_LOGS.filter((e) => e.incidentId === incidentId);
      }
      return INITIAL_AUDIT_LOGS;
    }
  },

  verifyAuditChain: (entries: AuditEntry[]): AuditVerificationResult => {
    if (entries.length === 0) {
      return { isIntact: true, brokenIndex: null, totalEntries: 0, lastHash: '' };
    }

    for (let i = 1; i < entries.length; i++) {
      if (entries[i].previousHash !== entries[i - 1].hash) {
        return {
          isIntact: false,
          brokenIndex: i + 1,
          totalEntries: entries.length,
          lastHash: entries[entries.length - 1].hash,
        };
      }
    }

    return {
      isIntact: true,
      brokenIndex: null,
      totalEntries: entries.length,
      lastHash: entries[entries.length - 1].hash,
    };
  },
};
