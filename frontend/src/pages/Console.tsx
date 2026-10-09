// SOC console: attack graph (left) + agent timeline (center) +
// action proof & approval (right) + attack paths (bottom).
// Every value comes from the backend; SSE refreshes live.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, connectIncidentStream } from '../api';
import { useAuth } from '../auth';
import { AttackGraph } from '../components/Graph';
import { Empty, ErrorBox, KV, Loading, Panel, RiskBadge, StatusBadge, errMsg } from '../components/ui';
import { roleAtLeast } from '../types';
import type { GraphDiffPayload, LiveEvent } from '../types';

function fmtPayload(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function ConsolePage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [live, setLive] = useState<LiveEvent[]>([]);
  const [sseState, setSseState] = useState<'CONNECTING' | 'LIVE' | 'RECONNECTING' | 'DISCONNECTED'>(
    'CONNECTING',
  );
  const timelineRef = useRef<HTMLDivElement>(null);

  const incident = useQuery({ queryKey: ['incident', id], queryFn: () => api.getIncident(id) });
  const graph = useQuery({ queryKey: ['graph', id], queryFn: () => api.getGraph(id) });
  const paths = useQuery({ queryKey: ['paths', id], queryFn: () => api.getPaths(id) });
  const timeline = useQuery({ queryKey: ['timeline', id], queryFn: () => api.getTimeline(id) });
  const actions = useQuery({ queryKey: ['actions', id], queryFn: () => api.getActions(id) });
  const proof = useQuery({
    queryKey: ['proof', id, selectedAction],
    queryFn: () => api.getProof(id, selectedAction!),
    enabled: !!selectedAction,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['incident', id] });
    qc.invalidateQueries({ queryKey: ['graph', id] });
    qc.invalidateQueries({ queryKey: ['paths', id] });
    qc.invalidateQueries({ queryKey: ['timeline', id] });
    qc.invalidateQueries({ queryKey: ['actions', id] });
  };

  // Live SSE with bounded exponential-backoff reconnect.
  // - Fresh short-lived ticket per (re)connect (tickets expire server-side).
  // - Dedupe by server event id: the backend replays buffered history on
  //   every connect, so reconnects would otherwise double-apply events.
  // - REST resync on every (re)connect; never presented as live while down.
  // - Full cleanup on incident switch / unmount.
  useEffect(() => {
    if (!id) return;
    let closed = false;
    let esClose: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const seen = new Set<string>();
    const MAX_ATTEMPTS = 8;

    const scheduleReconnect = () => {
      if (closed) return;
      esClose?.();
      esClose = null;
      attempts += 1;
      if (attempts > MAX_ATTEMPTS) {
        setSseState('DISCONNECTED');
        return;
      }
      setSseState('RECONNECTING');
      timer = setTimeout(connect, Math.min(1000 * 2 ** (attempts - 1), 15000));
    };

    const connect = async () => {
      if (closed) return;
      setSseState(attempts === 0 ? 'CONNECTING' : 'RECONNECTING');
      let ticket: string;
      try {
        ({ ticket } = await api.streamTicket());
      } catch {
        scheduleReconnect();
        return;
      }
      if (closed) return;
      esClose = connectIncidentStream(
        id,
        ticket,
        (e, eventId) => {
          if (closed) return;
          if (eventId) {
            const key = `${e.type}:${eventId}`;
            if (seen.has(key)) return;
            seen.add(key);
          }
          attempts = 0;
          setSseState('LIVE');
          setLive((prev) => [...prev.slice(-199), e]);
          if (
            [
              'agent.step',
              'graph.updated',
              'graph.diff',
              'action.executed',
              'verification.completed',
              'incident.replanned',
              'incident.contained',
              'incident.failed',
              'incident.halted',
              'adversary.action',
            ].includes(e.type)
          ) {
            refresh();
          }
        },
        scheduleReconnect,
      );
      // Reconcile with authoritative REST state after (re)connect.
      refresh();
    };

    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      esClose?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight });
  }, [timeline.data, live]);

  const step = useMutation({
    mutationFn: () => api.stepIncident(id),
    onSuccess: refresh,
  });
  const approve = useMutation({ mutationFn: api.approve, onSuccess: refresh });
  const deny = useMutation({ mutationFn: api.deny, onSuccess: refresh });
  const undo = useMutation({ mutationFn: api.undo, onSuccess: refresh });

  const events = useMemo(() => timeline.data?.events || [], [timeline.data]);

  const latestDiff = useMemo<GraphDiffPayload | null>(() => {
    let base: GraphDiffPayload | null = null;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].event === 'graph.diff') {
        base = { ...(events[i].payload as unknown as GraphDiffPayload) };
        break;
      }
    }
    // The pivot's new paths are reported on incident.replanned (reason:
    // "new active path", payload.paths) — merge them into the overlay so the
    // attacker pivot is always highlighted, never silently missed.
    const replanPaths: string[][] = [];
    for (const e of events) {
      if (e.event === 'incident.replanned') {
        const p = (e.payload as Record<string, unknown>)?.paths;
        if (Array.isArray(p)) {
          for (const path of p) {
            if (Array.isArray(path)) replanPaths.push(path as string[]);
          }
        }
      }
    }
    if (replanPaths.length === 0) return base;
    return {
      new_nodes: base?.new_nodes || [],
      removed_nodes: base?.removed_nodes || [],
      changed_edges: base?.changed_edges || [],
      new_active_paths: [...(base?.new_active_paths || []), ...replanPaths],
      blocked_paths: base?.blocked_paths || [],
    };
  }, [events]);

  const replanned = useMemo(
    () => events.some((e) => e.event === 'incident.replanned'),
    [events],
  );
  const verifications = useMemo(
    () => events.filter((e) => e.event === 'verification.completed'),
    [events],
  );
  const injections = useMemo(
    () => events.filter((e) => e.event === 'injection.flagged'),
    [events],
  );
  const adversaryMoves = useMemo(
    () => events.filter((e) => e.event === 'adversary.action'),
    [events],
  );

  const activeNodes = useMemo(() => {
    const s = new Set<string>();
    (paths.data?.paths || []).forEach((p) => p.nodes.forEach((n) => s.add(n)));
    return s;
  }, [paths.data]);

  const pendingApproval = useMemo(
    () => (actions.data || []).filter((a) => a.approval_status === 'pending'),
    [actions.data],
  );

  const canAct = roleAtLeast(user?.role, 'analyst');
  const canApprove = roleAtLeast(user?.role, 'approver');

  if (incident.isPending) return <Loading message={`Loading ${id}…`} />;
  if (incident.isError)
    return <ErrorBox message={errMsg(incident.error)} onRetry={() => incident.refetch()} />;
  const inc = incident.data;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Incident header strip */}
      <div className="flex items-center gap-4 px-3 py-2 border-b border-[#22304D] bg-[#111A2E] shrink-0 flex-wrap">
        <span className="font-mono text-sm font-bold text-[#E6EDF7]">{inc.id}</span>
        <span className="font-mono text-[11px] text-[#8FA0BF]">
          {inc.scenario} · seed {inc.seed} · {inc.configuration}
        </span>
        <StatusBadge status={inc.status} />
        <span className="font-mono text-[11px] text-[#8FA0BF]">
          step <span className="text-[#E6EDF7]">{inc.simulation_step}</span> · replans{' '}
          <span className={inc.replans > 0 ? 'text-[#A78BFA] font-bold' : 'text-[#E6EDF7]'}>
            {inc.replans}
          </span>{' '}
          · graph v{inc.graph_version}
        </span>
        {replanned && (
          <span className="font-mono text-[11px] font-bold text-[#A78BFA] border border-[#A78BFA]/50 bg-[#A78BFA]/10 rounded px-1.5 py-0.5">
            REPLAN TRIGGERED
          </span>
        )}
        <span className="flex-1" />
        <span className="font-mono text-[10px] text-[#8FA0BF]">
          SSE:{' '}
          <span
            className={
              sseState === 'LIVE'
                ? 'text-[#22C55E]'
                : sseState === 'DISCONNECTED'
                  ? 'text-[#EF4444]'
                  : 'text-[#F59E0B]'
            }
          >
            {sseState}
          </span>
        </span>
        <button
          onClick={() => refresh()}
          className="font-mono text-[11px] px-2 py-1 rounded bg-[#16223B] border border-[#22304D] hover:bg-[#1f3054]"
        >
          REFRESH
        </button>
        {canAct && (
          <button
            onClick={() => step.mutate()}
            disabled={step.isPending}
            className="font-mono text-[11px] px-2 py-1 rounded bg-[#0E7C86] hover:bg-[#12929E] disabled:opacity-50 text-white font-semibold"
          >
            {step.isPending ? 'STEPPING…' : 'RUN STEP'}
          </button>
        )}
      </div>

      {/* Injection banner (Scenario 6: telemetry treated as data) */}
      {injections.length > 0 && (
        <div className="px-3 py-1.5 bg-[#F59E0B]/10 border-b border-[#F59E0B]/40 font-mono text-[11px] text-[#F59E0B] shrink-0">
          UNTRUSTED TELEMETRY SANITIZED — {injections.length} injection attempt(s) flagged and
          blocked at the gateway. Instruction-like log content never becomes a tool call.
        </div>
      )}

      {/* 3-column console */}
      <div className="flex-1 flex min-h-0 gap-3 p-3">
        <Panel title="LIVE ATTACK GRAPH" className="w-[40%]">
          {graph.isPending ? (
            <Loading />
          ) : graph.isError ? (
            <ErrorBox message={errMsg(graph.error)} onRetry={() => graph.refetch()} />
          ) : (
            <AttackGraph
              snapshot={graph.data}
              activeNodes={activeNodes}
              diff={latestDiff}
              height="100%"
            />
          )}
        </Panel>

        <Panel
          title="AGENT TIMELINE"
          className="w-[32%]"
          right={
            <span className="font-mono text-[10px] text-[#8FA0BF]">
              {timeline.data ? `${timeline.data.steps.length} steps · ${events.length} events` : ''}
            </span>
          }
        >
          {timeline.isPending ? (
            <Loading />
          ) : timeline.isError ? (
            <ErrorBox message={errMsg(timeline.error)} onRetry={() => timeline.refetch()} />
          ) : (
            <div ref={timelineRef} className="p-2 flex flex-col gap-1.5">
              {timeline.data.steps.map((s, i) => (
                <div key={i} className="soc-panel-sub rounded px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-[#0E7C86] tracking-wider">
                      {s.phase}
                    </span>
                    <span className="font-mono text-[10px] text-[#8FA0BF] ml-auto">
                      {fmtPayload((s.payload as Record<string, unknown>)?.step ?? `#${i}`)}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-[#E6EDF7] mt-0.5 break-words">
                    {fmtPayload(s.payload)}
                  </div>
                </div>
              ))}
              {events.map((e, i) => (
                <TimelineRow key={`e${i}`} actor={e.actor} event={e.event} payload={e.payload} />
              ))}
              {live
                .filter((l) => l.type !== 'message')
                .slice(-8)
                .map((l, i) => (
                  <div
                    key={`l${i}`}
                    className="rounded px-2 py-1 border border-dashed border-[#A78BFA]/50 font-mono text-[10px] text-[#A78BFA]"
                  >
                    LIVE ▸ {l.type}: {fmtPayload(l.data).slice(0, 160)}
                  </div>
                ))}
              {events.length === 0 && timeline.data.steps.length === 0 && (
                <Empty message="No agent activity recorded." />
              )}
            </div>
          )}
        </Panel>

        <div className="w-[28%] flex flex-col gap-3 min-h-0">
          <Panel title="ACTION PROOF" className="flex-1">
            {actions.isPending ? (
              <Loading />
            ) : actions.isError ? (
              <ErrorBox message={errMsg(actions.error)} onRetry={() => actions.refetch()} />
            ) : (actions.data || []).length === 0 ? (
              <Empty message="No tool actions recorded for this incident." />
            ) : (
              <div className="p-2 flex flex-col gap-1.5">
                {(actions.data || []).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAction(a.id)}
                    className={`text-left rounded px-2 py-1.5 border font-mono text-[11px] ${
                      selectedAction === a.id
                        ? 'border-[#0E7C86] bg-[#0E7C86]/10'
                        : 'border-[#22304D] bg-[#16223B] hover:border-[#0E7C86]/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[#E6EDF7] font-semibold">
                        {a.tool}({a.target})
                      </span>
                      <span className="ml-auto">
                        <RiskBadge tier={a.risk_tier} score={a.risk_score} />
                      </span>
                    </div>
                    <div className="text-[#8FA0BF] text-[10px] mt-0.5">
                      {a.approval_status} · {a.result}
                      {a.undone ? ' · UNDONE' : ''}
                    </div>
                  </button>
                ))}
                {selectedAction &&
                  (proof.isPending ? (
                    <Loading message="Loading proof…" />
                  ) : proof.isError ? (
                    <ErrorBox message={errMsg(proof.error)} onRetry={() => proof.refetch()} />
                  ) : (
                    proof.data && (
                      <div className="rounded border border-[#22304D] bg-[#0B1220] p-2">
                        <KV k="ACTION" v={proof.data.action} />
                        <KV k="TARGET" v={proof.data.target} />
                        <KV k="REASON" v={proof.data.reason} mono={false} />
                        <KV k="RISK" v={proof.data.risk} />
                        <KV
                          k="FACTORS"
                          v={`crit ${proof.data.criticality} · blast ${proof.data.blast} · irrev ${proof.data.irreversibility} · unc ${proof.data.uncertainty}`}
                        />
                        <KV k="DRY-RUN" v={proof.data.dry_run} mono={false} />
                        <KV k="APPROVAL" v={proof.data.approval} />
                        <KV k="REVERSIBLE" v={proof.data.reversible ? 'YES' : 'NO'} />
                        <KV k="RESULT" v={proof.data.result} />
                        <KV k="LOG HASH" v={String(proof.data.log_hash).slice(0, 20) + '…'} />
                        <KV k="PREV HASH" v={String(proof.data.previous_hash).slice(0, 20) + '…'} />
                        {canAct && (
                          <UndoButton
                            actionId={selectedAction}
                            onUndo={() => undo.mutate(selectedAction)}
                            busy={undo.isPending}
                          />
                        )}
                      </div>
                    )
                  ))}
              </div>
            )}
          </Panel>

          <Panel
            title="HUMAN APPROVAL"
            className="max-h-[42%]"
            right={
              pendingApproval.length > 0 ? (
                <span className="font-mono text-[10px] font-bold text-[#F59E0B]">
                  {pendingApproval.length} PENDING
                </span>
              ) : undefined
            }
          >
            <div className="p-2 flex flex-col gap-1.5">
              {pendingApproval.length === 0 ? (
                <Empty message="No actions awaiting approval." />
              ) : (
                pendingApproval.map((a) => (
                  <div
                    key={a.id}
                    className="rounded border border-[#F59E0B]/50 bg-[#F59E0B]/5 p-2"
                  >
                    <div className="font-mono text-[11px] font-bold text-[#F59E0B]">
                      HIGH-RISK ACTION
                    </div>
                    <KV k="TOOL" v={`${a.tool}(${a.target})`} />
                    <KV k="REASON" v={a.reason} mono={false} />
                    <div className="py-1">
                      <RiskBadge tier={a.risk_tier} score={a.risk_score} />
                    </div>
                    {!canApprove ? (
                      <div className="font-mono text-[10px] text-[#8FA0BF]">
                        Requires approver role. Current role cannot decide.
                      </div>
                    ) : (
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => approve.mutate(a.id)}
                          disabled={approve.isPending || deny.isPending}
                          className="flex-1 rounded bg-[#22C55E] hover:brightness-110 disabled:opacity-50 text-black font-mono text-[11px] font-bold px-2 py-1.5"
                        >
                          APPROVE
                        </button>
                        <button
                          onClick={() => deny.mutate(a.id)}
                          disabled={approve.isPending || deny.isPending}
                          className="flex-1 rounded bg-[#EF4444] hover:brightness-110 disabled:opacity-50 text-white font-mono text-[11px] font-bold px-2 py-1.5"
                        >
                          DENY
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>

      {/* Bottom: attack paths + verification */}
      <div className="shrink-0 border-t border-[#22304D] bg-[#111A2E] px-3 py-2 flex gap-4 items-start overflow-x-auto">
        <div className="min-w-[280px]">
          <div className="font-mono text-[10px] tracking-[0.14em] text-[#8FA0BF] font-semibold mb-1">
            CURRENT ATTACK PATHS
          </div>
          {paths.isPending ? (
            <span className="font-mono text-[11px] text-[#8FA0BF]">loading…</span>
          ) : paths.isError ? (
            <span className="font-mono text-[11px] text-[#EF4444]">{errMsg(paths.error)}</span>
          ) : (paths.data?.paths || []).length === 0 ? (
            <span className="font-mono text-[12px] font-bold text-[#22C55E]">
              ZERO ACTIVE PATHS — CONTAINMENT HOLDS
            </span>
          ) : (
            <div className="flex flex-col gap-1">
              {(paths.data?.paths || []).map((p, i) => (
                <span key={i} className="font-mono text-[11px] text-[#EF4444]">
                  ACTIVE ▸ {p.nodes.join(' → ')}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="min-w-[280px]">
          <div className="font-mono text-[10px] tracking-[0.14em] text-[#8FA0BF] font-semibold mb-1">
            GROUND-TRUTH VERIFICATION
          </div>
          {verifications.length === 0 ? (
            <span className="font-mono text-[11px] text-[#8FA0BF]">no verification recorded</span>
          ) : (
            <div className="flex flex-col gap-1">
              {verifications.slice(-3).map((v, i) => {
                const contained = !!(v.payload as Record<string, unknown>)?.contained;
                const remaining = (v.payload as Record<string, unknown>)
                  ?.remaining_paths as unknown;
                return (
                  <span
                    key={i}
                    className={`font-mono text-[11px] ${contained ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}
                  >
                    {contained
                      ? 'VERIFIED: zero reachable paths — CONTAINED'
                      : `NOT CONTAINED — remaining: ${fmtPayload(remaining).slice(0, 120)} → REPLAN`}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div className="min-w-[280px]">
          <div className="font-mono text-[10px] tracking-[0.14em] text-[#8FA0BF] font-semibold mb-1">
            ADVERSARY (REACTIVE)
          </div>
          {adversaryMoves.length === 0 ? (
            <span className="font-mono text-[11px] text-[#8FA0BF]">no adversary moves recorded</span>
          ) : (
            <div className="flex flex-col gap-1">
              {adversaryMoves.slice(-3).map((a, i) => (
                <span key={i} className="font-mono text-[11px] text-[#A78BFA]">
                  {(a.payload as Record<string, unknown>)?.mitre as string} ▸{' '}
                  {fmtPayload((a.payload as Record<string, unknown>)?.detail).slice(0, 120)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineRow({
  actor,
  event,
  payload,
}: {
  actor: string;
  event: string;
  payload: Record<string, unknown>;
}) {
  const color =
    event === 'incident.replanned' || event === 'graph.diff'
      ? 'text-[#A78BFA]'
      : event === 'verification.completed'
        ? 'text-[#22C55E]'
        : event === 'adversary.action'
          ? 'text-[#F59E0B]'
          : event === 'action.executed'
            ? 'text-[#3B82F6]'
            : event === 'injection.flagged'
              ? 'text-[#EF4444]'
              : 'text-[#8FA0BF]';
  return (
    <div className="rounded px-2 py-1.5 bg-[#0B1220] border border-[#22304D]/70">
      <div className="flex items-center gap-2">
        <span className={`font-mono text-[10px] font-bold tracking-wider ${color}`}>{event}</span>
        <span className="font-mono text-[10px] text-[#8FA0BF] ml-auto">{actor}</span>
      </div>
      <div className="font-mono text-[10px] text-[#8FA0BF] mt-0.5 break-words">
        {fmtPayload(payload).slice(0, 300)}
      </div>
    </div>
  );
}

function UndoButton({
  actionId,
  onUndo,
  busy,
}: {
  actionId: string;
  onUndo: () => void;
  busy: boolean;
}) {
  return (
    <button
      onClick={onUndo}
      disabled={busy}
      title={actionId}
      className="mt-2 w-full font-mono text-[11px] px-2 py-1.5 rounded bg-[#16223B] border border-[#22304D] hover:bg-[#1f3054] disabled:opacity-50"
    >
      {busy ? 'UNDOING…' : 'UNDO THIS ACTION'}
    </button>
  );
}
