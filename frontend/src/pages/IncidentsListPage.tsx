import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { incidentsApi } from '../api/incidents';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingState, ErrorState } from '../components/common/FeedbackStates';
import { AlertTriangle, Filter, ChevronRight } from 'lucide-react';
import type { Incident } from '../types';
import { IS_DEMO_MODE } from '../api/client';

export const IncidentsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [scenarioFilter, setScenarioFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [modeFilter, setModeFilter] = useState<string>('ALL');

  const { data: incidents, isLoading, error, refetch } = useQuery<Incident[]>({
    queryKey: ['incidents'],
    queryFn: incidentsApi.getIncidents,
  });

  if (isLoading) return <LoadingState message="Fetching active security incidents..." />;
  if (error) return <ErrorState message={`Failed to load incident repository. ${IS_DEMO_MODE ? 'Demo mode is enabled but no synthetic incidents available.' : 'Backend unreachable — set VITE_DEMO_MODE=true in .env for synthetic data.'}`} onRetry={() => refetch()} />;

  const filteredIncidents = (incidents || []).filter((inc: Incident) => {
    if (scenarioFilter !== 'ALL' && inc.scenarioId !== scenarioFilter) return false;
    if (statusFilter !== 'ALL' && inc.status !== statusFilter) return false;
    if (modeFilter !== 'ALL' && inc.mode !== modeFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full w-full bg-[#0B1220] overflow-hidden select-none font-mono">
      {/* Header */}
      <div className="h-12 px-6 bg-[#111A2E] border-b border-[#22304D] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-[#0E7C86]" />
          <h1 className="text-sm font-bold text-[#E6EDF7] tracking-wider uppercase">
            INCIDENT REPOSITORY & INVESTIGATION LEDGER
          </h1>
          <span className="text-xs text-[#8FA0BF]">({filteredIncidents.length} Records)</span>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#8FA0BF]" />
            <span className="text-[#8FA0BF]">SCENARIO:</span>
            <select
              value={scenarioFilter}
              onChange={(e) => setScenarioFilter(e.target.value)}
              className="bg-[#0B1220] border border-[#22304D] rounded px-2 py-1 text-[#E6EDF7] text-xs outline-hidden"
            >
              <option value="ALL">ALL SCENARIOS</option>
              <option value="scenario-1">Scenario 1 (Standard)</option>
              <option value="scenario-2">Scenario 2 (Adaptive)</option>
              <option value="scenario-3">Scenario 3 (Lateral)</option>
              <option value="scenario-4">Scenario 4 (High-Risk)</option>
              <option value="scenario-5">Scenario 5 (Verify Failure)</option>
              <option value="scenario-6">Scenario 6 (Prompt Injection)</option>
              <option value="scenario-7">Scenario 7 (Benign Admin)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[#8FA0BF]">STATUS:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#0B1220] border border-[#22304D] rounded px-2 py-1 text-[#E6EDF7] text-xs outline-hidden"
            >
              <option value="ALL">ALL STATUSES</option>
              <option value="INVESTIGATING">INVESTIGATING</option>
              <option value="PLANNING">PLANNING</option>
              <option value="EXECUTING">EXECUTING</option>
              <option value="CONTAINED">CONTAINED</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[#8FA0BF]">MODE:</span>
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="bg-[#0B1220] border border-[#22304D] rounded px-2 py-1 text-[#E6EDF7] text-xs outline-hidden"
            >
              <option value="ALL">ALL MODES</option>
              <option value="ENFORCE">ENFORCE</option>
              <option value="SHADOW">SHADOW</option>
            </select>
          </div>
        </div>
      </div>

      {/* Incident Table */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="rounded border border-[#22304D] bg-[#111A2E] overflow-hidden shadow-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#16223B] border-b border-[#22304D] text-[#8FA0BF] text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Incident ID</th>
                <th className="px-4 py-3">Scenario</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Seed</th>
                <th className="px-4 py-3">Replans</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#22304D]">
              {filteredIncidents.map((inc: Incident) => (
                <tr
                  key={inc.id}
                  onClick={() => navigate(`/incidents/${inc.id}`)}
                  className="hover:bg-[#16223B]/60 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-bold text-[#E6EDF7] flex items-center gap-1.5">
                    <span className="text-[#0E7C86] font-mono">#</span>
                    <span>{inc.id}</span>
                  </td>
                  <td className="px-4 py-3 text-[#E6EDF7] font-sans font-medium">
                    {inc.scenarioName}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inc.status} />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        inc.mode === 'ENFORCE'
                          ? 'bg-[#0E7C86]/20 text-[#12929E]'
                          : 'bg-[#F59E0B]/20 text-[#F59E0B]'
                      }`}
                    >
                      {inc.mode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#8FA0BF] font-mono text-[11px]">
                    {inc.seed}
                  </td>
                  <td className="px-4 py-3 text-[#A78BFA] font-bold">
                    {inc.replans}
                  </td>
                  <td className="px-4 py-3 text-[#8FA0BF] text-[11px]">
                    {inc.createdAt}
                  </td>
                  <td className="px-4 py-3 text-[#8FA0BF] text-[11px]">
                    {inc.updatedAt}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[#0E7C86] hover:text-[#12929E] font-bold text-xs inline-flex items-center gap-1">
                      VIEW <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
