// System status, mode control, kill switch. Backend is authoritative.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../auth';
import { ErrorBox, KV, Loading, Panel, errMsg } from '../components/ui';
import { roleAtLeast } from '../types';

export function SystemPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [msg, setMsg] = useState('');
  const health = useQuery({ queryKey: ['health'], queryFn: api.health });
  const status = useQuery({ queryKey: ['sys-status'], queryFn: api.systemStatus });
  const mode = useQuery({ queryKey: ['sys-mode'], queryFn: api.systemMode });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['sys-status'] });
    qc.invalidateQueries({ queryKey: ['sys-mode'] });
    qc.invalidateQueries({ queryKey: ['health'] });
  };
  const kill = useMutation({
    mutationFn: api.killSwitch,
    onSuccess: (r) => {
      setMsg(`Kill switch: ${r.status}`);
      refresh();
    },
    onError: (e) => setMsg(errMsg(e)),
  });
  const resume = useMutation({
    mutationFn: api.resumeSystem,
    onSuccess: (r) => {
      setMsg(`System: ${r.status}`);
      refresh();
    },
    onError: (e) => setMsg(errMsg(e)),
  });
  const setMode = useMutation({
    mutationFn: api.setSystemMode,
    onSuccess: (r) => {
      setMsg(`Mode: ${r.mode}`);
      refresh();
    },
    onError: (e) => setMsg(errMsg(e)),
  });

  const canHalt = roleAtLeast(user?.role, 'approver');
  const canMode = roleAtLeast(user?.role, 'admin');

  return (
    <div className="flex gap-3 p-3 h-full min-h-0">
      <Panel title="BACKEND HEALTH" className="flex-1">
        {health.isPending ? (
          <Loading />
        ) : health.isError ? (
          <ErrorBox message={errMsg(health.error)} onRetry={() => health.refetch()} />
        ) : (
          <div className="p-3">
            <KV k="API" v={health.data.api} />
            <KV k="DATABASE" v={health.data.database} />
            <KV k="ENVIRONMENT" v={health.data.environment} />
            <KV k="AGENT" v={health.data.agent} />
            <KV k="VERSION" v={health.data.version} />
          </div>
        )}
      </Panel>
      <Panel title="SYSTEM CONTROL" className="flex-1">
        <div className="p-3 flex flex-col gap-3">
          {status.isPending || mode.isPending ? (
            <Loading />
          ) : status.isError || mode.isError ? (
            <ErrorBox
              message={errMsg(status.error || mode.error)}
              onRetry={() => {
                status.refetch();
                mode.refetch();
              }}
            />
          ) : (
            <>
              <KV k="STATUS" v={status.data!.status} />
              <KV k="MODE" v={mode.data!.mode} />
              <div className="text-[11px] text-[#8FA0BF]">
                Synthetic enterprise environment · in-process orchestration · SQLite · SSE
              </div>
              {canMode && (
                <div className="flex gap-2">
                  {(['ENFORCE', 'SHADOW'] as const).map((m) => (
                    <button
                      key={m}
                      disabled={setMode.isPending || mode.data!.mode === m}
                      onClick={() => setMode.mutate(m)}
                      className="flex-1 font-mono text-[11px] px-2 py-1.5 rounded bg-[#16223B] border border-[#22304D] hover:bg-[#1f3054] disabled:opacity-50"
                    >
                      SET {m}
                    </button>
                  ))}
                </div>
              )}
              {canHalt ? (
                <div className="flex gap-2">
                  <button
                    disabled={kill.isPending}
                    onClick={() => kill.mutate()}
                    className="flex-1 rounded bg-[#EF4444] hover:brightness-110 disabled:opacity-50 text-white font-mono text-[11px] font-bold px-2 py-2"
                  >
                    KILL SWITCH (HALT)
                  </button>
                  <button
                    disabled={resume.isPending}
                    onClick={() => resume.mutate()}
                    className="flex-1 rounded bg-[#22C55E] hover:brightness-110 disabled:opacity-50 text-black font-mono text-[11px] font-bold px-2 py-2"
                  >
                    RESUME
                  </button>
                </div>
              ) : (
                <div className="font-mono text-[10px] text-[#8FA0BF]">
                  Kill switch requires approver role or higher.
                </div>
              )}
              {msg && <div className="font-mono text-[11px] text-[#E6EDF7]">{msg}</div>}
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}
