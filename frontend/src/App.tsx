// SENTINEL-X SOC console shell: top bar, nav, kill switch, routing.
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider, useAuth } from './auth';
import { ToastProvider, useToasts } from './components/Toasts';
import { api } from './api';
import { LoginPage } from './pages/Login';
import { IncidentsPage } from './pages/Incidents';
import { ConsolePage } from './pages/Console';
import { EvaluationPage } from './pages/Evaluation';
import { ReplayPage } from './pages/Replay';
import { AuditPage } from './pages/Audit';
import { SystemPage } from './pages/System';
import { roleAtLeast } from './types';
import { errMsg } from './components/ui';

function TopBar() {
  const { user, logout } = useAuth();
  const toast = useToasts();
  const nav = useNavigate();
  const qc = useQueryClient();
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, retry: false });
  const status = useQuery({ queryKey: ['sys-status'], queryFn: api.systemStatus, retry: false });
  const mode = useQuery({ queryKey: ['sys-mode'], queryFn: api.systemMode, retry: false });
  const connected = health.isSuccess && health.data.api === 'ok';

  const kill = useMutation({
    mutationFn: api.killSwitch,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['sys-status'] });
      toast.push('error', `Kill switch engaged — ${r.status}`);
    },
    onError: (e) => toast.push('error', 'Kill switch failed', errMsg(e)),
  });

  return (
    <header className="flex items-center gap-4 px-3 h-12 border-b border-border bg-surface shrink-0">
      <Link to="/incidents" className="font-mono font-bold tracking-wider text-sm">
        SENTINEL<span className="text-primary">-X</span>
      </Link>
      <span className="hidden lg:inline text-[10px] text-muted">
        Autonomous Adaptive Cyberattack Response Agent
      </span>
      <span className="hidden md:inline font-mono text-[10px] px-1.5 py-0.5 rounded border border-border text-muted">
        ENV: SYNTHETIC ENTERPRISE
      </span>
      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-border text-muted">
        MODE: <span className="text-text">{mode.data?.mode || '…'}</span>
      </span>
      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-border">
        <span className={connected ? 'text-success' : 'text-danger'}>
          {connected ? '● CONNECTED' : '● DISCONNECTED'}
        </span>
      </span>
      {status.data && (
        <span className="font-mono text-[10px] text-muted">
          SYS: <span className="text-text">{status.data.status}</span>
        </span>
      )}
      <span className="flex-1" />
      {roleAtLeast(user?.role, 'approver') && (
        <button
          onClick={() => kill.mutate()}
          disabled={kill.isPending}
          title="Halt all agent activity"
          className="font-mono text-[10px] font-bold px-2 py-1 rounded bg-danger/15 border border-danger/60 text-danger hover:bg-danger/25 disabled:opacity-50"
        >
          ⏻ KILL
        </button>
      )}
      <span className="font-mono text-[11px] text-text">
        {user?.username} <span className="text-muted">({user?.role})</span>
      </span>
      <button
        onClick={() => {
          logout();
          nav('/login');
        }}
        className="font-mono text-[10px] px-2 py-1 rounded bg-surface-2 border border-border hover:brightness-125"
      >
        LOGOUT
      </button>
    </header>
  );
}

function Nav() {
  const loc = useLocation();
  const items: [string, string][] = [
    ['/incidents', 'INCIDENTS'],
    ['/dashboard', 'DASHBOARD'],
    ['/evaluation', 'EVALUATION'],
    ['/replay', 'REPLAY'],
    ['/audit', 'AUDIT'],
    ['/system', 'SYSTEM'],
  ];
  return (
    <nav className="flex items-center gap-1 px-3 h-9 border-b border-border bg-bg shrink-0">
      {items.map(([to, label]) => {
        const active = loc.pathname === to || loc.pathname.startsWith(to + '/');
        return (
          <Link
            key={to}
            to={to}
            className={`font-mono text-[11px] tracking-wider px-2.5 py-1 rounded ${
              active ? 'bg-surface-2 text-text' : 'text-muted hover:text-text'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

// Dashboard = console for the most recent incident.
function DashboardRedirect() {
  const { user } = useAuth();
  const latest = useQuery({ queryKey: ['incidents'], queryFn: api.listIncidents });
  if (!user) return <Navigate to="/login" replace />;
  if (latest.isPending) return <div className="p-6 font-mono text-xs text-muted">Loading…</div>;
  if (latest.isError || !latest.data || latest.data.length === 0)
    return <Navigate to="/incidents" replace />;
  return <Navigate to={`/incidents/${latest.data[0].id}`} replace />;
}

function Shell() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="h-screen w-screen flex flex-col bg-bg text-text overflow-hidden">
      <TopBar />
      <Nav />
      <main className="flex-1 min-h-0">
        <Routes>
          <Route path="/incidents" element={<IncidentsPage />} />
          <Route path="/incidents/:id" element={<ConsolePage />} />
          <Route path="/dashboard" element={<DashboardRedirect />} />
          <Route path="/evaluation" element={<EvaluationPage />} />
          <Route path="/replay" element={<ReplayPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/system" element={<SystemPage />} />
          <Route path="*" element={<Navigate to="/incidents" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function LoginRoute() {
  const { user } = useAuth();
  if (user) return <Navigate to="/incidents" replace />;
  return <LoginPage />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginRoute />} />
              <Route path="/*" element={<Shell />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
