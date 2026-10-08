import React from 'react';
import { X, ArrowRight, Activity } from 'lucide-react';
import type { GraphEdge } from '../../types';
import { StatusBadge } from '../common/StatusBadge';

interface GraphEdgeDetailsProps {
  edge: GraphEdge;
  onClose: () => void;
}

export const GraphEdgeDetails: React.FC<GraphEdgeDetailsProps> = ({ edge, onClose }) => {
  return (
    <div className="absolute top-3 right-3 w-80 bg-[#111A2E]/95 border border-[#22304D] rounded shadow-2xl p-4 text-xs font-mono z-20 backdrop-blur-md animate-in slide-in-from-right-4 duration-150 select-none">
      <div className="flex items-center justify-between pb-3 border-b border-[#22304D]">
        <div>
          <h3 className="font-bold text-[#E6EDF7] text-sm tracking-wide">
            Attack Path Edge
          </h3>
          <span className="text-[10px] text-[#8FA0BF]">{edge.relationship}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-[#8FA0BF] hover:text-[#E6EDF7] rounded hover:bg-[#16223B]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="py-3 space-y-2.5">
        <div className="p-2.5 rounded bg-[#0B1220] border border-[#22304D] flex items-center justify-between">
          <span className="text-[#E6EDF7] font-semibold">{edge.source}</span>
          <ArrowRight className="w-4 h-4 text-[#0E7C86]" />
          <span className="text-[#E6EDF7] font-semibold">{edge.target}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[#8FA0BF]">RELATIONSHIP</span>
          <span className="text-[#E6EDF7] font-medium">{edge.relationship}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[#8FA0BF]">STATUS</span>
          <StatusBadge status={edge.status} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[#8FA0BF]">FIRST OBSERVED</span>
          <span className="text-[#8FA0BF]">{edge.firstObserved || 'Initial Telemetry'}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[#8FA0BF]">LAST OBSERVED</span>
          <span className="text-[#8FA0BF]">{edge.lastObserved || 'Live'}</span>
        </div>

        {edge.isDiff && (
          <div className="p-2 rounded bg-[#A78BFA]/10 border border-[#A78BFA]/40 text-[#A78BFA] text-[11px] flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 shrink-0" />
            <span>GRAPH DIFF: Edge created dynamically by adversary</span>
          </div>
        )}
      </div>
    </div>
  );
};
