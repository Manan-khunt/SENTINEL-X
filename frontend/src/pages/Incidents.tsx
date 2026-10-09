// Incident list + creation (scenario selector uses GET /api/scenarios).
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../auth';
import { Empty, ErrorBox, Loading, Panel, StatusBadge, errMsg } from '../components/ui';
import { roleAtLeast } from '../types';
import type { Mode } from '../types';

export function IncidentsPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const incidents = useQuery({ queryKey: ['incidents'], queryFn: api.listIncidents });
  const scenarios = useQuery({ queryKey: ['scenarios'], queryFn: api.scenarios });

  const [scenarioId, setScenarioId] = useState('scenario_2');
  const [seed, setSeed] = useState(42);
  const [mode, setMode] = useState<Mode>('ENFORCE');
  const [createError, setCreateError] = useState('');

  const create = useMutation({
    mutationFn: () =>
      api.createIncident({ scenario_id: scenarioId, seed, mode, configuration: 'B3' }),
    onSuccess: (inc) => {
      qc.invalidateQueries({ queryKey: ['incidents'] });
      nav(`/incidents/${inc.id}`);
    },
    onError: (e) => setCreateError(errMsg(e)),
  });

  const canCreate = roleAtLeast(user?.role, 'analyst');

  return (
    <div className="flex gap-3 p-3 h-full min-h-0">
      <Panel
        title="INCIDENTS"
        className="flex-1"
        right={
          <span className="font-mono text-[10px] text-muted">
            {incidents.data ? `${incidents.data.length} total` : ''}
          </span>
        }
      >
        {incidents.isPending ? (
          <Loading message="Loading incidents…" />
        ) : incidents.isError ? (
          <ErrorBox message={errMsg(incidents.error)} onRetry={() => incidents.refetch()} />
        ) : incidents.data.length === 0 ? (
          <Empty message="No incidents yet. Create one to begin." />
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="font-mono text-[10px] text-muted tracking-wider text-left border-b border-border">
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">SCENARIO</th>
                <th className="px-3 py-2">STATUS</th>
                <th className="px-3 py-2">STEP</th>
                <th className="px-3 py-2">REPLANS</th>
                <th className="px-3 py-2">MODE</th>
              </tr>
            </thead>
            <tbody>
              {incidents.data.map((i) => (
                <tr key={i.id} className="border-b border-border/50 hover:bg-surface-2">
                  <td className="px-3 py-2 font-mono">
                    <Link to={`/incidents/${i.id}`} className="text-primary hover:underline">
                      {i.id}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono text-text">{i.scenario}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={i.status} />
                  </td>
                  <td className="px-3 py-2 font-mono text-muted">{i.simulation_step}</td>
                  <td className="px-3 py-2 font-mono text-muted">{i.replans}</td>
                  <td className="px-3 py-2 font-mono text-muted">{i.mode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="NEW INCIDENT" className="w-[320px] shrink-0">
        <div className="p-3 flex flex-col gap-3">
          {!canCreate && (
            <div className="font-mono text-[11px] text-warning">
              Role `viewer` is read-only. Sign in as analyst to create incidents.
            </div>
          )}
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-[0.12em] text-muted">SCENARIO</span>
            <select
              value={scenarioId}
              onChange={(e) => setScenarioId(e.target.value)}
              disabled={!canCreate}
              className="bg-surface-2 border border-border rounded px-2 py-2 text-xs font-mono text-text outline-none"
            >
              {(scenarios.data || []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} — {s.name}
                </option>
              ))}
            </select>
          </label>
          {scenarios.data && (
            <div className="text-[11px] text-muted leading-relaxed">
              {scenarios.data.find((s) => s.id === scenarioId)?.description}
            </div>
          )}
          <div className="flex gap-2">
            <label className="flex-1 flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-[0.12em] text-muted">SEED</span>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
                disabled={!canCreate}
                className="bg-surface-2 border border-border rounded px-2 py-2 text-xs font-mono text-text outline-none"
              />
            </label>
            <label className="flex-1 flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-[0.12em] text-muted">MODE</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as Mode)}
                disabled={!canCreate}
                className="bg-surface-2 border border-border rounded px-2 py-2 text-xs font-mono text-text outline-none"
              >
                <option value="ENFORCE">ENFORCE</option>
                <option value="SHADOW">SHADOW</option>
              </select>
            </label>
          </div>
          <div className="font-mono text-[10px] text-muted">
            Configuration: <span className="text-text">B3</span> (full SENTINEL-X agent)
          </div>
          {createError && (
            <div className="font-mono text-[11px] text-danger border border-danger/40 bg-danger/10 rounded px-2 py-1.5">
              {createError}
            </div>
          )}
          <button
            disabled={!canCreate || create.isPending}
            onClick={() => {
              setCreateError('');
              create.mutate();
            }}
            className="rounded bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-mono text-xs font-semibold tracking-wider px-3 py-2"
          >
            {create.isPending ? 'CREATING…' : 'CREATE + RUN AGENT'}
          </button>
          <div className="text-[11px] text-muted leading-relaxed">
            Creation runs the full OBSERVE→…→VERIFY loop synchronously. Same seed reproduces
            the same adversary evolution.
          </div>
        </div>
      </Panel>
    </div>
  );
}

