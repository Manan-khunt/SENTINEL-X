import React from 'react';

export const GraphLegend: React.FC = () => {
  return (
    <div className="absolute top-3 left-3 bg-[#111A2E]/90 border border-[#22304D] rounded px-3 py-2 text-[11px] font-mono z-10 backdrop-blur-xs shadow-lg space-y-1.5 select-none">
      <div className="text-[10px] uppercase text-[#8FA0BF] font-bold tracking-wider border-b border-[#22304D] pb-1">
        Graph Legend
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] border border-red-300 shadow-xs shadow-red-500/50" />
          <span className="text-[#E6EDF7]">ACTIVE PATH</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#8FA0BF]/40 border border-[#8FA0BF]/60" />
          <span className="text-[#8FA0BF]">BLOCKED</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] border border-green-300" />
          <span className="text-[#E6EDF7]">SAFE</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#A78BFA] border border-purple-300 shadow-xs shadow-purple-500/50 animate-pulse" />
          <span className="text-[#A78BFA] font-bold">GRAPH DIFF</span>
        </div>
      </div>
      <div className="pt-1 border-t border-[#22304D] flex items-center gap-1.5 text-[10px] text-[#F59E0B]">
        <span className="w-2.5 h-2.5 rounded-xs bg-[#F59E0B] border border-amber-300 font-bold flex items-center justify-center text-[7px] text-black">
          ★
        </span>
        <span className="font-semibold">CROWN JEWEL (PROTECTED)</span>
      </div>
    </div>
  );
};
