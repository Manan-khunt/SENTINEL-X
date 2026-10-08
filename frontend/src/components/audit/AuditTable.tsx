import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi, type AuditVerificationResult } from '../../api/audit';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingState, ErrorState } from '../common/FeedbackStates';
import { ShieldCheck, ShieldAlert } from 'lucide-react';

interface AuditTableProps {
  incidentId?: string;
}

export const AuditTable: React.FC<AuditTableProps> = ({ incidentId }) => {
  const { data: entries, isLoading, error } = useQuery({
    queryKey: ['audit', incidentId || 'all'],
    queryFn: () => auditApi.getAuditLogs(incidentId),
  });

  if (isLoading) return <LoadingState message="Verifying cryptographic audit chain..." />;
  if (error || !entries) return <ErrorState message="Failed to load tamper-evident audit logs." />;

  const verification: AuditVerificationResult = auditApi.verifyAuditChain(entries);

  return (
    <div className="space-y-4 font-mono select-none">
      {/* Integrity Banner */}
      <div
        className={`p-3.5 rounded border flex items-center justify-between text-xs ${
          verification.isIntact
            ? 'bg-[#22C55E]/10 border-[#22C55E]/40 text-[#22C55E]'
            : 'bg-[#EF4444]/15 border-[#EF4444] text-[#EF4444]'
        }`}
      >
        <div className="flex items-center gap-2 font-bold tracking-wider">
          {verification.isIntact ? (
            <>
              <ShieldCheck className="w-4 h-4 text-[#22C55E]" />
              <span>AUDIT CHAIN INTACT // CRYPTOGRAPHIC INTEGRITY VERIFIED</span>
            </>
          ) : (
            <>
              <ShieldAlert className="w-4 h-4 text-[#EF4444]" />
              <span>
                AUDIT CHAIN BROKEN AT ENTRY {verification.brokenIndex} // INTEGRITY VIOLATION DETECTED
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[#8FA0BF]">
          <span>Validated Entries: <strong className="text-[#E6EDF7]">{verification.totalEntries}</strong></span>
          <span className="text-[#22304D]">|</span>
          <span className="truncate max-w-[200px]" title={verification.lastHash}>
            Head: <strong className="text-[#E6EDF7] font-mono">{verification.lastHash.substring(0, 12)}...</strong>
          </span>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="rounded border border-[#22304D] bg-[#111A2E] overflow-hidden shadow-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#16223B] border-b border-[#22304D] text-[#8FA0BF] text-[10px] uppercase tracking-wider">
            <tr>
              <th className="px-3.5 py-3">Timestamp</th>
              <th className="px-3.5 py-3">Incident</th>
              <th className="px-3.5 py-3">Actor</th>
              <th className="px-3.5 py-3">Event</th>
              <th className="px-3.5 py-3">Action</th>
              <th className="px-3.5 py-3">Target</th>
              <th className="px-3.5 py-3">Result</th>
              <th className="px-3.5 py-3">Log Hash (SHA-256)</th>
              <th className="px-3.5 py-3">Previous Hash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#22304D]">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-[#16223B]/50 transition-colors">
                <td className="px-3.5 py-2.5 text-[#8FA0BF] text-[11px] whitespace-nowrap">
                  {entry.timestamp}
                </td>
                <td className="px-3.5 py-2.5 font-bold text-[#E6EDF7]">
                  {entry.incidentId}
                </td>
                <td className="px-3.5 py-2.5 text-[#12929E] font-medium text-[11px]">
                  {entry.actor}
                </td>
                <td className="px-3.5 py-2.5 text-[#E6EDF7] font-semibold text-[11px]">
                  {entry.event}
                </td>
                <td className="px-3.5 py-2.5 text-[#8FA0BF] font-mono text-[11px]">
                  {entry.action}
                </td>
                <td className="px-3.5 py-2.5 text-[#E6EDF7] font-mono text-[11px]">
                  {entry.target}
                </td>
                <td className="px-3.5 py-2.5">
                  <StatusBadge status={entry.result} size="sm" />
                </td>
                <td className="px-3.5 py-2.5 font-mono text-[10px] text-[#A78BFA] select-all truncate max-w-[140px]" title={entry.hash}>
                  {entry.hash.substring(0, 16)}...
                </td>
                <td className="px-3.5 py-2.5 font-mono text-[10px] text-[#8FA0BF]/70 select-all truncate max-w-[140px]" title={entry.previousHash}>
                  {entry.previousHash.substring(0, 16)}...
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
