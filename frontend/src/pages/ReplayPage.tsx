import React from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  SkipBack, 
  SkipForward, 
  Film
} from 'lucide-react';
import { SCENARIO_DATASETS } from '../demo/allScenariosData';
import { SCENARIOS } from '../demo/scenarios';
import { AttackGraph } from '../components/graph/AttackGraph';
import { TimelineEvent } from '../components/timeline/TimelineEvent';
import { StatusBadge } from '../components/common/StatusBadge';
import { useIncidentStore } from '../stores/incidentStore';

export const ReplayPage: React.FC = () => {
  const {
    incidentId,
    activeScenarioId,
    currentStepIndex,
    stepForward,
    stepBackward,
    resetSimulation,
    togglePlay,
    isPlaying,
  } = useIncidentStore();

  const dataset = SCENARIO_DATASETS[activeScenarioId];
  const scenario = SCENARIOS[activeScenarioId];
  const totalSteps = dataset.steps.length;
  const currentStep = dataset.steps[currentStepIndex] || dataset.steps[0];

  return (
    <div className="flex flex-col h-full w-full bg-[#0B1220] overflow-hidden select-none font-mono">
      {/* Header Bar with Replay Metadata */}
      <div className="h-12 px-6 bg-[#111A2E] border-b border-[#22304D] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Film className="w-4 h-4 text-[#0E7C86]" />
          <h1 className="text-sm font-bold text-[#E6EDF7] tracking-wider uppercase">
            DETERMINISTIC INCIDENT REPLAY
          </h1>
          <span className="text-xs text-[#8FA0BF]">({incidentId} // {scenario.title})</span>
        </div>

        {/* Playback Controls: PLAY, PAUSE, STEP BACK, STEP FORWARD, RESET */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#0B1220] p-1 rounded border border-[#22304D]">
            <button
              onClick={stepBackward}
              disabled={currentStepIndex <= 0}
              className="px-2.5 py-1 text-xs rounded text-[#8FA0BF] hover:text-[#E6EDF7] hover:bg-[#16223B] disabled:opacity-30"
              title="Step Back"
            >
              <SkipBack className="w-3.5 h-3.5 inline mr-1" />
              <span>STEP BACK</span>
            </button>

            <button
              onClick={togglePlay}
              className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1.5 transition-colors ${
                isPlaying
                  ? 'bg-[#F59E0B] text-black hover:bg-[#d97706]'
                  : 'bg-[#0E7C86] text-white hover:bg-[#12929E]'
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
            </button>

            <button
              onClick={stepForward}
              disabled={currentStepIndex >= totalSteps - 1}
              className="px-2.5 py-1 text-xs rounded text-[#8FA0BF] hover:text-[#E6EDF7] hover:bg-[#16223B] disabled:opacity-30"
              title="Step Forward"
            >
              <span>STEP FWD</span>
              <SkipForward className="w-3.5 h-3.5 inline ml-1" />
            </button>

            <button
              onClick={resetSimulation}
              className="px-2.5 py-1 text-xs rounded text-[#8FA0BF] hover:text-[#EF4444] hover:bg-[#16223B]"
              title="Reset Replay"
            >
              <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
              <span>RESET</span>
            </button>
          </div>

          <div className="px-2.5 py-1 rounded bg-[#16223B] border border-[#22304D] text-xs">
            <span className="text-[#8FA0BF]">PROGRESS: </span>
            <strong className="text-[#12929E]">{currentStepIndex + 1}</strong>
            <span className="text-[#8FA0BF]"> / {totalSteps}</span>
          </div>
        </div>
      </div>

      {/* Replay Scrub Timeline Progress Bar */}
      <div className="w-full bg-[#16223B] h-1.5">
        <div
          className="bg-[#0E7C86] h-full transition-all duration-200"
          style={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
        />
      </div>

      {/* Main Split Console: 55% Graph Snapshot, 45% Step Details & Timeline */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Synchronized Graph Snapshot */}
        <div className="w-[55%] h-full relative border-r border-[#22304D]">
          <AttackGraph />
        </div>

        {/* Right: Step Inspector & Replay Ledger */}
        <div className="w-[45%] h-full flex flex-col bg-[#0B1220] overflow-hidden">
          {/* Active Step Snapshot Card */}
          <div className="p-4 bg-[#111A2E] border-b border-[#22304D] space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#E6EDF7] flex items-center gap-1.5">
                <span className="text-[#0E7C86]">STEP #{currentStep.stepNumber}:</span>
                <span>{currentStep.eventType}</span>
              </span>
              <StatusBadge status={currentStep.status} />
            </div>

            <p className="text-xs text-[#8FA0BF] font-sans leading-relaxed">
              {currentStep.summary}
            </p>

            {currentStep.structuredReasoning && (
              <div className="p-2.5 rounded bg-[#0B1220] border-l-2 border-[#0E7C86] border border-[#22304D] space-y-1">
                <span className="text-[10px] text-[#0E7C86] font-bold uppercase tracking-wider">
                  STRUCTURED REASONING SNAPSHOT
                </span>
                <p className="text-xs text-[#E6EDF7] font-sans italic">
                  "{currentStep.structuredReasoning}"
                </p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 text-[11px] text-[#8FA0BF] pt-1">
              <div>
                <span>Phase: </span>
                <strong className="text-[#E6EDF7]">{currentStep.phase}</strong>
              </div>
              <div>
                <span>Timestamp: </span>
                <strong className="text-[#E6EDF7]">{currentStep.timestamp}</strong>
              </div>
              <div>
                <span>Ground Truth: </span>
                <strong className="text-[#22C55E]">
                  {currentStepIndex === totalSteps - 1 ? 'CONTAINED' : 'EVALUATING'}
                </strong>
              </div>
            </div>
          </div>

          {/* Full Historic Steps List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            <div className="text-[10px] uppercase font-bold text-[#8FA0BF] mb-2 tracking-wider">
              REPLAY TIMELINE SEQUENCE
            </div>
            {dataset.steps.slice(0, currentStepIndex + 1).map((s, idx) => (
              <TimelineEvent
                key={s.id || idx}
                step={s}
                isLatest={idx === currentStepIndex}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
