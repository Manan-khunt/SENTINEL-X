import React from 'react';
import { 
  FileCheck, 
  Hash, 
  Terminal, 
  CornerDownRight,
  ShieldCheck
} from 'lucide-react';
import { useIncidentStore } from '../../stores/incidentStore';
import { StatusBadge } from '../common/StatusBadge';
import { RiskBadge } from '../common/RiskBadge';
import { RiskFactors } from './RiskFactors';
import { ApprovalPanel } from './ApprovalPanel';

export const ActionProof: React.FC = () => {
  const { currentActionProof, mode, incidentId } = useIncidentStore();

  if (!currentActionProof) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-[#8FA0BF] text-center font-mono text-xs">
        <Terminal className="w-8 h-8 text-[#22304D] mb-2" />
        <span>Awaiting agent tool selection...</span>
      </div>
    );
  }

  const {
    agent,
    currentThreat,
    target,
    action,
    reason,
    riskScore,
    riskFactors,
    dryRun,
    approval,
    reversible,
    undoId,
    result,
    logHash,
    previousLogHash,
  } = currentActionProof;

  return (
    <div className="flex flex-col h-full w-full bg-[#0B1220] overflow-hidden select-none">
      {/* Header Bar */}
      <div className="h-9 px-3 bg-[#111A2E] border-b border-[#22304D] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-xs font-mono">
          <FileCheck className="w-3.5 h-3.5 text-[#0E7C86]" />
          <span className="font-bold text-[#E6EDF7] tracking-wider">ACTION PROOF</span>
        </div>

        {/* Mode Tag */}
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          {mode === 'SHADOW' ? (
            <span className="px-2 py-0.5 rounded bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40 font-bold">
              SHADOW // RECOMMEND ONLY
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-[#0E7C86]/20 text-[#12929E] border border-[#0E7C86]/40 font-bold">
              ENFORCE // GATEWAY ACTIVE
            </span>
          )}
        </div>
      </div>

      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono text-xs">
        {/* Human Approval Required Banner if applicable */}
        <ApprovalPanel />

        {/* Metadata Card */}
        <div className="p-3 bg-[#111A2E] border border-[#22304D] rounded space-y-2">
          <div className="flex items-center justify-between text-[11px] pb-1.5 border-b border-[#22304D]">
            <span className="text-[#8FA0BF]">INCIDENT</span>
            <span className="font-bold text-[#E6EDF7]">{incidentId}</span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#8FA0BF]">AGENT</span>
            <span className="text-[#12929E] font-semibold">{agent}</span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#8FA0BF]">CURRENT THREAT</span>
            <StatusBadge status={currentThreat} size="sm" />
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#8FA0BF]">TARGET</span>
            <span className="font-bold text-[#E6EDF7] bg-[#16223B] px-1.5 py-0.5 rounded border border-[#22304D]">
              {target}
            </span>
          </div>

          <div className="pt-1.5 border-t border-[#22304D] space-y-1">
            <span className="text-[10px] text-[#8FA0BF] uppercase">ACTION SPECIFICATION</span>
            <div className="p-2 rounded bg-[#0B1220] border border-[#22304D] font-bold text-[#E6EDF7] text-xs flex items-center justify-between">
              <span>{action}</span>
              {mode === 'SHADOW' ? (
                <span className="text-[10px] text-[#F59E0B] font-medium">[PROPOSED]</span>
              ) : (
                <span className="text-[10px] text-[#22C55E] font-medium">[GATEWAY ENFORCE]</span>
              )}
            </div>
          </div>

          <div className="pt-1 space-y-1">
            <span className="text-[10px] text-[#8FA0BF] uppercase">REASON</span>
            <p className="text-[11px] font-sans text-[#E6EDF7] bg-[#0B1220] p-2 rounded border border-[#22304D] leading-relaxed">
              {reason}
            </p>
          </div>
        </div>

        {/* Risk Assessment Breakdown */}
        <div className="p-3 bg-[#111A2E] border border-[#22304D] rounded space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[#8FA0BF] text-[10px] uppercase font-bold">COMPOSITE RISK</span>
            <RiskBadge score={riskScore} />
          </div>

          <RiskFactors factors={riskFactors} />
        </div>

        {/* Dry Run Sandbox Results */}
        <div className="p-3 bg-[#111A2E] border border-[#22304D] rounded space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#8FA0BF] uppercase border-b border-[#22304D] pb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#22C55E]" />
            <span>DRY-RUN VERIFICATION PROOF</span>
          </div>

          <div className="space-y-1 text-[11px]">
            <div className="flex items-start gap-1.5">
              <CornerDownRight className="w-3.5 h-3.5 text-[#0E7C86] shrink-0 mt-0.5" />
              <span className="text-[#E6EDF7]">{dryRun.predictedPathRemoval}</span>
            </div>
            <div className="flex items-start gap-1.5">
              <CornerDownRight className="w-3.5 h-3.5 text-[#22C55E] shrink-0 mt-0.5" />
              <span className="text-[#22C55E]">{dryRun.protectedAssetImpact}</span>
            </div>
          </div>
        </div>

        {/* Policy & Reversibility */}
        <div className="p-3 bg-[#111A2E] border border-[#22304D] rounded space-y-2 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-[#8FA0BF]">APPROVAL REQUIREMENT</span>
            <span className="text-[#E6EDF7]">
              {approval.required ? 'REQUIRED (Risk >= 70)' : 'Policy Validated (Automated)'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#8FA0BF]">REVERSIBLE</span>
            <span className={reversible ? 'text-[#22C55E] font-bold' : 'text-[#EF4444] font-bold'}>
              {reversible ? 'YES' : 'NO (Irreversible)'}
            </span>
          </div>

          {reversible && (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#8FA0BF]">UNDO ID</span>
              <span className="text-[#8FA0BF] bg-[#0B1220] px-1.5 py-0.2 rounded border border-[#22304D]">
                {undoId}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-[#22304D]">
            <span className="text-[#8FA0BF]">EXECUTION VERDICT</span>
            <StatusBadge status={result} size="sm" />
          </div>
        </div>

        {/* Cryptographic Log Hashes */}
        <div className="p-3 bg-[#0B1220] border border-[#22304D] rounded space-y-1.5 text-[10px]">
          <div className="flex items-center gap-1.5 text-[#8FA0BF] font-bold">
            <Hash className="w-3 h-3 text-[#0E7C86]" />
            <span>CRYPTOGRAPHIC LEDGER PROOF</span>
          </div>

          <div className="space-y-1 text-[#8FA0BF]">
            <div className="flex items-center justify-between">
              <span>Log Hash:</span>
              <span className="text-[#E6EDF7] font-mono select-all">
                {logHash.substring(0, 16)}...
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Previous:</span>
              <span className="text-[#8FA0BF]/80 font-mono select-all">
                {previousLogHash.substring(0, 16)}...
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
