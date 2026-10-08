import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { incidentsApi } from '../api/incidents';
import { StatusBadge } from '../components/common/StatusBadge';
import { RiskBadge } from '../components/common/RiskBadge';
import { LoadingState, ErrorState } from '../components/common/FeedbackStates';
import { AttackGraph } from '../components/graph/AttackGraph';
import { AgentTimeline } from '../components/timeline/AgentTimeline';
import { ActionProof } from '../components/actions/ActionProof';
import { 
  ArrowLeft, 
  Route, 
  ShieldCheck, 
  ArrowRight
} from 'lucide-react';
import { AuditTable } from '../components/audit/AuditTable';
import type { AttackPath } from '../types';
import { IS_DEMO_MODE } from '../api/client';

export const IncidentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const incidentId = id || 'INC-1042';

  const { data: incident, isLoading, error } = useQuery({
    queryKey: ['incident', incidentId],
    queryFn: () => incidentsApi.getIncidentById(incidentId),
  });

  if (isLoading) return <LoadingState message={`Fetching incident ${incidentId}...`} />;
  if (error || !incident) return <ErrorState message={`Incident ${incidentId} could not be resolved. ${IS_DEMO_MODE ? 'Demo mode is ON but incident not found.' : 'Backend unreachable - set VITE_DEMO_MODE=true for synthetic data.'}`} />;

  const currentPath = location.pathname;
  let activeTab = 'overview';
  if (currentPath.endsWith('/graph')) activeTab = 'graph';
  else if (currentPath.endsWith('/timeline')) activeTab = 'timeline';
  else if (currentPath.endsWith('/actions')) activeTab = 'actions';
  else if (currentPath.endsWith('/audit')) activeTab = 'audit';

  const tabs = [
    { key: 'overview', label: 'Overview', path: `/incidents/${incidentId}` },
    { key: 'graph', label: 'Attack Graph', path: `/incidents/${incidentId}/graph` },
    { key: 'timeline', label: 'Timeline & Events', path: `/incidents/${incidentId}/timeline` },
    { key: 'actions', label: 'Actions & Proof', path: `/incidents/${incidentId}/actions` },
    { key: 'audit', label: 'Audit Trail', path: `/incidents/${incidentId}/audit` },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-[#0B1220] overflow-hidden select-none font-mono">
      {/* Top Header */}
      <div className="h-14 px-6 bg-[#111A2E] border-b border-[#22304D] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/incidents')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#16223B] hover:bg-[#1f3054] text-xs text-[#8FA0BF] hover:text-[#E6EDF7] border border-[#22304D] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>BACK TO INCIDENTS</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-[#E6EDF7]">{incident.id}</span>
            <span className="text-[#8FA0BF] text-xs font-sans">({incident.scenarioName})</span>
          </div>

          <StatusBadge status={incident.status} />
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-[#0B1220] p-1 rounded border border-[#22304D]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => navigate(tab.path)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                activeTab === tab.key
                  ? 'bg-[#16223B] text-[#E6EDF7] font-bold border border-[#0E7C86]'
                  : 'text-[#8FA0BF] hover:text-[#E6EDF7]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'overview' && (
          <div className="h-full overflow-y-auto p-6 space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 rounded bg-[#111A2E] border border-[#22304D] space-y-1">
                <span className="text-[11px] text-[#8FA0BF] uppercase">Threat Status</span>
                <div className="text-lg font-bold text-[#EF4444]">{incident.threatLevel}</div>
                <p className="text-[10px] text-[#8FA0BF]">Calculated by ground probe</p>
              </div>

              <div className="p-4 rounded bg-[#111A2E] border border-[#22304D] space-y-1">
                <span className="text-[11px] text-[#8FA0BF] uppercase">Replan Iterations</span>
                <div className="text-lg font-bold text-[#A78BFA]">{incident.replans}</div>
                <p className="text-[10px] text-[#8FA0BF]">Autonomous re-routing</p>
              </div>

              <div className="p-4 rounded bg-[#111A2E] border border-[#22304D] space-y-1">
                <span className="text-[11px] text-[#8FA0BF] uppercase">Operating Mode</span>
                <div className="text-lg font-bold text-[#12929E]">{incident.mode}</div>
                <p className="text-[10px] text-[#8FA0BF]">Enforce via Tool Gateway</p>
              </div>

              <div className="p-4 rounded bg-[#111A2E] border border-[#22304D] space-y-1">
                <span className="text-[11px] text-[#8FA0BF] uppercase">Containment Status</span>
                <div className="text-lg font-bold text-[#22C55E]">
                  {incident.status === 'CONTAINED' ? 'VERIFIED CONTAINED' : 'IN PROGRESS'}
                </div>
                <p className="text-[10px] text-[#8FA0BF]">Network path verified</p>
              </div>
            </div>

            {/* Attack Paths Overview */}
            <div className="p-5 rounded bg-[#111A2E] border border-[#22304D] space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#22304D]">
                <div className="flex items-center gap-2">
                  <Route className="w-4 h-4 text-[#0E7C86]" />
                  <h3 className="font-bold text-sm text-[#E6EDF7]">MONITORED ATTACK PATHS</h3>
                </div>
                <span className="text-xs text-[#8FA0BF]">{incident.activePaths.length} Active Routes</span>
              </div>

              <div className="space-y-2">
                {incident.activePaths.map((p: AttackPath) => (
                  <div key={p.id} className="p-3 bg-[#0B1220] rounded border border-[#22304D] flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="font-bold text-xs text-[#E6EDF7]">{p.label}</div>
                      <div className="flex items-center gap-2 text-xs text-[#8FA0BF]">
                        {p.nodes.map((n: string, i: number) => (
                          <React.Fragment key={n}>
                            <span className={n === 'customer_db' ? 'text-[#F59E0B] font-bold' : 'text-[#E6EDF7]'}>
                              {n}
                            </span>
                            {i < p.nodes.length - 1 && <ArrowRight className="w-3 h-3 text-[#0E7C86]" />}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            </div>

            {/* Action Proof Summary */}
            {incident.currentAction && (
              <div className="p-5 rounded bg-[#111A2E] border border-[#22304D] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#22304D]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#22C55E]" />
                    <h3 className="font-bold text-sm text-[#E6EDF7]">LATEST CONTAINMENT ACTION PROOF</h3>
                  </div>
                  <RiskBadge score={incident.currentAction.riskScore} />
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-[#8FA0BF]">Action Tool:</span>
                    <div className="p-2 bg-[#0B1220] rounded border border-[#22304D] text-[#E6EDF7] font-bold">
                      {incident.currentAction.action}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[#8FA0BF]">Target Asset:</span>
                    <div className="p-2 bg-[#0B1220] rounded border border-[#22304D] text-[#12929E] font-bold">
                      {incident.currentAction.target}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-[#8FA0BF] space-y-1 pt-1">
                  <div>
                    <strong className="text-[#E6EDF7]">Predicted Impact:</strong>{' '}
                    {incident.currentAction.dryRun.predictedPathRemoval}
                  </div>
                  <div>
                    <strong className="text-[#E6EDF7]">Verification Verdict:</strong>{' '}
                    <span className="text-[#22C55E] font-bold">{incident.currentAction.result}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'graph' && (
          <div className="h-full w-full">
            <AttackGraph />
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="h-full w-full max-w-4xl mx-auto p-4">
            <AgentTimeline />
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="h-full w-full max-w-2xl mx-auto p-4">
            <ActionProof />
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="h-full w-full p-6 overflow-y-auto">
            <AuditTable incidentId={incidentId} />
          </div>
        )}
      </div>
    </div>
  );
};
