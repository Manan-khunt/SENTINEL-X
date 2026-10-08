import React from 'react';
import { Route, ArrowRight, Activity } from 'lucide-react';
import { useIncidentStore } from '../../stores/incidentStore';
import { StatusBadge } from '../common/StatusBadge';

export const AttackPathList: React.FC = () => {
  const { paths, diffBannerActive } = useIncidentStore();

  return (
    <div className="h-28 bg-[#111A2E] border-t border-[#22304D] px-4 py-2 flex flex-col shrink-0 select-none overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[#22304D] text-xs font-mono">
        <div className="flex items-center gap-2">
          <Route className="w-3.5 h-3.5 text-[#0E7C86]" />
          <span className="font-bold text-[#E6EDF7] tracking-wider uppercase">
            ACTIVE ATTACK PATHS TO CROWN JEWEL
          </span>
          <span className="text-[10px] text-[#8FA0BF]">({paths.length} Paths Evaluated)</span>
        </div>

        {diffBannerActive && (
          <div className="flex items-center gap-1.5 text-[10px] text-[#A78BFA] font-bold animate-pulse">
            <Activity className="w-3 h-3" />
            <span>ADVERSARY MUTATION HIGHLIGHTED</span>
          </div>
        )}
      </div>

      {/* Path List Cards */}
      <div className="flex-1 flex items-center gap-3 overflow-x-auto py-1">
        {paths.map((path) => {
          const isHighlighted = path.isDiffHighlighted || (diffBannerActive && path.id === 'path-b');
          return (
            <div
              key={path.id}
              className={`flex items-center gap-3 px-3 py-2 rounded border font-mono text-xs transition-all shrink-0 ${
                isHighlighted
                  ? 'bg-[#A78BFA]/10 border-[#A78BFA] shadow-sm shadow-purple-900/40 animate-pulse'
                  : path.status === 'ACTIVE'
                  ? 'bg-[#0B1220] border-[#EF4444]/60'
                  : 'bg-[#0B1220]/70 border-[#22304D]'
              }`}
            >
              <div className="flex flex-col">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    isHighlighted
                      ? 'text-[#A78BFA]'
                      : path.status === 'ACTIVE'
                      ? 'text-[#EF4444]'
                      : 'text-[#8FA0BF]'
                  }`}
                >
                  {path.label}
                </span>
                <span className="text-[9px] text-[#8FA0BF] truncate max-w-[120px]">
                  {path.status === 'BLOCKED' ? 'Severed by Agent' : 'Threat Route'}
                </span>
              </div>

              {/* Node Sequence */}
              <div className="flex items-center gap-1.5 bg-[#16223B] px-2.5 py-1 rounded border border-[#22304D] text-[11px]">
                {path.nodes.map((node, i) => (
                  <React.Fragment key={node}>
                    <span
                      className={`font-semibold ${
                        node === 'customer_db'
                          ? 'text-[#F59E0B]'
                          : path.status === 'ACTIVE'
                          ? 'text-[#E6EDF7]'
                          : 'text-[#8FA0BF]'
                      }`}
                    >
                      {node}
                    </span>
                    {i < path.nodes.length - 1 && (
                      <ArrowRight className="w-3 h-3 text-[#0E7C86] shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>

              <StatusBadge status={path.status} size="sm" />
            </div>
          );
        })}
      </div>
    </div>
  );
};
