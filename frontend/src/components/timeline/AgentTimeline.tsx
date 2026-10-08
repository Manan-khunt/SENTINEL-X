import React, { useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  RotateCcw, 
  Layers
} from 'lucide-react';
import { useIncidentStore } from '../../stores/incidentStore';
import { TimelineEvent } from './TimelineEvent';

export const AgentTimeline: React.FC = () => {
  const {
    timeline,
    currentStepIndex,
    isPlaying,
    togglePlay,
    stepForward,
    stepBackward,
    resetSimulation,
    playbackSpeed,
  } = useIncidentStore();

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-play timer
  useEffect(() => {
    let timer: any;
    if (isPlaying) {
      timer = setInterval(() => {
        stepForward();
      }, playbackSpeed);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, playbackSpeed, stepForward]);

  // Scroll to bottom on new events
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [timeline.length]);

  return (
    <div className="flex flex-col h-full w-full bg-[#0B1220] border-l border-r border-[#22304D] overflow-hidden select-none">
      {/* Header with Step controls */}
      <div className="h-9 px-3 bg-[#111A2E] border-b border-[#22304D] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-xs font-mono">
          <Layers className="w-3.5 h-3.5 text-[#0E7C86]" />
          <span className="font-bold text-[#E6EDF7] tracking-wider">AGENT ACTIVITY</span>
          <span className="text-[10px] text-[#8FA0BF]">({timeline.length} Events)</span>
        </div>

        {/* Stepping and Playback Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={stepBackward}
            disabled={currentStepIndex <= 0}
            className="p-1 rounded text-[#8FA0BF] hover:text-[#E6EDF7] hover:bg-[#16223B] disabled:opacity-30 disabled:hover:bg-transparent"
            title="Step Backward"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={togglePlay}
            className={`px-2 py-0.5 rounded text-[11px] font-mono flex items-center gap-1 border transition-colors ${
              isPlaying
                ? 'bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/40 hover:bg-[#F59E0B]/30'
                : 'bg-[#0E7C86]/20 text-[#12929E] border-[#0E7C86]/40 hover:bg-[#0E7C86]/30'
            }`}
            title={isPlaying ? 'Pause Simulation' : 'Auto Play Simulation'}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3 h-3" />
                <span>PAUSE</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                <span>PLAY</span>
              </>
            )}
          </button>

          <button
            onClick={stepForward}
            className="p-1 rounded text-[#8FA0BF] hover:text-[#E6EDF7] hover:bg-[#16223B]"
            title="Step Forward (Next Event)"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={resetSimulation}
            className="p-1 rounded text-[#8FA0BF] hover:text-[#EF4444] hover:bg-[#16223B]"
            title="Reset Simulation to Initial State"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Observation loop indicator badge */}
      <div className="px-3 py-1 bg-[#111A2E]/60 border-b border-[#22304D] flex items-center justify-between text-[10px] font-mono text-[#8FA0BF]">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0E7C86] animate-pulse" />
          <span>OBSERVE → VERIFY → REPLAN LOOP</span>
        </div>
        <span className="text-[#8FA0BF]/80">REALTIME EXECUTION</span>
      </div>

      {/* Scrollable Timeline Stream */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-1"
      >
        {timeline.map((step, idx) => (
          <TimelineEvent
            key={step.id || idx}
            step={step}
            isLatest={idx === timeline.length - 1}
          />
        ))}
      </div>
    </div>
  );
};
