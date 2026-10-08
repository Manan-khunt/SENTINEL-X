import React, { useState } from 'react';
import { Shield, Radio, ShieldOff, AlertOctagon, UserCheck, ChevronDown, Check, Activity } from 'lucide-react';
import { useIncidentStore } from '../../stores/incidentStore';
import { useAuthStore } from '../../stores/authStore';
import { KillSwitchModal } from '../common/KillSwitchModal';
import { SCENARIOS } from '../../demo/scenarios';
import { IS_DEMO_MODE } from '../../api/client';
import type { Role, OperatingMode } from '../../types';

export const TopBar: React.FC = () => {
  const { 
    incidentId, 
    activeScenarioId, 
    status, 
    mode, 
    setMode, 
    replansCount, 
    currentStepIndex, 
    isHalted 
  } = useIncidentStore();

  const { user, setRole } = useAuthStore();
  const [isKillModalOpen, setIsKillModalOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);

  const scenario = SCENARIOS[activeScenarioId];

  const handleModeToggle = () => {
    const nextMode: OperatingMode = mode === 'ENFORCE' ? 'SHADOW' : 'ENFORCE';
    setMode(nextMode);
  };

  const roles: Role[] = ['analyst', 'approver', 'admin', 'viewer'];

  return (
    <>
      {/* Persistent DEMO DATA banner when demo mode is active */}
      {IS_DEMO_MODE && (
        <div className="w-full bg-[#F59E0B] text-black px-4 py-1 flex items-center justify-between text-xs font-mono font-bold tracking-wider shrink-0 z-40">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 shrink-0" />
            <span>DEMO DATA MODE ACTIVE — ALL DATA IS SYNTHETIC / NOT CONNECTED TO LIVE BACKEND</span>
          </div>
          <button
            onClick={() => {}}
            className="px-2 py-0.5 bg-black/20 rounded text-black text-[11px] uppercase"
          >
            Set VITE_DEMO_MODE=false in .env to connect to real backend
          </button>
        </div>
      )}

      <header className="h-14 bg-[#111A2E] border-b border-[#22304D] px-4 flex items-center justify-between shrink-0 select-none z-30">
        {/* Left: Brand & Hackathon info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-[#0E3B45] border border-[#0E7C86] flex items-center justify-center text-[#12929E]">
              <Shield className="w-4 h-4 text-[#12929E]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm tracking-wider text-[#E6EDF7]">
                  SENTINEL-X
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#0E7C86]/20 text-[#12929E] border border-[#0E7C86]/40 rounded">
                  v3.0
                </span>
              </div>
              <p className="text-[10px] text-[#8FA0BF] tracking-tight uppercase font-mono">
                Autonomous Incident Response
              </p>
            </div>
          </div>

          <div className="hidden xl:flex items-center gap-2 pl-3 ml-3 border-l border-[#22304D] text-[11px] text-[#8FA0BF]">
            <span className="px-1.5 py-0.5 rounded bg-[#16223B] border border-[#22304D] text-[#8FA0BF] font-mono">
              InnoHacks 4.0
            </span>
            <span className="text-[#8FA0BF]/60 font-mono">Team 404 Founder</span>
          </div>
        </div>

        {/* Center: Active Incident Telemetry */}
        <div className="hidden md:flex items-center gap-3 bg-[#0B1220] px-3.5 py-1.5 rounded border border-[#22304D]">
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-[#8FA0BF]">INCIDENT:</span>
            <span className="font-bold text-[#E6EDF7] bg-[#16223B] px-1.5 py-0.5 rounded border border-[#22304D]">
              {incidentId}
            </span>
          </div>

          <span className="text-[#22304D]">|</span>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[#8FA0BF] font-mono">SCENARIO:</span>
            <span className="text-[#E6EDF7] font-medium max-w-[180px] truncate" title={scenario?.title}>
              {scenario?.title}
            </span>
          </div>

          <span className="text-[#22304D]">|</span>

          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-[#8FA0BF]">STATUS:</span>
            <span
              className={`font-semibold px-1.5 py-0.5 rounded text-[11px] ${
                isHalted
                  ? 'bg-[#EF4444]/20 text-[#EF4444]'
                  : status === 'CONTAINED'
                  ? 'bg-[#22C55E]/20 text-[#22C55E]'
                  : 'bg-[#F59E0B]/20 text-[#F59E0B]'
              }`}
            >
              {isHalted ? 'HALTED' : status}
            </span>
          </div>

          <span className="text-[#22304D]">|</span>

          <div className="flex items-center gap-2 font-mono text-[11px] text-[#8FA0BF]">
            <span>
              REPLANS: <strong className="text-[#A78BFA]">{replansCount}</strong>
            </span>
            <span>
              STEP: <strong className="text-[#E6EDF7]">{currentStepIndex + 1}</strong>
            </span>
          </div>
        </div>

        {/* Right: Status, User Role, Mode, Kill Switch */}
        <div className="flex items-center gap-2.5">
          {/* System Connection state */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#16223B] border border-[#22304D] text-xs font-mono">
            <Radio className="w-3.5 h-3.5 text-[#22C55E] animate-pulse" />
            <span className="text-[#22C55E] font-medium tracking-wide">SYSTEM ONLINE</span>
          </div>

          {/* Role selector dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#16223B] hover:bg-[#1c2c4d] border border-[#22304D] text-xs font-mono text-[#E6EDF7] transition-colors"
              title="Change active security role"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#0E7C86]" />
              <span className="uppercase font-semibold">{user?.role || 'ANALYST'}</span>
              <ChevronDown className="w-3 h-3 text-[#8FA0BF]" />
            </button>

            {isRoleDropdownOpen && (
              <div className="absolute right-0 mt-1 w-36 bg-[#111A2E] border border-[#22304D] rounded shadow-xl py-1 z-50 text-xs font-mono">
                <div className="px-2.5 py-1 text-[10px] text-[#8FA0BF] border-b border-[#22304D]">
                  SWITCH ROLE
                </div>
                {roles.map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setRole(r);
                      setIsRoleDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-left hover:bg-[#16223B] ${
                      user?.role === r ? 'text-[#0E7C86] font-bold' : 'text-[#E6EDF7]'
                    }`}
                  >
                    <span className="uppercase">{r}</span>
                    {user?.role === r && <Check className="w-3 h-3" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mode Switch (ENFORCE / SHADOW) */}
          <button
            onClick={handleModeToggle}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-xs font-semibold border transition-all ${
              mode === 'ENFORCE'
                ? 'bg-[#0E7C86]/20 text-[#12929E] border-[#0E7C86]/50 hover:bg-[#0E7C86]/30'
                : 'bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/50 hover:bg-[#F59E0B]/30'
            }`}
            title={mode === 'ENFORCE' ? 'Enforce mode: Actions execute via Tool Gateway' : 'Shadow mode: Recommend only, no tool dispatches'}
          >
            {mode === 'ENFORCE' ? <Shield className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
            <span>{mode}</span>
          </button>

          {/* Emergency Kill Switch Button */}
          <button
            onClick={() => setIsKillModalOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded font-mono text-xs font-bold border transition-all ${
              isHalted
                ? 'bg-[#EF4444] text-white border-red-500 animate-pulse shadow-lg shadow-red-900/50'
                : 'bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/50 hover:bg-[#EF4444] hover:text-white'
            }`}
            title="Emergency halt all agent activity"
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>{isHalted ? 'SYSTEM HALTED' : 'KILL SWITCH'}</span>
          </button>
        </div>
      </header>

      {/* Kill Switch Modal */}
      <KillSwitchModal
        isOpen={isKillModalOpen}
        onClose={() => setIsKillModalOpen(false)}
      />
    </>
  );
};
