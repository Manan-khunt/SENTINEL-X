// SENTINEL-X SOC console shell: top bar, nav, kill switch, routing.
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider, useAuth } from './auth';
import { api } from './api';
import { LoginPage } from './pages/Login';
import { IncidentsPage } from './pages/Incidents';
import { ConsolePage } from './pages/Console';
import { EvaluationPage } from './pages/Evaluation';
import { ReplayPage } from './pages/Replay';
import { AuditPage } from './pages/Audit';
import { SystemPage } from './pages/System';
import { roleAtLeast } from './types';

function TopBar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, retry: false });
  const status = useQuery({ queryKey: ['sys-status'], queryFn: api.systemStatus, retry: false });
  const mode = useQuery({ queryKey: ['sys-mode'], queryFn: api.systemMode, retry: false });
  const connected = health.isSuccess && health.data.api === 'ok';

  const kill = useMutation({
    mutationFn: api.killSwitch,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sys-status'] }),
  });

  return (
    <header className="flex items-center gap-4 px-3 h-12 border-b border-[#22304D] bg-[#111A2E] shrink-0">
      <Link to="/incidents" className="font-mono font-bold tracking-wider text-sm">
        SENTINEL<span className="text-[#0E7C86]">-X</span>
      </Link>
      <span className="hidden lg:inline text-[10px] text-[#8FA0BF]">
        Autonomous Adaptive Cyberattack Response Agent
      </span>
      <span className="hidden md:inline font-mono text-[10px] px-1.5 py-0.5 rounded border border-[#22304D] text-[#8FA0BF]">
        ENV: SYNTHETIC ENTERPRISE
      </span>
      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-[#22304D] text-[#8FA0BF]">
        MODE: <span className="text-[#E6EDF7]">{mode.data?.mode || '…'}</span>
      </span>
      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-[#22304D]">
        <span className={connected ? 'text-[#22C55E]' : 'text-[#EF4444]'}>
          {connected ? '● CONNECTED' : '● DISCONNECTED'}
        </span>
      </span>
      {status.data && (
        <span className="font-mono text-[10px] text-[#8FA0BF]">
          SYS: <span className="text-[#E6EDF7]">{status.data.status}</span>
        </span>
      )}
      <span className="flex-1" />
      {roleAtLeast(user?.role, 'approver') && (
        <button
          onClick={() => kill.mutate()}
          disabled={kill.isPending}
          title="Halt all agent activity"
          className="font-mono text-[10px] font-bold px-2 py-1 rounded bg-[#EF4444]/15 border border-[#EF4444]/60 text-[#EF4444] hover:bg-[#EF4444]/25 disabled:opacity-50"
        >
          ⏻ KILL
        </button>
      )}
      <span className="font-mono text-[11px] text-[#E6EDF7]">
        {user?.username} <span className="text-[#8FA0BF]">({user?.role})</span>
      </span>
      <button
        onClick={() => {
          logout();
          nav('/login');
        }}
        className="font-mono text-[10px] px-2 py-1 rounded bg-[#16223B] border border-[#22304D] hover:bg-[#1f3054]"
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
    <nav className="flex items-center gap-1 px-3 h-9 border-b border-[#22304D] bg-[#0B1220] shrink-0">
      {items.map(([to, label]) => {
        const active = loc.pathname === to || loc.pathname.startsWith(to + '/');
        return (
          <Link
            key={to}
            to={to}
            className={`font-mono text-[11px] tracking-wider px-2.5 py-1 rounded ${
              active ? 'bg-[#16223B] text-[#E6EDF7]' : 'text-[#8FA0BF] hover:text-[#E6EDF7]'
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
  if (latest.isPending) return <div className="p-6 font-mono text-xs text-[#8FA0BF]">Loading…</div>;
  if (latest.isError || !latest.data || latest.data.length === 0)
    return <Navigate to="/incidents" replace />;
  return <Navigate to={`/incidents/${latest.data[0].id}`} replace />;
}

function Shell() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="h-screen w-screen flex flex-col bg-[#0B1220] text-[#E6EDF7] overflow-hidden">
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
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/*" element={<Shell />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
