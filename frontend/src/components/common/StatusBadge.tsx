import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  pulse?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm', pulse = false }) => {
  const norm = status.toUpperCase();

  let colorClasses = 'bg-[#16223B] text-[#8FA0BF] border-[#22304D]';
  let dotColor = 'bg-[#8FA0BF]';

  if (norm.includes('CONTAINED') || norm === 'SAFE' || norm === 'SUCCESS' || norm === 'VERIFIED') {
    colorClasses = 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30';
    dotColor = 'bg-[#22C55E]';
  } else if (norm.includes('ACTIVE') || norm.includes('COMPROMISED') || norm === 'DANGER' || norm === 'CRITICAL' || norm === 'FAILED') {
    colorClasses = 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30';
    dotColor = 'bg-[#EF4444]';
  } else if (norm.includes('PLANNING') || norm.includes('INVESTIGATING') || norm.includes('WAITING') || norm === 'WARNING' || norm === 'TARGETED') {
    colorClasses = 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30';
    dotColor = 'bg-[#F59E0B]';
  } else if (norm.includes('BLOCKED') || norm.includes('ISOLATED')) {
    colorClasses = 'bg-[#8FA0BF]/10 text-[#8FA0BF] border-[#8FA0BF]/30';
    dotColor = 'bg-[#8FA0BF]';
  } else if (norm.includes('DIFF') || norm.includes('PIVOT') || norm.includes('REPLAN')) {
    colorClasses = 'bg-[#A78BFA]/15 text-[#A78BFA] border-[#A78BFA]/40';
    dotColor = 'bg-[#A78BFA]';
  } else if (norm.includes('EXECUTING') || norm === 'RUNNING' || norm === 'ONLINE') {
    colorClasses = 'bg-[#0E7C86]/20 text-[#12929E] border-[#0E7C86]/40';
    dotColor = 'bg-[#0E7C86]';
  } else if (norm.includes('HALTED')) {
    colorClasses = 'bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]';
    dotColor = 'bg-[#EF4444]';
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-medium rounded border tracking-wider uppercase ${sizeClasses} ${colorClasses}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${dotColor} ${pulse ? 'animate-ping' : ''}`}
      />
      {status}
    </span>
  );
};
