import React from 'react';

interface RiskBadgeProps {
  score: number;
  showCategory?: boolean;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ score, showCategory = true }) => {
  let category: 'LOW' | 'MEDIUM' | 'HIGH';
  let badgeClasses: string;

  if (score >= 70) {
    category = 'HIGH';
    badgeClasses = 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/40';
  } else if (score >= 35) {
    category = 'MEDIUM';
    badgeClasses = 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/40';
  } else {
    category = 'LOW';
    badgeClasses = 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/40';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-xs border ${badgeClasses}`}>
      <span className="font-bold">{score}</span>
      {showCategory && <span className="opacity-80">[{category}]</span>}
    </span>
  );
};
