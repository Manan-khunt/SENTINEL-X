import React, { useState } from 'react';
import { AlertTriangle, Power, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useIncidentStore } from '../../stores/incidentStore';
import { systemApi } from '../../api/system';

interface KillSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KillSwitchModal: React.FC<KillSwitchModalProps> = ({ isOpen, onClose }) => {
  const { isHalted, triggerKillSwitch, resumeSystem } = useIncidentStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirmHalt = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await systemApi.triggerKillSwitch();
      triggerKillSwitch();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to dispatch halt signal to Tool Gateway.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResume = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await systemApi.resumeSystem();
      resumeSystem();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to resume system at Tool Gateway.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#111A2E] border-2 border-[#EF4444] rounded shadow-2xl p-6 text-[#E6EDF7]">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-[#22304D]">
          <div className="p-2 rounded bg-[#EF4444]/20 text-[#EF4444]">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-mono tracking-wide text-[#EF4444]">
              {isHalted ? 'SYSTEM HALTED // RESUME CONTROL' : 'EMERGENCY AGENT KILL SWITCH'}
            </h2>
            <p className="text-xs text-[#8FA0BF]">Hardware-Level Tool Gateway Interlock</p>
          </div>
        </div>

        {/* Body */}
        <div className="py-4 space-y-3 text-sm">
          {isHalted ? (
            <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/40 rounded text-xs space-y-1">
              <p className="font-bold text-[#EF4444] font-mono">STATUS: SYSTEM HALTED</p>
              <p className="text-[#E6EDF7]">
                All autonomous agent planning, tool gateway dispatches, and environment state changes are currently frozen.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[#E6EDF7] leading-relaxed">
                Activating the Kill Switch sends an immediate high-priority halt command to the backend Tool Gateway:
              </p>
              <ul className="space-y-1.5 text-xs text-[#8FA0BF] list-disc list-inside bg-[#0B1220] p-3 rounded border border-[#22304D]">
                <li>Terminates all in-flight tool executions immediately.</li>
                <li>Freezes the Autonomous Planner and Verifier loops.</li>
                <li>Locks current network topologies and firewalls in their current state.</li>
                <li>Appends an emergency halt cryptographic proof entry into the audit log.</li>
              </ul>
              <div className="flex items-center gap-2 p-2.5 rounded bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-xs text-[#F59E0B]">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Requires manual SOC re-authorization to restore autonomous enforcement.</span>
              </div>
            </>
          )}

          {error && (
            <div className="p-2 bg-[#EF4444]/20 border border-[#EF4444] text-[#EF4444] text-xs rounded font-mono">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#22304D]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono font-medium rounded border border-[#22304D] bg-[#16223B] text-[#8FA0BF] hover:text-[#E6EDF7] hover:border-[#0E7C86] transition-colors"
          >
            DISMISS
          </button>
          
          {isHalted ? (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleResume}
              className="flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold rounded bg-[#22C55E] hover:bg-[#16a34a] text-black transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting ? 'RESUMING...' : 'RESUME AGENT EXECUTION'}
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirmHalt}
              className="flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold rounded bg-[#EF4444] hover:bg-red-600 text-white transition-colors tracking-wider"
            >
              <Power className="w-4 h-4" />
              {isSubmitting ? 'HALTING...' : 'CONFIRM EMERGENCY HALT'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
