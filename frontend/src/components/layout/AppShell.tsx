import React from 'react';
import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { useIncidentStore } from '../../stores/incidentStore';
import { AlertTriangle } from 'lucide-react';

export const AppShell: React.FC = () => {
  const { isHalted, resumeSystem } = useIncidentStore();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0B1220] text-[#E6EDF7]">
      {/* Top Bar */}
      <TopBar />

      {/* Persistent System Halted Warning Banner if Kill Switch activated */}
      {isHalted && (
        <div className="bg-[#EF4444] text-white px-4 py-1.5 flex items-center justify-between text-xs font-mono font-bold tracking-wider shrink-0 z-40 animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>CRITICAL ALERT: AGENT KILL SWITCH ENGAGED — ALL TOOL DISPATCHES SUSPENDED</span>
          </div>
          <button
            onClick={resumeSystem}
            className="px-2.5 py-0.5 bg-black/40 hover:bg-black/60 rounded text-white text-[11px] underline uppercase"
          >
            Resume Operations
          </button>
        </div>
      )}

      {/* Content Area with Sidebar and Main Page */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden flex flex-col relative bg-[#0B1220]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
