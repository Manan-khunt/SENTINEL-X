import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  AlertTriangle, 
  BarChart3, 
  RotateCcw, 
  FileText, 
  Server,
  LogOut
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useIncidentStore } from '../../stores/incidentStore';

export const Sidebar: React.FC = () => {
  const { logout, user } = useAuthStore();
  const { mode } = useIncidentStore();

  const navItems = [
    { to: '/dashboard', label: 'Console', icon: LayoutDashboard },
    { to: '/incidents', label: 'Incidents', icon: AlertTriangle },
    { to: '/evaluation', label: 'Evaluation', icon: BarChart3 },
    { to: '/replay', label: 'Replay', icon: RotateCcw },
    { to: '/audit', label: 'Audit Trail', icon: FileText },
    { to: '/system', label: 'System Health', icon: Server },
  ];

  return (
    <aside className="w-52 bg-[#0B1220] border-r border-[#22304D] flex flex-col justify-between shrink-0 select-none">
      {/* Top nav */}
      <div className="p-3 space-y-4">
        {/* Navigation list */}
        <div className="space-y-1">
          <div className="px-3 py-1 text-[10px] font-mono uppercase text-[#8FA0BF] tracking-wider font-semibold">
            Operations
          </div>
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded text-xs font-mono transition-colors ${
                      isActive
                        ? 'bg-[#16223B] text-[#E6EDF7] font-semibold border-l-2 border-[#0E7C86]'
                        : 'text-[#8FA0BF] hover:text-[#E6EDF7] hover:bg-[#111A2E]'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Operating Mode Indicator Card */}
        <div className="p-2.5 rounded bg-[#111A2E] border border-[#22304D] space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-[#8FA0BF]">GATEWAY</span>
            <span className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
              mode === 'ENFORCE' ? 'bg-[#0E7C86]/20 text-[#12929E]' : 'bg-[#F59E0B]/20 text-[#F59E0B]'
            }`}>
              {mode}
            </span>
          </div>
          <p className="text-[10px] text-[#8FA0BF] leading-tight">
            {mode === 'ENFORCE' 
              ? 'Autonomous containment active through Tool Gateway.'
              : 'Observation only. No production tools dispatched.'}
          </p>
        </div>
      </div>

      {/* Bottom User session info */}
      <div className="p-3 border-t border-[#22304D] bg-[#111A2E]/50 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded bg-[#16223B] border border-[#22304D] flex items-center justify-center text-xs font-mono font-bold text-[#E6EDF7]">
              {user?.username?.substring(0, 2).toUpperCase() || 'AN'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-mono font-medium text-[#E6EDF7] truncate">
                {user?.username || 'analyst'}
              </p>
              <p className="text-[10px] font-mono uppercase text-[#0E7C86] font-semibold">
                {user?.role || 'analyst'}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-[#8FA0BF] hover:text-[#EF4444] hover:bg-[#16223B] rounded transition-colors"
            title="Sign out of console"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="text-[9px] text-[#8FA0BF]/60 font-mono text-center pt-1 border-t border-[#22304D]/60">
          InnoHacks 4.0 // Synthetic Env
        </div>
      </div>
    </aside>
  );
};
