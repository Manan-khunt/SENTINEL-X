// Replay: deterministic incident record (audit events + full timeline + graph).
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { Empty, ErrorBox, Loading, Panel, StatusBadge, errMsg } from '../components/ui';

export function ReplayPage() {
  const [id, setId] = useState('');
  const [active, setActive] = useState('');

  const incident = useQuery({
    queryKey: ['incident', active],
    queryFn: () => api.getIncident(active),
    enabled: !!active,
  });
  const replay = useQuery({
    queryKey: ['replay', active],
    queryFn: () => api.getReplay(active),
    enabled: !!active,
  });
  const timeline = useQuery({
    queryKey: ['timeline', active],
    queryFn: () => api.getTimeline(active),
    enabled: !!active,
  });

  return (
    <div className="flex gap-3 p-3 h-full min-h-0">
      <Panel title="REPLAY SELECTOR" className="w-[300px] shrink-0">
        <form
          className="p-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setActive(id.trim());
          }}
        >
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="INC-1043"
            className="flex-1 bg-surface-2 border border-border rounded px-2 py-2 text-xs font-mono text-text outline-none"
          />
          <button
            type="submit"
            className="rounded bg-primary hover:bg-primary-hover text-white font-mono text-[11px] font-semibold px-3"
          >
            LOAD
          </button>
        </form>
        {!active && <Empty message="Enter a completed incident ID to replay its record." />}
        {incident.data && (
          <div className="px-3 pb-3 font-mono text-[11px] flex flex-col gap-1">
            <span className="text-text font-bold">{incident.data.id}</span>
            <StatusBadge status={incident.data.status} />
            <span className="text-muted">
              {incident.data.scenario} · seed {incident.data.seed} · replans{' '}
              {incident.data.replans}
            </span>
          </div>
        )}
      </Panel>
      <Panel title="REPLAY EVENTS (AUDIT ORDER)" className="flex-1">
        {!active ? (
          <Empty message="No incident selected." />
        ) : replay.isPending ? (
          <Loading />
        ) : replay.isError ? (
          <ErrorBox message={errMsg(replay.error)} onRetry={() => replay.refetch()} />
        ) : (
          <div className="p-2 flex flex-col gap-1">
            {replay.data.events.map((e) => (
              <div
                key={e.id}
                className="font-mono text-[11px] px-2 py-1 rounded bg-bg border border-border/70 flex gap-2"
              >
                <span className="text-muted">#{e.id}</span>
                <span className="text-text">{e.event}</span>
                <span className="text-muted ml-auto truncate">
                  {e.hash.slice(0, 16)}…
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="AGENT STEPS + ADVERSARY" className="flex-1">
        {!active ? (
          <Empty message="No incident selected." />
        ) : timeline.isPending ? (
          <Loading />
        ) : timeline.isError ? (
          <ErrorBox message={errMsg(timeline.error)} onRetry={() => timeline.refetch()} />
        ) : (
          <div className="p-2 flex flex-col gap-1">
            {(timeline.data?.events || []).map((e, i) => (
              <div
                key={i}
                className="font-mono text-[11px] px-2 py-1 rounded bg-bg border border-border/70"
              >
                <span className="text-primary font-bold">{e.event}</span>{' '}
                <span className="text-muted">{e.actor}</span>
                <div className="text-muted break-words">
                  {JSON.stringify(e.payload).slice(0, 280)}
                </div>
              </div>
            ))}
            {(timeline.data?.events || []).length === 0 && (
              <Empty message="No events recorded." />
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
