import React, { useState } from 'react';
import { ShieldAlert, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { useIncidentStore } from '../../stores/incidentStore';
import { RiskBadge } from '../common/RiskBadge';
import { actionsApi } from '../../api/actions';

export const ApprovalPanel: React.FC = () => {
  const { currentActionProof, approveAction, denyAction, timeoutAction } = useIncidentStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!currentActionProof || !currentActionProof.approval.required) {
    return null;
  }

  const { approval, riskScore, action, target, reason, dryRun } = currentActionProof;
  const status = approval.status;

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await actionsApi.approveAction(currentActionProof.id, 'Approved by SOC Lead Analyst');
      approveAction();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeny = async () => {
    setIsSubmitting(true);
    try {
      await actionsApi.denyAction(currentActionProof.id, 'Denied due to blast radius');
      denyAction();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-3 bg-[#16223B] border-2 border-[#EF4444] rounded text-xs font-mono space-y-3 mb-3 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#22304D]">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#EF4444] animate-pulse" />
          <span className="font-bold text-[#EF4444] tracking-wider uppercase">
            HIGH-RISK ACTION // APPROVAL REQUIRED
          </span>
        </div>
        <RiskBadge score={riskScore} />
      </div>

      {/* Target & Action Details */}
      <div className="space-y-1.5 bg-[#0B1220] p-2 rounded border border-[#22304D]">
        <div className="flex items-center justify-between">
          <span className="text-[#8FA0BF]">ACTION:</span>
          <span className="font-bold text-[#E6EDF7]">{action}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#8FA0BF]">TARGET:</span>
          <span className="font-bold text-[#12929E]">{target}</span>
        </div>
        <div>
          <span className="text-[#8FA0BF]">REASON:</span>
          <p className="text-[#E6EDF7] font-sans text-[11px] mt-0.5">{reason}</p>
        </div>
      </div>

      {/* Dry Run & Protected Asset Impact */}
      <div className="space-y-1 text-[11px] text-[#8FA0BF] border-t border-[#22304D] pt-2">
        <div>
          <strong className="text-[#E6EDF7]">Predicted Impact:</strong> {dryRun.predictedPathRemoval}
        </div>
        <div>
          <strong className="text-[#E6EDF7]">Protected Assets:</strong> {dryRun.protectedAssetImpact}
        </div>
      </div>

      {/* Decision Status or Action Buttons */}
      {status === 'WAITING' ? (
        <div className="space-y-2 pt-2 border-t border-[#22304D]">
          <div className="flex items-center justify-between text-[10px] text-[#F59E0B]">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 animate-spin" />
              <span>Awaiting Human Sign-off (Risk &gt;= 70)</span>
            </span>
            <button
              onClick={timeoutAction}
              className="text-[9px] text-[#8FA0BF] hover:underline"
            >
              [Simulate Timeout]
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleApprove}
              disabled={isSubmitting}
              className="flex-1 py-1.5 px-3 rounded bg-[#22C55E] hover:bg-[#16a34a] text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>APPROVE</span>
            </button>
            <button
              onClick={handleDeny}
              disabled={isSubmitting}
              className="flex-1 py-1.5 px-3 rounded bg-[#EF4444] hover:bg-red-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>DENY</span>
            </button>
          </div>
        </div>
      ) : status === 'APPROVED' ? (
        <div className="p-2 bg-[#22C55E]/15 border border-[#22304D] rounded text-center text-[#22C55E] font-bold">
          ✓ APPROVED BY ANALYST — DISPATCHED TO GATEWAY
        </div>
      ) : status === 'DENIED' ? (
        <div className="p-2 bg-[#EF4444]/15 border border-[#EF4444]/30 rounded space-y-1">
          <div className="text-[#EF4444] font-bold text-center">
            ✗ ACTION DENIED BY ANALYST
          </div>
          <div className="p-1.5 bg-[#0B1220] rounded text-[10px] text-[#22C55E] border border-[#22304D] flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-[#F59E0B] shrink-0" />
            <span>SAFE ALTERNATIVE PROPOSED: Partial ACL isolation with zero service restart.</span>
          </div>
        </div>
      ) : (
        <div className="p-2 bg-[#F59E0B]/15 border border-[#F59E0B]/30 rounded space-y-1">
          <div className="text-[#F59E0B] font-bold text-center">
            ⏱ APPROVAL TIMED OUT (300s EXPIRED)
          </div>
          <div className="p-1.5 bg-[#0B1220] rounded text-[10px] text-[#22C55E] border border-[#22304D]">
            <span>SAFE ALTERNATIVE PROPOSED: Rate limiting applied autonomously.</span>
          </div>
        </div>
      )}
    </div>
  );
};
