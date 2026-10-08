import React, { useState } from 'react';
import { 
  SlidersHorizontal, 
  Radio, 
  Play,
  Pause,
  SkipForward
} from 'lucide-react';
import { useIncidentStore } from '../../stores/incidentStore';
import { SCENARIOS } from '../../demo/scenarios';
import { ScenarioSelector } from './ScenarioSelector';
import { KillSwitchModal } from '../common/KillSwitchModal';

export const DashboardHeader: React.FC = () => {
  const {
    incidentId,
    activeScenarioId,
    status,
    mode,
    replansCount,
    currentStepIndex,
    connectionState,
    isHalted,
    isPlaying,
    togglePlay,
    stepForward,
  } = useIncidentStore();

  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);
  const [isKillModalOpen, setIsKillModalOpen] = useState(false);

  const scenario = SCENARIOS[activeScenarioId];

  return (
    <>
      <div className="h-11 bg-[#111A2E] border-b border-[#22304D] px-4 flex items-center justify-between shrink-0 select-none font-mono text-xs">
        {/* Left: Incident ID & Scenario switch button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[#8FA0BF]">INCIDENT:</span>
            <span className="font-bold text-[#E6EDF7] bg-[#16223B] px-2 py-0.5 rounded border border-[#22304D]">
              {incidentId}
            </span>
          </div>

          <button
            onClick={() => setIsScenarioModalOpen(true)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#16223B] hover:bg-[#1f3054] border border-[#22304D] text-[#E6EDF7] transition-colors"
            title="Switch Cyberattack Scenario"
          >
            <span className="text-[#8FA0BF]">SCENARIO:</span>
            <span className="font-semibold text-[#12929E] uppercase">{scenario?.name}</span>
            <span className="text-[#8FA0BF] text-[10px]">({scenario?.title})</span>
            <SlidersHorizontal className="w-3 h-3 text-[#0E7C86] ml-1" />
          </button>
        </div>

        {/* Center: Status, Mode, Replans, Step */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[#8FA0BF]">STATUS:</span>
            <span
              className={`font-bold px-2 py-0.5 rounded uppercase text-[11px] ${
                isHalted
                  ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40'
                  : status === 'CONTAINED'
                  ? 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22304D]'
                  : 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#22304D]'
              }`}
            >
              {isHalted ? 'HALTED' : status}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[#8FA0BF]">MODE:</span>
            <span
              className={`px-2 py-0.5 rounded font-bold uppercase text-[11px] ${
                mode === 'ENFORCE'
                  ? 'bg-[#0E7C86]/20 text-[#12929E] border border-[#0E7C86]/40'
                  : 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40'
              }`}
            >
              {mode}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[#8FA0BF]">REPLANS:</span>
            <span className="font-bold text-[#A78BFA] bg-[#16223B] px-1.5 py-0.5 rounded border border-[#22304D]">
              {replansCount}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[#8FA0BF]">STEP:</span>
            <span className="font-bold text-[#E6EDF7] bg-[#16223B] px-1.5 py-0.5 rounded border border-[#22304D]">
              {currentStepIndex + 1}
            </span>
          </div>
        </div>

        {/* Right: Quick simulation controls & connection state */}
        <div className="flex items-center gap-2">
          {/* Simulation step triggers */}
          <div className="flex items-center gap-1 bg-[#0B1220] p-0.5 rounded border border-[#22304D]">
            <button
              onClick={togglePlay}
              className="px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 text-[#0E7C86] hover:bg-[#16223B]"
            >
              {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span>{isPlaying ? 'PAUSE' : 'STEP RUN'}</span>
            </button>
            <button
              onClick={stepForward}
              className="p-1 rounded text-[#8FA0BF] hover:text-[#E6EDF7] hover:bg-[#16223B]"
              title="Next Step"
            >
              <SkipForward className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#16223B] border border-[#22304D] text-[10px]">
            <Radio className="w-3 h-3 text-[#22C55E] animate-pulse" />
            <span className="text-[#8FA0BF] uppercase">{connectionState}</span>
          </div>
        </div>
      </div>

      <ScenarioSelector
        isOpen={isScenarioModalOpen}
        onClose={() => setIsScenarioModalOpen(false)}
      />

      <KillSwitchModal
        isOpen={isKillModalOpen}
        onClose={() => setIsKillModalOpen(false)}
      />
    </>
  );
};
