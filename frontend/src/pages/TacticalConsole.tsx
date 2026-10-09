import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowRight, Check, ChevronRight, CircleAlert, GitBranch, Play, RefreshCw, ShieldCheck, ShieldQuestion, ShieldX, Siren } from 'lucide-react';
import { api, connectIncidentStream } from '../api';
import { useAuth } from '../auth';
import { AttackGraph } from '../components/Graph';
import { roleAtLeast } from '../types';
import type { ActionItem, AuditRecord, GraphDiffPayload, Incident, PathEntry, Scenario } from '../types';

const activeStatuses = ['RUNNING', 'AWAITING_APPROVAL', 'ESCALATED'];
const pretty = (value: string) => value.replaceAll('_', ' ').replaceAll('.', ' · ').toLowerCase().replace(/(^|\s)\S/g, (s) => s.toUpperCase());

function useRefreshIncident(id: string, enabled = true) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!id || !enabled) return;
    let closed = false;
    let sourceClose: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retries = 0;
    const seen = new Set<string>();
    const invalidate = () => {
      for (const key of ['incident', 'graph', 'paths', 'timeline', 'actions', 'incidents']) qc.invalidateQueries({ queryKey: [key, ...(key === 'incidents' ? [] : [id])] });
    };
    const connect = async () => {
      if (closed) return;
      try {
        const { ticket } = await api.streamTicket();
        if (closed) return;
        sourceClose = connectIncidentStream(id, ticket, (event, eventId) => {
          if (closed) return;
          if (eventId) { const key = `${event.type}:${eventId}`; if (seen.has(key)) return; seen.add(key); }
          retries = 0;
          if (['agent.step', 'graph.updated', 'graph.diff', 'action.executed', 'action.approved', 'action.denied', 'verification.completed', 'incident.replanned', 'incident.contained', 'incident.failed', 'incident.halted', 'adversary.action'].includes(event.type)) invalidate();
        }, () => {
          if (closed) return;
          sourceClose?.(); sourceClose = null;
          retries += 1;
          if (retries > 8) return;
          timer = setTimeout(() => { invalidate(); void connect(); }, Math.min(1000 * 2 ** (retries - 1), 15000));
        });
        invalidate();
      } catch {
        retries += 1;
        if (!closed && retries <= 8) timer = setTimeout(() => void connect(), Math.min(1000 * 2 ** (retries - 1), 15000));
      }
    };
    void connect();
    return () => { closed = true; if (timer) clearTimeout(timer); sourceClose?.(); };
  }, [id, enabled, qc]);
}

function PageHeading({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{detail}</p></div>{action && <div className="heading-action">{action}</div>}</div>;
}

function StatePill({ value }: { value: string }) {
  const key = value.toUpperCase();
  const cls = key.includes('CONTAIN') || key === 'SAFE' || key === 'SUCCESS' || key === 'INTACT' || key === 'VERIFIED' ? 'pill-good' : key.includes('PENDING') || key.includes('AWAIT') || key === 'ACTIVE' || key === 'RUNNING' ? 'pill-warn' : key.includes('FAIL') || key.includes('HALT') || key === 'BLOCKED' || key.includes('BROKEN') || key === 'HIGH' ? 'pill-danger' : 'pill-neutral';
  const Icon = cls === 'pill-good' ? Check : cls === 'pill-danger' ? ShieldX : cls === 'pill-warn' ? ShieldQuestion : Activity;
  return <span className={`pill ${cls}`}><Icon size={12} />{value.replaceAll('_', ' ')}</span>;
}

function Metric({ label, value, icon: Icon, tone = '' }: { label: string; value: React.ReactNode; icon: typeof Activity; tone?: string }) {
  return <div className="metric"><div className={`metric-icon ${tone}`}><Icon size={17} /></div><div><span>{label}</span><strong>{value}</strong></div></div>;
}

function CreateIncident({ scenarios, onCreated }: { scenarios?: Scenario[]; onCreated: (incident: Incident) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [scenario, setScenario] = useState('scenario_1');
  const [seed, setSeed] = useState(42);
  const [mode, setMode] = useState<'ENFORCE' | 'SHADOW'>('ENFORCE');
  const [error, setError] = useState('');
  const start = useMutation({ mutationFn: () => api.createIncident({ scenario_id: scenario, seed, mode, configuration: 'B3' }), onSuccess: (inc) => { qc.invalidateQueries({ queryKey: ['incidents'] }); onCreated(inc); }, onError: (e) => setError(e instanceof Error ? e.message : 'Unable to start incident') });
  const canStart = roleAtLeast(user?.role, 'analyst');
  return <div className="create-strip">
    <div className="create-copy"><span className="eyebrow">DEMO FLOW</span><strong>Start a synthetic incident</strong><small>Incident creation runs the backend agent loop. No client-side scenario steps are simulated.</small></div>
    <label className="field"><span>SCENARIO</span><select value={scenario} onChange={(e) => setScenario(e.target.value)} disabled={!canStart || !scenarios?.length}>{(scenarios ?? []).map((s) => <option key={s.id} value={s.id}>{s.id} · {s.name}</option>)}</select></label>
    <label className="field field-seed"><span>SEED</span><input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} disabled={!canStart} /></label>
    <label className="field"><span>MODE</span><select value={mode} onChange={(e) => setMode(e.target.value as 'ENFORCE' | 'SHADOW')} disabled={!canStart}><option>ENFORCE</option><option>SHADOW</option></select></label>
    <button className="button button-primary" disabled={!canStart || start.isPending || !scenarios?.length} onClick={() => { setError(''); start.mutate(); }}><Play size={15} />{start.isPending ? 'STARTING…' : 'START INCIDENT'}</button>
    {!canStart && <small className="muted">Analyst role required</small>}{error && <div className="inline-error">{error}</div>}
  </div>;
}

export function TacticalDashboard() {
  const navigate = useNavigate();
  const incidents = useQuery({ queryKey: ['incidents'], queryFn: api.listIncidents, refetchInterval: 10000 });
  const scenarios = useQuery({ queryKey: ['scenarios'], queryFn: api.scenarios });
  const latest = incidents.data?.[0];
  const paths = useQuery({ queryKey: ['paths', latest?.id], queryFn: () => api.getPaths(latest!.id), enabled: !!latest });
  const graph = useQuery({ queryKey: ['graph', latest?.id], queryFn: () => api.getGraph(latest!.id), enabled: !!latest });
  const timeline = useQuery({ queryKey: ['timeline', latest?.id], queryFn: () => api.getTimeline(latest!.id), enabled: !!latest });
  const allActions = useQueries({ queries: (incidents.data ?? []).map((inc) => ({ queryKey: ['actions', inc.id], queryFn: () => api.getActions(inc.id) })) });
  useRefreshIncident(latest?.id ?? '', !!latest);
  const diff = useMemo(() => latestDiff(timeline.data?.events ?? []), [timeline.data]);
  const activeCount = incidents.data?.filter((i) => activeStatuses.includes(i.status)).length;
  const pendingCount = allActions.flatMap((q) => q.data ?? []).filter((a) => a.approval_status.toLowerCase() === 'pending').length;
  const verification = latest?.status === 'CONTAINED' ? 'VERIFIED CONTAINED' : latest?.status === 'FAILED' ? 'VERIFICATION FAILED' : latest?.status === 'HALTED' ? 'HALTED' : 'NOT VERIFIED';
  const activeNodes = useMemo(() => new Set(paths.data?.paths.filter((p) => p.state === 'ACTIVE').flatMap((p) => p.nodes) ?? []), [paths.data]);
  return <div className="page-scroll">
    <PageHeading eyebrow="LIVE OPERATIONS / SYNTHETIC ENVIRONMENT" title="Threat response at a glance" detail="Follow the incident, adaptive attack path, response actions, and ground-truth verification." action={latest ? <Link className="button button-secondary" to={`/incidents/${latest.id}`}>Open latest incident <ArrowRight size={14} /></Link> : undefined} />
    <CreateIncident scenarios={scenarios.data} onCreated={(inc) => navigate(`/incidents/${inc.id}`)} />
    <div className="metric-row">
      <Metric label="ACTIVE INCIDENTS" value={incidents.isLoading ? '—' : activeCount ?? '—'} icon={Activity} />
      <Metric label="CURRENT THREAT" value={latest ? <StatePill value={paths.data?.status ?? latest.status} /> : 'NO INCIDENT'} icon={Siren} tone="tone-red" />
      <Metric label="PENDING APPROVALS" value={allActions.every((q) => !q.isLoading) ? pendingCount : '—'} icon={ShieldQuestion} tone="tone-amber" />
      <Metric label="LATEST VERIFICATION" value={latest ? <StatePill value={verification} /> : '—'} icon={ShieldCheck} tone="tone-green" />
    </div>
    {incidents.isError && <div className="notice notice-error">Backend incident data unavailable: {String(incidents.error)}</div>}
    {latest ? <IncidentWorkspace incident={latest} compact graph={graph.data} paths={paths.data?.paths ?? []} activeNodes={activeNodes} actions={allActions[0]?.data ?? []} timeline={timeline.data?.events ?? []} diff={diff} /> : <div className="empty-state"><ShieldQuestion size={22} /><strong>No incident selected</strong><span>Create an incident to load the live graph and response timeline.</span></div>}
  </div>;
}

export function IncidentsPage() {
  const incidents = useQuery({ queryKey: ['incidents'], queryFn: api.listIncidents, refetchInterval: 10000 });
  const scenarios = useQuery({ queryKey: ['scenarios'], queryFn: api.scenarios });
  const navigate = useNavigate();
  return <div className="page-scroll"><PageHeading eyebrow="INCIDENT MANAGEMENT" title="Incidents" detail="Open an incident to review its graph, reachable paths, actions, and verification evidence." />
    <CreateIncident scenarios={scenarios.data} onCreated={(inc) => navigate(`/incidents/${inc.id}`)} />
    <section className="surface-section"><div className="section-heading"><div><h2>Recent incidents</h2><p>Current state reported by the backend.</p></div><span className="mono muted">{incidents.data?.length ?? '—'} records</span></div>
      {incidents.isPending ? <div className="empty-state">Loading incidents…</div> : incidents.isError ? <div className="notice notice-error">{String(incidents.error)}</div> : !incidents.data?.length ? <div className="empty-state">No incident records yet.</div> : <div className="table-wrap"><table><thead><tr><th>INCIDENT</th><th>SCENARIO</th><th>STATUS</th><th>THREAT PATH</th><th>VERIFICATION</th><th>SIM STEP</th><th>REPLANS</th><th></th></tr></thead><tbody>{incidents.data.map((inc) => <IncidentRow key={inc.id} incident={inc} />)}</tbody></table></div>}
    </section>
  </div>;
}

function IncidentRow({ incident }: { incident: Incident }) {
  const paths = useQuery({ queryKey: ['paths', incident.id], queryFn: () => api.getPaths(incident.id) });
  const verify = incident.status === 'CONTAINED' ? 'VERIFIED CONTAINED' : incident.status === 'FAILED' ? 'FAILED' : 'NOT VERIFIED';
  return <tr><td className="mono">{incident.id.slice(0, 12)}</td><td>{incident.scenario.replace('_', ' ')}</td><td><StatePill value={incident.status} /></td><td><StatePill value={paths.data?.status ?? 'LOADING'} /></td><td><StatePill value={verify} /></td><td>{incident.simulation_step}</td><td>{incident.replans}</td><td><Link className="row-link" to={`/incidents/${incident.id}`}>Open <ChevronRight size={14} /></Link></td></tr>;
}

export function IncidentDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const { user } = useAuth();
  const incident = useQuery({ queryKey: ['incident', id], queryFn: () => api.getIncident(id), refetchInterval: 8000 });
  const graph = useQuery({ queryKey: ['graph', id], queryFn: () => api.getGraph(id) });
  const paths = useQuery({ queryKey: ['paths', id], queryFn: () => api.getPaths(id) });
  const timeline = useQuery({ queryKey: ['timeline', id], queryFn: () => api.getTimeline(id) });
  const actions = useQuery({ queryKey: ['actions', id], queryFn: () => api.getActions(id) });
  const replay = useQuery({ queryKey: ['replay', id], queryFn: () => api.getReplay(id) });
  const audit = useQuery({ queryKey: ['audit-one', id], queryFn: () => api.auditOne(id) });
  useRefreshIncident(id);
  const activeNodes = useMemo(() => new Set(paths.data?.paths.filter((p) => p.state === 'ACTIVE').flatMap((p) => p.nodes) ?? []), [paths.data]);
  const diff = useMemo(() => latestDiff(timeline.data?.events ?? []), [timeline.data]);
  const refresh = () => { for (const key of ['incident', 'incidents', 'graph', 'paths', 'timeline', 'actions']) qc.invalidateQueries({ queryKey: [key, ...(key === 'incidents' ? [] : [id])] }); };
  const step = useMutation({ mutationFn: () => api.stepIncident(id), onSuccess: refresh });
  const approve = useMutation({ mutationFn: api.approve, onSuccess: refresh });
  const deny = useMutation({ mutationFn: ({ actionId, reason }: { actionId: string; reason: string }) => api.deny(actionId, reason), onSuccess: refresh });
  const undo = useMutation({ mutationFn: api.undo, onSuccess: refresh });
  const pending = actions.data?.filter((a) => a.approval_status.toLowerCase() === 'pending' || a.result === 'PENDING') ?? [];
  if (incident.isPending) return <div className="page-scroll"><div className="empty-state">Loading incident…</div></div>;
  if (incident.isError || !incident.data) return <div className="page-scroll"><div className="notice notice-error">Unable to load incident: {String(incident.error)}</div><Link to="/incidents" className="text-link">Return to incidents</Link></div>;
  return <div className="page-scroll">
    <PageHeading eyebrow={`INCIDENT DETAIL / ${incident.data.scenario}`} title={incident.data.id} detail={`Seed ${incident.data.seed} · ${incident.data.mode} mode · B3 full agent · Step ${incident.data.simulation_step} · ${incident.data.replans} replans`} action={<><StatePill value={incident.data.status} /><Link className="button button-secondary" to="/incidents">All incidents</Link>{roleAtLeast(user?.role, 'analyst') && incident.data.status === 'RUNNING' && <button className="button button-primary" onClick={() => step.mutate()} disabled={step.isPending}><Play size={15} />{step.isPending ? 'RUNNING CYCLE…' : 'RUN NEXT CYCLE'}</button>}</>} />
      <IncidentWorkspace incident={incident.data} graph={graph.data} paths={paths.data?.paths ?? []} activeNodes={activeNodes} actions={actions.data ?? []} timeline={timeline.data?.events ?? []} diff={diff} canUndo={roleAtLeast(user?.role, 'analyst')} onUndo={(action) => { if (window.confirm(`Undo ${action.tool} on ${action.target}?`)) undo.mutate(action.id); }} />
      <section className="surface-section evidence-section"><div className="section-heading"><div><div className="eyebrow">EVIDENCE</div><h2>Audit references & replay</h2></div><StatePill value={audit.data?.chain ?? (audit.isError ? 'UNAVAILABLE' : 'CHECKING')} /></div>{replay.isError || audit.isError ? <div className="notice notice-error">Evidence could not be loaded: {String(replay.error ?? audit.error)}</div> : <div className="evidence-list">{(replay.data?.events ?? []).slice(-5).reverse().map((event) => <div key={event.id}><span className="mono">#{event.id}</span><strong>{pretty(event.event)}</strong><span className="mono hash-cell" title={event.hash}>{event.hash.slice(0, 12)}…</span></div>)}{!replay.data?.events.length && <div className="path-empty">No replay records returned.</div>}</div>}</section>
    {pending.length > 0 && <section className="approval-section"><div className="section-heading"><div><div className="eyebrow amber-text">HUMAN DECISION REQUIRED</div><h2>Pending approvals</h2></div><span className="pill pill-warn">{pending.length} awaiting</span></div>{pending.map((action) => <ApprovalCard key={action.id} action={action} canApprove={roleAtLeast(user?.role, 'approver')} approve={() => approve.mutate(action.id)} deny={() => { const reason = window.prompt('Reason for denying this action:', ''); if (reason !== null) deny.mutate({ actionId: action.id, reason }); }} pending={approve.isPending || deny.isPending} />)}</section>}
  </div>;
}

function IncidentWorkspace({ incident, graph, paths, activeNodes, actions, timeline = [], diff = null, compact = false, onUndo, canUndo = false }: { incident: Incident; graph?: { version: number; nodes: import('../types').GraphNode[]; edges: import('../types').GraphEdge[] }; paths: PathEntry[]; activeNodes: Set<string>; actions: ActionItem[]; timeline?: { event: string; actor: string; payload: Record<string, unknown> }[]; diff?: GraphDiffPayload | null; compact?: boolean; onUndo?: (action: ActionItem) => void; canUndo?: boolean }) {
  const id = incident.id;
  return <div className={`workspace ${compact ? 'workspace-compact' : ''}`}>
    <section className="surface-section graph-section"><div className="section-heading"><div><div className="eyebrow">ATTACK SURFACE</div><h2>Live attack graph</h2></div><div className="graph-meta"><StatePill value={paths.length ? 'ACTIVE PATH' : paths.length === 0 && incident.status === 'CONTAINED' ? 'VERIFIED SAFE' : 'NO PATH DATA'} /><span className="mono muted">{graph ? `v${graph.version} · ${graph.nodes.length} nodes` : 'Loading graph…'}</span></div></div>
      {graph ? <AttackGraph key={id} snapshot={graph} activeNodes={activeNodes} diff={diff ?? null} height={compact ? '310px' : '400px'} foothold={paths[0]?.nodes[0]} /> : <div className="empty-state graph-empty">{paths.length === 0 ? 'Loading graph…' : 'Graph unavailable'}</div>}
      <div className="path-list"><div className="subheading"><GitBranch size={14} /> CURRENT REACHABLE PATHS <span>{paths.length}</span></div>{paths.length === 0 ? <div className="path-empty">{incident.status === 'CONTAINED' ? 'No reachable protected-asset paths. Backend status is contained.' : 'No reachable paths returned for this incident.'}</div> : paths.map((p, i) => <div className="path-row" key={`${i}:${p.nodes.join('>')}`}><StatePill value={p.state} /><span className="path-chain">{p.nodes.map((n, ni) => <span key={`${n}${ni}`}>{ni > 0 && <ArrowRight size={12} />}{n}</span>)}</span></div>)}</div>
    </section>
    <section className="surface-section response-section"><div className="section-heading"><div><div className="eyebrow">RESPONSE</div><h2>Agent activity</h2></div><span className="mono muted">{timeline.length} events</span></div>
      <div className="timeline-list">{timeline.length === 0 ? <div className="empty-state">No timeline events returned yet.</div> : timeline.slice(-30).reverse().map((ev, i) => { const isPivot = ev.event.includes('replan') || ev.event.includes('graph.diff') || ev.event.includes('adversary'); const label = eventSummary(ev); return <div className={`timeline-item ${isPivot ? 'timeline-pivot' : ''}`} key={`${ev.event}:${i}`}><span className="timeline-dot" /><div><strong>{label}</strong><small>{ev.actor} · {ev.event}</small></div><ChevronRight size={13} /></div>; })}</div>
      <div className="actions-heading"><span className="eyebrow">ACTIONS</span><span className="mono muted">{actions.length}</span></div>
      {actions.length > 0 && <ActionLifecycle action={actions[actions.length - 1]} events={timeline} incident={incident} />}
      <div className="action-list">{actions.length === 0 ? <div className="path-empty">No action records for this incident.</div> : actions.slice(-5).reverse().map((action) => <ActionRecord key={action.id} action={action} canUndo={canUndo} onUndo={onUndo} />)}</div>
      <div className={`verification-banner ${incident.status === 'CONTAINED' ? 'verify-good' : incident.status === 'FAILED' ? 'verify-bad' : ''}`}><div>{incident.status === 'CONTAINED' ? <ShieldCheck /> : incident.status === 'FAILED' ? <ShieldX /> : <ShieldQuestion />}</div><span><small>GROUND-TRUTH VERIFICATION</small><strong>{incident.status === 'CONTAINED' ? 'Containment verified' : incident.status === 'FAILED' ? 'Verification failed' : 'Not yet verified'}</strong><em>{incident.status === 'CONTAINED' ? 'Backend incident status confirms zero active paths.' : incident.status === 'FAILED' ? 'Backend reports the incident failed. Review its verification event.' : 'A successful action is not proof of containment.'}</em></span></div>
    </section>
  </div>;
}

function ActionLifecycle({ action, events, incident }: { action: ActionItem; events: { event: string; payload: Record<string, unknown> }[]; incident: Incident }) {
  const proof = useQuery({ queryKey: ['proof', action.incident_id, action.id], queryFn: () => api.getProof(action.incident_id, action.id) });
  const matches = (name: string) => events.some((event) => event.event === name && event.payload.action === action.id);
  const policy = events.find((event) => event.event === 'policy.checked' && event.payload.action === action.id)?.payload;
  const approval = action.approval_status.toUpperCase();
  const execution = action.result.toUpperCase();
  const stages = [
    ['PROPOSED', true], ['DRY-RUN', matches('dry_run.completed')], ['POLICY CHECK', matches('policy.checked')],
    ['APPROVAL', ['APPROVED', 'DENIED', 'BLOCKED', 'NOT_REQUIRED'].includes(approval)],
    ['EXECUTION', execution !== 'PENDING'], ['VERIFICATION', events.some((event) => event.event === 'verification.completed') || incident.status === 'CONTAINED'],
  ];
  return <section className="action-lifecycle" aria-label="Latest action lifecycle">
    <div className="lifecycle-head"><strong>LATEST ACTION LIFECYCLE</strong><StatePill value={execution === 'PENDING' && approval === 'PENDING' ? 'AWAITING APPROVAL' : execution} /></div>
    <div className="lifecycle-stages">{stages.map(([label, complete]) => <span className={complete ? 'lifecycle-done' : 'lifecycle-wait'} key={String(label)}>{String(label)}</span>)}</div>
    <div className="lifecycle-detail"><strong>{action.tool} → {action.target}</strong><span>{action.reason}</span><span>Risk {action.risk_score.toFixed(0)} / 100 · {action.risk_tier} · {action.reversible ? 'Reversible' : 'Irreversible'}{action.undo_of ? ` · Undo of ${action.undo_of}` : ''}</span>
      {proof.isError ? <span>Dry-run evidence unavailable</span> : proof.data && <span>Dry run: {proof.data.dry_run}</span>}
      {policy && <span>Policy: {String(policy.reason ?? (policy.allowed ? 'Allowed' : 'Blocked'))}</span>}
      <span>Approval: {approval} · Execution: {execution} · Verification: {incident.status === 'CONTAINED' ? 'VERIFIED CONTAINED' : matches('verification.completed') ? 'RECORDED' : 'NOT VERIFIED'}</span>
    </div>
  </section>;
}

function eventSummary(ev: { event: string; payload: Record<string, unknown> }) {
  const e = ev.event;
  if (e === 'incident.started') return 'Incident started';
  if (e === 'graph.diff' || e === 'adversary.action') return 'New attack path or attacker activity reported';
  if (e === 'incident.replanned') return 'Response plan updated';
  if (e === 'action.executed') return `Action executed${ev.payload.tool ? `: ${String(ev.payload.tool)}` : ''}`;
  if (e === 'approval.required') return 'Human approval required';
  if (e === 'verification.completed') return `Containment verification: ${String(ev.payload.contained ?? ev.payload.status ?? 'result recorded')}`;
  if (e === 'incident.contained') return 'Incident marked contained by backend';
  if (e === 'action.denied') return 'Action denied by operator';
  if (e === 'action.approved') return 'Action approved';
  return pretty(e);
}

function latestDiff(events: { event: string; payload: Record<string, unknown> }[]): GraphDiffPayload | null {
  const event = [...events].reverse().find((e) => e.event === 'graph.diff');
  const payload = event?.payload as unknown as GraphDiffPayload | undefined;
  return payload && Array.isArray(payload.new_nodes) ? payload : null;
}

function ActionRecord({ action, canUndo, onUndo }: { action: ActionItem; canUndo: boolean; onUndo?: (action: ActionItem) => void }) {
  const [open, setOpen] = useState(false);
  const proof = useQuery({ queryKey: ['proof', action.incident_id, action.id], queryFn: () => api.getProof(action.incident_id, action.id), enabled: open });
  return <div className="action-record"><div className="action-row"><div><strong>{action.tool}</strong><small>{action.target} · {action.reason}</small></div><div className="action-tags"><StatePill value={action.risk_tier} /><StatePill value={action.approval_status === 'pending' ? 'PENDING APPROVAL' : action.result} />{canUndo && action.reversible && action.result === 'SUCCESS' && !action.undone && !action.undo_of && onUndo && <button className="button button-secondary button-compact" onClick={() => onUndo(action)}>Undo</button>}</div></div><details onToggle={(e) => setOpen(e.currentTarget.open)}><summary>Action proof</summary>{proof.isPending ? <small>Loading proof…</small> : proof.isError ? <small className="proof-error">Proof unavailable: {String(proof.error)}</small> : proof.data && <div className="proof-factors"><span>{proof.data.reason}</span><span>Risk {proof.data.risk}; factors: criticality {proof.data.criticality}, blast {proof.data.blast}, irreversibility {proof.data.irreversibility}, uncertainty {proof.data.uncertainty}</span><span>Dry run: {proof.data.dry_run} · Approval: {proof.data.approval} · Result: {proof.data.result}</span><span>Audit hash: {proof.data.log_hash || '—'} · Previous: {proof.data.previous_hash || '—'}</span></div>}</details></div>;
}

function ApprovalCard({ action, canApprove, approve, deny, pending }: { action: ActionItem; canApprove: boolean; approve: () => void; deny: () => void; pending: boolean }) {
  const proof = useQuery({ queryKey: ['proof', action.incident_id, action.id], queryFn: () => api.getProof(action.incident_id, action.id) });
  return <div className="approval-card"><div><strong>{action.tool} <span className="muted">→</span> {action.target}</strong><p>{action.reason || 'No reason provided by backend.'}</p><small>Risk {action.risk_score.toFixed(0)} / 100 · {action.risk_tier} · {action.reversible ? 'Reversible' : 'Irreversible'}</small>{proof.data && <div className="proof-factors"><span>Factors: criticality {proof.data.criticality} · blast {proof.data.blast} · irreversibility {proof.data.irreversibility} · uncertainty {proof.data.uncertainty}</span><span>Dry run: {proof.data.dry_run}</span></div>}{proof.isError && <div className="proof-factors">Risk detail unavailable: {String(proof.error)}</div>}</div><div className="approval-buttons">{canApprove ? <><button className="button button-primary" disabled={pending} onClick={approve}><Check size={14} />Approve</button><button className="button button-danger" disabled={pending} onClick={deny}><ShieldX size={14} />Deny</button></> : <span className="muted">Approver role required</span>}</div></div>;
}

export function EvaluationPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const batches = useQuery({ queryKey: ['benchmarks'], queryFn: api.benchmarks });
  const run = useMutation({ mutationFn: api.runBenchmark, onSuccess: () => qc.invalidateQueries({ queryKey: ['benchmarks'] }) });
  const latest = batches.data?.[0];
  const configs = ['B0', 'B1', 'B2', 'B3'];
  const metrics = latest?.metrics as Record<string, unknown> | undefined;
  const metricNames = [...new Set(configs.flatMap((c) => isRecord(metrics?.[c]) ? Object.keys(metrics![c] as Record<string, unknown>) : []))];
  return <div className="page-scroll"><PageHeading eyebrow="MEASURED PERFORMANCE" title="Evaluation" detail="Benchmark outcomes are read from stored backend batches. Missing data remains unevaluated." action={roleAtLeast(user?.role, 'analyst') ? <button className="button button-primary" disabled={run.isPending} onClick={() => run.mutate()}><RefreshCw size={15} className={run.isPending ? 'spin' : ''} />{run.isPending ? 'RUNNING BENCHMARK…' : 'RUN BENCHMARK'}</button> : undefined} />
    {run.isError && <div className="notice notice-error">Benchmark request failed: {String(run.error)}</div>}
    <section className="surface-section"><div className="section-heading"><div><h2>{latest ? `Batch ${latest.batch_id}` : 'Benchmark results'}</h2><p>{latest ? `Latest backend batch · ${latest.status}` : 'No benchmark data has been recorded.'}</p></div>{latest && <StatePill value={latest.status} />}</div>
      {!latest ? <div className="empty-state"><Activity size={20} /><span>Not evaluated</span></div> : <div className="table-wrap"><table className="evaluation-table"><thead><tr><th>METRIC</th>{configs.map((c) => <th key={c}>{c}<small>{({ B0: 'Alert-only', B1: 'Static playbook', B2: 'No replanning', B3: 'Full SENTINEL-X' } as Record<string, string>)[c]}</small></th>)}</tr></thead><tbody>{metricNames.map((name) => <tr key={name}><th>{pretty(name)}</th>{configs.map((c) => <td key={c}>{formatMetric(metrics?.[c], name)}</td>)}</tr>)}</tbody></table>{metricNames.length === 0 && <div className="empty-state">Benchmark batch has no per-metric values.</div>}</div>}
      {latest && <div className="batch-footer">Acceptance status is shown only when included in the backend metric record. No acceptance thresholds are inferred by the UI.</div>}
    </section>
    {batches.isError && <div className="notice notice-error">Could not load benchmark records: {String(batches.error)}</div>}
  </div>;
}

function isRecord(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v); }
function formatMetric(metrics: unknown, name: string) {
  if (!isRecord(metrics) || !(name in metrics)) return <span className="muted">Not evaluated</span>;
  const value = metrics[name];
  if (isRecord(value)) { const raw = value.value ?? value.rate ?? value.mean ?? value.count ?? 'Not evaluated'; const n = value.n ?? value.count; const pass = typeof value.pass === 'boolean' ? value.pass : typeof value.passed === 'boolean' ? value.passed : undefined; return <span>{String(raw)}{n !== undefined && <small>n={String(n)}</small>}{pass !== undefined && <StatePill value={pass ? 'PASS' : 'FAIL'} />}</span>; }
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return String(value);
  return <span className="mono">{JSON.stringify(value)}</span>;
}

export function AuditSystemPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const audit = useQuery({ queryKey: ['audit'], queryFn: api.auditList });
  const verify = useQuery({ queryKey: ['audit-verify'], queryFn: () => api.auditVerify(), refetchInterval: 30000 });
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, retry: false });
  const status = useQuery({ queryKey: ['sys-status'], queryFn: api.systemStatus });
  const mode = useQuery({ queryKey: ['sys-mode'], queryFn: api.systemMode });
  const canAdmin = user?.role === 'admin';
  const canControl = roleAtLeast(user?.role, 'approver');
  const kill = useMutation({ mutationFn: api.killSwitch, onSuccess: () => qc.invalidateQueries() });
  const resume = useMutation({ mutationFn: api.resumeSystem, onSuccess: () => qc.invalidateQueries() });
  const setMode = useMutation({ mutationFn: api.setSystemMode, onSuccess: () => qc.invalidateQueries({ queryKey: ['sys-mode'] }) });
  return <div className="page-scroll"><PageHeading eyebrow="TRUST & CONTROL" title="Audit & System" detail="Inspect the append-only audit history, verify chain integrity, and view authorized system controls." />
    <section className="surface-section"><div className="section-heading"><div><h2>System status</h2><p>Current backend responses and signed-in role.</p></div><span className="role-chip">{user?.role ?? '—'}</span></div>
      <div className="system-grid"><div className="system-cell"><small>BACKEND</small><StatePill value={health.data?.api === 'ok' ? 'CONNECTED' : health.isError ? 'DISCONNECTED' : 'CHECKING'} /></div><div className="system-cell"><small>DATABASE</small><StatePill value={health.data?.database ?? 'UNKNOWN'} /></div><div className="system-cell"><small>AGENT</small><StatePill value={health.data?.agent ?? status.data?.status ?? 'UNKNOWN'} /></div><div className="system-cell"><small>MODE</small><StatePill value={mode.data?.mode ?? 'UNKNOWN'} /></div></div>
      <div className="control-row">{canAdmin && <label className="field"><span>OPERATING MODE · ADMIN</span><select value={mode.data?.mode ?? ''} disabled={setMode.isPending || !mode.data} onChange={(e) => { const next = e.target.value; if (window.confirm(`Switch to ${next}? ${next === 'ENFORCE' ? 'Agent actions may execute through the gateway.' : 'The agent will recommend actions without executing them.'}`)) setMode.mutate(next); }}><option value="SHADOW">SHADOW</option><option value="ENFORCE">ENFORCE</option></select></label>}{canControl && status.data?.status !== 'HALTED' && <button className="button button-danger" disabled={kill.isPending} onClick={() => { if (window.confirm('Halt all agent execution?')) kill.mutate(); }}><CircleAlert size={15} />Engage kill switch</button>}{canControl && status.data?.status === 'HALTED' && <button className="button button-primary" disabled={resume.isPending} onClick={() => { if (window.confirm('Resume agent execution?')) resume.mutate(); }}><Play size={15} />Resume system</button>}{!canControl && <span className="muted">Your role is read-only for system controls.</span>}</div>
      {(kill.isError || resume.isError || setMode.isError) && <div className="notice notice-error">Control request failed: {String(kill.error ?? resume.error ?? setMode.error)}</div>}
    </section>
    <section className="surface-section"><div className="section-heading"><div><h2>Audit history</h2><p>Recent records returned by the backend.</p></div><div className="audit-integrity"><span className="muted">CHAIN</span><StatePill value={verify.data?.status ?? (verify.isError ? 'UNAVAILABLE' : 'CHECKING')} /><button className="icon-button" title="Reverify" onClick={() => void verify.refetch()}><RefreshCw size={14} /></button></div></div>
      {audit.isPending ? <div className="empty-state">Loading audit records…</div> : audit.isError ? <div className="notice notice-error">Audit request failed: {String(audit.error)}</div> : <AuditTable records={audit.data ?? []} />}
    </section>
  </div>;
}

function AuditTable({ records }: { records: AuditRecord[] }) {
  const [filter, setFilter] = useState('');
  const visible = records.filter((r) => `${r.event} ${r.actor} ${r.incident_id ?? ''} ${JSON.stringify(r.payload)}`.toLowerCase().includes(filter.toLowerCase()));
  return <><div className="audit-filter"><input placeholder="Filter audit events" value={filter} onChange={(e) => setFilter(e.target.value)} /><span className="mono muted">{visible.length} / {records.length}</span></div><div className="table-wrap"><table><thead><tr><th>RECORD ID</th><th>INCIDENT</th><th>EVENT</th><th>ACTOR</th><th>TARGET / RESULT</th><th>HASH</th></tr></thead><tbody>{visible.map((r) => <tr key={r.id}><td className="mono">#{r.id}</td><td className="mono">{r.incident_id?.slice(0, 12) ?? '—'}</td><td>{pretty(r.event)}</td><td>{r.actor}</td><td>{auditPayload(r.payload)}</td><td className="mono hash-cell" title={r.hash}>{r.hash.slice(0, 10)}…</td></tr>)}</tbody></table>{visible.length === 0 && <div className="empty-state">No matching audit events.</div>}</div></>;
}
function auditPayload(payload: Record<string, unknown>) { const v = payload.target ?? payload.result ?? payload.action ?? payload.status ?? payload.tool; return v === undefined ? '—' : String(v); }
