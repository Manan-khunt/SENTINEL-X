import React from 'react';
import type { RiskFactors as RiskFactorsType } from '../../types';

interface RiskFactorsProps {
  factors: RiskFactorsType;
}

export const RiskFactors: React.FC<RiskFactorsProps> = ({ factors }) => {
  const items = [
    { label: 'Criticality', weight: '35%', value: factors.criticality, color: 'bg-[#EF4444]' },
    { label: 'Blast Radius', weight: '25%', value: factors.blastRadius, color: 'bg-[#F59E0B]' },
    { label: 'Irreversibility', weight: '25%', value: factors.irreversibility, color: 'bg-[#A78BFA]' },
    { label: 'Uncertainty', weight: '15%', value: factors.uncertainty, color: 'bg-[#3B82F6]' },
  ];

  return (
    <div className="space-y-2 p-2.5 rounded bg-[#0B1220] border border-[#22304D] text-xs font-mono">
      <div className="flex items-center justify-between text-[10px] text-[#8FA0BF] border-b border-[#22304D] pb-1 uppercase font-bold tracking-wider">
        <span>RISK FACTORS BREAKDOWN</span>
        <span className="text-[9px] text-[#8FA0BF]/60">Weighted Formula</span>
      </div>

      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="space-y-0.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#8FA0BF]">
                {item.label} <span className="text-[10px] text-[#8FA0BF]/60">({item.weight})</span>
              </span>
              <span className="font-bold text-[#E6EDF7]">{item.value}</span>
            </div>
            {/* Meter bar */}
            <div className="w-full h-1 bg-[#16223B] rounded-full overflow-hidden">
              <div
                className={`h-full ${item.color} rounded-full transition-all duration-300`}
                style={{ width: `${Math.min(item.value, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="text-[9px] text-[#8FA0BF]/70 pt-1 border-t border-[#22304D]/60 italic">
        Score = 0.35×Crit + 0.25×Blast + 0.25×Irrev + 0.15×Uncert
      </div>
    </div>
  );
};
