import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { systemApi, SYSTEM_COMPONENTS_INITIAL } from '../api/system';
import { Server, Cpu } from 'lucide-react';
import { useIncidentStore } from '../stores/incidentStore';

export const SystemPage: React.FC = () => {
  const { isHalted } = useIncidentStore();

  const { data: components, refetch } = useQuery({
    queryKey: ['system-status'],
    queryFn: systemApi.getSystemStatus,
    initialData: SYSTEM_COMPONENTS_INITIAL,
  });

  const getStatusBadge = (status: string, compName: string) => {
    // If global kill switch is active, mark tool gateway and agent as HALTED
    const effectiveStatus = (isHalted && (compName.includes('Gateway') || compName.includes('Agent') || compName.includes('Kill Switch')))
      ? 'HALTED'
      : status;

    switch (effectiveStatus) {
      case 'ONLINE':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#22C55E]/15 text-[#22C55E] border border-[#22304D] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
            ONLINE
          </span>
        );
      case 'HALTED':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/50 flex items-center gap-1 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
            HALTED
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#F59E0B]/15 text-[#F59E0B] border border-[#22304D] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
            DEGRADED
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#8FA0BF]/20 text-[#8FA0BF] border border-[#22304D] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8FA0BF]" />
            OFFLINE
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0B1220] overflow-hidden select-none font-mono">
      {/* Header */}
      <div className="h-12 px-6 bg-[#111A2E] border-b border-[#22304D] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <Server className="w-4 h-4 text-[#0E7C86]" />
          <h1 className="text-sm font-bold text-[#E6EDF7] tracking-wider uppercase">
            SENTINEL-X CORE SYSTEM HEALTH & ARCHITECTURE
          </h1>
        </div>

        <button
          onClick={() => refetch()}
          className="px-3 py-1 bg-[#16223B] hover:bg-[#1f3054] text-[#8FA0BF] hover:text-[#E6EDF7] rounded text-xs border border-[#22304D] transition-colors"
        >
          REFRESH HEALTH PROBES
        </button>
      </div>

      {/* Main Grid Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* System Summary Card */}
        <div className="p-4 rounded bg-[#111A2E] border border-[#22304D] flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-xs font-bold text-[#E6EDF7] uppercase tracking-wide">
              AUTONOMOUS ARCHITECTURE INTEGRATION
            </h2>
            <p className="text-xs text-[#8FA0BF] font-sans">
              All 10 required SOC modules connected via synthetic enterprise simulation bus.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-[#8FA0BF]">Cluster Status:</span>
            <span className="px-2.5 py-1 rounded bg-[#22C55E]/15 text-[#22C55E] border border-[#22304D] font-bold">
              {isHalted ? 'EMERGENCY HALTED' : 'HEALTHY (10/10 OPERATIONAL)'}
            </span>
          </div>
        </div>

        {/* 10 Required Components Grid */}
        <div className="grid grid-cols-2 gap-4">
          {components.map((comp) => (
            <div
              key={comp.name}
              className="p-4 rounded bg-[#111A2E] border border-[#22304D] space-y-2.5 hover:border-[#0E7C86]/60 transition-colors"
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-[#22304D]">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#0E7C86]" />
                  <span className="font-bold text-xs text-[#E6EDF7]">{comp.name}</span>
                </div>
                {getStatusBadge(comp.status, comp.name)}
              </div>

              <p className="text-xs text-[#8FA0BF] font-sans leading-relaxed">
                {comp.details}
              </p>

              <div className="flex items-center justify-between text-[11px] text-[#8FA0BF] pt-1">
                <span>
                  Latency: <strong className="text-[#12929E]">{comp.latencyMs}ms</strong>
                </span>
                {comp.version && (
                  <span>
                    Ver: <strong className="text-[#E6EDF7]">{comp.version}</strong>
                  </span>
                )}
                <span>Checked: {comp.lastChecked}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
