import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, AlertTriangle, LayoutDashboard, ListChecks, LogOut, Shield, Siren } from 'lucide-react';
import { queryClient } from './lib/queryClient';
import { AuthProvider, useAuth } from './auth';
import { ToastProvider, useToasts } from './components/Toasts';
import { api } from './api';
import { LoginPage } from './pages/Login';
import { TacticalDashboard, IncidentsPage, IncidentDetailPage, EvaluationPage, AuditSystemPage } from './pages/TacticalConsole';
import { roleAtLeast } from './types';
import { errMsg } from './components/ui';

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/incidents', label: 'Incidents', icon: ListChecks },
  { to: '/evaluation', label: 'Evaluation', icon: Activity },
  { to: '/audit-system', label: 'Audit & System', icon: Shield },
];

function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToasts();
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, retry: false, refetchInterval: 10000 });
  const incidents = useQuery({ queryKey: ['incidents'], queryFn: api.listIncidents, refetchInterval: 10000 });
  const mode = useQuery({ queryKey: ['sys-mode'], queryFn: api.systemMode, retry: false });
  const status = useQuery({ queryKey: ['sys-status'], queryFn: api.systemStatus, retry: false });
  const kill = useMutation({
    mutationFn: api.killSwitch,
    onSuccess: (result) => { queryClient.invalidateQueries(); toast.push('error', `Kill switch engaged: ${result.status}`); },
    onError: (error) => toast.push('error', 'Kill switch failed', errMsg(error)),
  });

  if (!user) return <Navigate to="/login" replace />;
  const connected = health.isSuccess && health.data.api === 'ok';
  const activeCount = incidents.data?.filter((i) => ['RUNNING', 'AWAITING_APPROVAL', 'ESCALATED'].includes(i.status)).length;

  return (
    <div className="tactical-app">
      <header className="topbar">
        <Link to="/dashboard" className="brand"><span className="brand-mark"><Siren size={17} /></span><span>SENTINEL<span className="brand-accent">-X</span><small>TACTICAL CONSOLE</small></span></Link>
        <div className="top-status"><span className={`signal ${connected ? 'signal-good' : 'signal-bad'}`} />{connected ? 'BACKEND CONNECTED' : 'BACKEND DISCONNECTED'}</div>
        <div className="top-status"><span className="status-label">ACTIVE</span><strong>{activeCount ?? '—'}</strong></div>
        {incidents.data?.[0] && <div className="top-status"><span className="status-label">LATEST</span><strong>{incidents.data[0].status}</strong></div>}
        <div className="top-status"><span className="status-label">MODE</span><strong>{mode.data?.mode ?? '—'}</strong></div>
        <div className="top-spacer" />
        {roleAtLeast(user.role, 'approver') && status.data?.status !== 'HALTED' && (
          <button className="button button-danger button-compact" disabled={kill.isPending} onClick={() => { if (window.confirm('Halt all agent execution?')) kill.mutate(); }}><AlertTriangle size={14} /> KILL SWITCH</button>
        )}
        {status.data?.status === 'HALTED' && <span className="pill pill-danger">SYSTEM HALTED</span>}
        <span className="user-tag">{user.username}<small>{user.role}</small></span>
        <button className="icon-button" title="Sign out" onClick={() => { logout(); navigate('/login'); }}><LogOut size={16} /></button>
      </header>
      <div className="app-body">
        <aside className="sidebar" aria-label="Primary navigation">
          <div className="sidebar-caption">OPERATIONS</div>
          {nav.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to || (to === '/incidents' && location.pathname.startsWith('/incidents/'));
            return <Link className={`nav-link ${active ? 'nav-active' : ''}`} key={to} to={to}><Icon size={17} /><span>{label}</span>{active && <span className="nav-marker" />}</Link>;
          })}
          <div className="sidebar-footer"><span className="signal signal-good" /> SYNTHETIC ENVIRONMENT<br /><span className="mono muted">v{health.data?.version ?? '—'}</span></div>
        </aside>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<TacticalDashboard />} />
            <Route path="/incidents" element={<IncidentsPage />} />
            <Route path="/incidents/:id" element={<IncidentDetailPage />} />
            <Route path="/evaluation" element={<EvaluationPage />} />
            <Route path="/audit-system" element={<AuditSystemPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function LoginRoute() {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return <LoginPage />;
}

export default function App() {
  return <QueryClientProvider client={queryClient}><AuthProvider><ToastProvider><BrowserRouter><Routes><Route path="/login" element={<LoginRoute />} /><Route path="/*" element={<AppShell />} /></Routes></BrowserRouter></ToastProvider></AuthProvider></QueryClientProvider>;
}
