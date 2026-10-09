// Shared SOC-console primitives: panels, badges, loading/error/empty states.
import React from 'react';
import type { IncidentStatus, RiskTier } from '../types';

export function Panel({
  title,
  right,
  children,
  className = '',
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`soc-panel flex flex-col min-h-0 rounded ${className}`}>
      <header className="flex items-center justify-between px-3 py-2 border-b border-[#22304D] shrink-0">
        <h2 className="text-[11px] font-semibold tracking-[0.14em] text-[#8FA0BF]">{title}</h2>
        {right}
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    </section>
  );
}

const STATUS_COLOR: Record<string, string> = {
  RUNNING: 'text-[#3B82F6]',
  AWAITING_APPROVAL: 'text-[#F59E0B]',
  CONTAINED: 'text-[#22C55E]',
  ESCALATED: 'text-[#F59E0B]',
  FAILED: 'text-[#EF4444]',
  HALTED: 'text-[#EF4444]',
};

export function StatusBadge({ status }: { status: IncidentStatus | string }) {
  const color = STATUS_COLOR[status] || 'text-[#8FA0BF]';
  const pulse = status === 'RUNNING' || status === 'AWAITING_APPROVAL';
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold tracking-wider ${color}`}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full bg-current ${pulse ? 'animate-pulse-subtle' : ''}`}
      />
      {status}
    </span>
  );
}

const RISK_BG: Record<RiskTier, string> = {
  LOW: 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/40',
  MEDIUM: 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/40',
  HIGH: 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/40',
};

export function RiskBadge({ tier, score }: { tier: RiskTier | string; score?: number }) {
  const cls = RISK_BG[tier as RiskTier] || RISK_BG.LOW;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded border font-mono text-[11px] font-semibold ${cls}`}
    >
      {tier}
      {score !== undefined ? ` ${typeof score === 'number' ? score.toFixed(score % 1 ? 2 : 0) : score}` : ''}
    </span>
  );
}

export function Loading({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center h-full p-6 text-[#8FA0BF] font-mono text-xs">
      <span className="animate-pulse-subtle">{message}</span>
    </div>
  );
}

export function ErrorBox({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="font-mono text-[11px] font-semibold text-[#EF4444] tracking-wider mb-1">
        REQUEST FAILED
      </div>
      <div className="text-xs text-[#8FA0BF] mb-3 max-w-md">{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-3 py-1.5 rounded bg-[#16223B] border border-[#22304D] text-[#E6EDF7] font-mono text-[11px] hover:bg-[#1f3054]"
        >
          RETRY
        </button>
      )}
    </div>
  );
}

export function Empty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="font-mono text-[11px] font-semibold text-[#E6EDF7] tracking-wider mb-1">
        NO RECORDS
      </div>
      <div className="text-xs text-[#8FA0BF]">{message}</div>
    </div>
  );
}

export function KV({ k, v, mono = true }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 border-b border-[#22304D]/50 last:border-0">
      <span className="text-[10px] tracking-[0.12em] text-[#8FA0BF] font-semibold shrink-0 pt-0.5">
        {k}
      </span>
      <span
        className={`text-xs text-right text-[#E6EDF7] break-all ${mono ? 'font-mono' : ''}`}
      >
        {v}
      </span>
    </div>
  );
}

export function errMsg(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Unexpected error';
}
