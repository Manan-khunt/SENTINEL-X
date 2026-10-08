import React from 'react';
import type { AgentStep } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { RiskBadge } from '../common/RiskBadge';
import { 
  Eye, 
  GitBranch, 
  PlayCircle, 
  ShieldAlert, 
  ShieldCheck, 
  Terminal, 
  CheckCircle2, 
  Activity, 
  RotateCcw, 
  AlertTriangle 
} from 'lucide-react';

interface TimelineEventProps {
  step: AgentStep;
  isLatest: boolean;
}

export const TimelineEvent: React.FC<TimelineEventProps> = ({ step, isLatest }) => {
  const getPhaseIcon = () => {
    switch (step.phase) {
      case 'OBSERVE':
        return <Eye className="w-3.5 h-3.5 text-[#3B82F6]" />;
      case 'PLAN':
        return <GitBranch className="w-3.5 h-3.5 text-[#0E7C86]" />;
      case 'DRY-RUN':
        return <PlayCircle className="w-3.5 h-3.5 text-[#8FA0BF]" />;
      case 'RISK':
        return <ShieldAlert className="w-3.5 h-3.5 text-[#F59E0B]" />;
      case 'POLICY':
        return <ShieldCheck className="w-3.5 h-3.5 text-[#22C55E]" />;
      case 'TOOL CALL':
        return <Terminal className="w-3.5 h-3.5 text-[#E6EDF7]" />;
      case 'VERIFY':
        return <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />;
      case 'ADVERSARY':
        return <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444]" />;
      case 'GRAPH DIFF':
        return <Activity className="w-3.5 h-3.5 text-[#A78BFA]" />;
      case 'REPLAN':
        return <RotateCcw className="w-3.5 h-3.5 text-[#A78BFA]" />;
      default:
        return <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />;
    }
  };

  const isDiffOrReplan = step.phase === 'GRAPH DIFF' || step.phase === 'REPLAN' || step.phase === 'ADVERSARY';

  return (
    <div
      className={`relative pl-6 pb-4 border-l ${
        isDiffOrReplan
          ? 'border-[#A78BFA]/50'
          : isLatest
          ? 'border-[#0E7C86]'
          : 'border-[#22304D]'
      } transition-colors group select-none`}
    >
      {/* Node pin on timeline track */}
      <div
        className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
          isDiffOrReplan
            ? 'bg-[#16223B] border-[#A78BFA] text-[#A78BFA]'
            : isLatest
            ? 'bg-[#0E3B45] border-[#0E7C86] text-[#12929E]'
            : 'bg-[#111A2E] border-[#22304D] text-[#8FA0BF]'
        }`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
      </div>

      {/* Card container */}
      <div
        className={`p-2.5 rounded border text-xs font-mono transition-all ${
          isDiffOrReplan
            ? 'bg-[#16223B]/80 border-[#A78BFA]/40 shadow-xs shadow-purple-900/20'
            : isLatest
            ? 'bg-[#111A2E] border-[#0E7C86]/60 shadow-xs'
            : 'bg-[#111A2E]/60 border-[#22304D] hover:border-[#22304D]/80'
        }`}
      >
        {/* Header row: Step #, Timestamp, Phase, Status */}
        <div className="flex items-center justify-between pb-1.5 border-b border-[#22304D]/60 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#8FA0BF] text-[10px]">
              #{step.stepNumber}
            </span>
            <span className="text-[#8FA0BF]/80 text-[10px]">
              {step.timestamp}
            </span>
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#0B1220] border border-[#22304D] text-[10px] font-semibold text-[#E6EDF7]">
              {getPhaseIcon()}
              <span>{step.phase}</span>
            </div>
          </div>

          <StatusBadge status={step.status} size="sm" />
        </div>

        {/* Event Title */}
        <div className="pt-2 pb-1 font-semibold text-[#E6EDF7] text-[11px] leading-tight">
          {step.eventType}
        </div>

        {/* Summary text */}
        <p className="text-[#8FA0BF] text-[11px] leading-normal font-sans">
          {step.summary}
        </p>

        {/* Structured Reasoning Summary (Strictly NO hidden CoT) */}
        {step.structuredReasoning && (
          <div className="mt-2 p-2 rounded bg-[#0B1220] border-l-2 border-[#0E7C86] border border-[#22304D] space-y-1">
            <div className="text-[10px] uppercase font-mono font-bold text-[#0E7C86] tracking-wider">
              STRUCTURED REASONING
            </div>
            <p className="text-[11px] text-[#E6EDF7] font-sans leading-relaxed italic">
              "{step.structuredReasoning}"
            </p>
          </div>
        )}

        {/* Technical metadata chips (Tool call, risk score, target) */}
        <div className="flex flex-wrap items-center gap-2 pt-2 text-[10px]">
          {step.toolCall && (
            <div className="flex items-center gap-1 bg-[#16223B] px-2 py-0.5 rounded border border-[#22304D] text-[#E6EDF7]">
              <Terminal className="w-3 h-3 text-[#0E7C86]" />
              <span>TOOL: <strong className="text-[#12929E]">{step.toolCall}</strong></span>
            </div>
          )}

          {step.target && (
            <div className="bg-[#16223B] px-2 py-0.5 rounded border border-[#22304D] text-[#8FA0BF]">
              TARGET: <strong className="text-[#E6EDF7]">{step.target}</strong>
            </div>
          )}

          {step.riskScore !== undefined && (
            <div className="flex items-center gap-1">
              <span className="text-[#8FA0BF]">RISK:</span>
              <RiskBadge score={step.riskScore} />
            </div>
          )}

          {step.details && (
            <div className="text-[10px] text-[#8FA0BF]/80 truncate max-w-full">
              {step.details}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
