import React from 'react';
import { SCENARIO_LIST } from '../../demo/scenarios';
import { useIncidentStore } from '../../stores/incidentStore';
import type { ScenarioId } from '../../types';
import { Check, Sparkles } from 'lucide-react';

interface ScenarioSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({ isOpen, onClose }) => {
  const { activeScenarioId, setScenario } = useIncidentStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-3xl bg-[#111A2E] border border-[#22304D] rounded shadow-2xl p-6 text-[#E6EDF7] font-mono">
        <div className="flex items-center justify-between pb-3 border-b border-[#22304D]">
          <div>
            <h2 className="text-base font-bold text-[#E6EDF7] tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0E7C86]" />
              <span>SECURITY EVALUATION SCENARIO SELECTOR</span>
            </h2>
            <p className="text-xs text-[#8FA0BF] mt-0.5">
              Select any of the 7 synthetic enterprise cyberattack simulations
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-2.5 py-1 text-xs rounded border border-[#22304D] text-[#8FA0BF] hover:text-[#E6EDF7] hover:bg-[#16223B]"
          >
            CLOSE
          </button>
        </div>

        {/* List of 7 Scenarios */}
        <div className="py-4 space-y-2 max-h-[60vh] overflow-y-auto pr-2">
          {SCENARIO_LIST.map((sc) => {
            const isSelected = activeScenarioId === sc.id;
            return (
              <div
                key={sc.id}
                onClick={() => {
                  setScenario(sc.id as ScenarioId);
                  onClose();
                }}
                className={`p-3 rounded border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#0E3B45]/40 border-[#0E7C86] shadow-sm'
                    : 'bg-[#0B1220] border-[#22304D] hover:border-[#8FA0BF]/50'
                }`}
              >
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#0E7C86]">
                      {sc.name}
                    </span>
                    <span className="text-[#22304D]">|</span>
                    <span className="font-semibold text-xs text-[#E6EDF7]">
                      {sc.title}
                    </span>
                    {sc.id === 'scenario-2' && (
                      <span className="text-[10px] bg-[#A78BFA]/20 text-[#A78BFA] px-1.5 py-0.2 rounded font-bold border border-[#A78BFA]/40">
                        PRIMARY DEMO
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <span className="flex items-center gap-1 text-[11px] text-[#22C55E] font-bold">
                      <Check className="w-3.5 h-3.5" /> ACTIVE
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-[#8FA0BF] space-y-0.5 pt-1">
                  <div>
                    <strong className="text-[#E6EDF7]">Purpose:</strong> {sc.purpose}
                  </div>
                  <div>
                    <strong className="text-[#E6EDF7]">Expected Result:</strong> {sc.expectedResult}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t border-[#22304D] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs rounded bg-[#16223B] border border-[#22304D] text-[#E6EDF7] hover:bg-[#22304D]"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};
