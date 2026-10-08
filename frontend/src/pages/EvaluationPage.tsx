import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { benchmarkApi, BENCHMARK_TARGETS } from '../api/benchmark';
import { LoadingState } from '../components/common/FeedbackStates';
import { BarChart3, Play, AlertCircle, Target, Info } from 'lucide-react';

export const EvaluationPage: React.FC = () => {
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchMsg, setDispatchMsg] = useState<string | null>(null);

  const { data: latestRun, isLoading, refetch } = useQuery({
    queryKey: ['benchmark-latest'],
    queryFn: benchmarkApi.getLatestBenchmarkRun,
  });

  const handleRunSuite = async () => {
    setIsDispatching(true);
    try {
      const res = await benchmarkApi.runBenchmarkSuite();
      setDispatchMsg(res.message);
      setTimeout(() => refetch(), 2000);
    } finally {
      setIsDispatching(false);
    }
  };

  const configs = [
    {
      id: 'B0',
      title: 'Alert-Only Baseline',
      desc: 'Static heuristic alerting with zero autonomous intervention. Requires manual SOC analyst remediation for every alert.',
      color: 'border-[#8FA0BF] text-[#8FA0BF]',
    },
    {
      id: 'B1',
      title: 'Static SOAR Playbook',
      desc: 'Traditional predetermined playbook (Alert → Rule → Action → Stop). Incapable of adapting if the adversary pivots.',
      color: 'border-[#F59E0B] text-[#F59E0B]',
    },
    {
      id: 'B2',
      title: 'Sentinel-X (No Replan)',
      desc: 'Agentic graph synthesis and tool execution, but with replanning loop disabled upon adversary adaptation.',
      color: 'border-[#3B82F6] text-[#3B82F6]',
    },
    {
      id: 'B3',
      title: 'Full SENTINEL-X',
      desc: 'Complete closed-loop autonomous system: Observe → Ground Truth Verify → Dynamic Graph Diff → Autonomous Replan.',
      color: 'border-[#0E7C86] text-[#12929E]',
    },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-[#0B1220] overflow-hidden select-none font-mono">
      {/* Header */}
      <div className="h-12 px-6 bg-[#111A2E] border-b border-[#22304D] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <BarChart3 className="w-4 h-4 text-[#0E7C86]" />
          <h1 className="text-sm font-bold text-[#E6EDF7] tracking-wider uppercase">
            EVALUATION & BENCHMARK SUITE (B0–B3)
          </h1>
        </div>

        <button
          onClick={handleRunSuite}
          disabled={isDispatching}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#0E7C86] hover:bg-[#12929E] text-white text-xs font-bold transition-colors disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5" />
          <span>{isDispatching ? 'DISPATCHING WORKER...' : 'RUN BENCHMARK SUITE'}</span>
        </button>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {dispatchMsg && (
          <div className="p-3 bg-[#0E7C86]/20 border border-[#0E7C86] rounded text-[#12929E] text-xs flex items-center justify-between">
            <span>{dispatchMsg}</span>
            <button onClick={() => setDispatchMsg(null)} className="text-[#8FA0BF] hover:text-white">✕</button>
          </div>
        )}

        {/* Configuration Matrix Cards */}
        <div className="grid grid-cols-4 gap-4">
          {configs.map((cfg) => (
            <div
              key={cfg.id}
              className={`p-4 rounded bg-[#111A2E] border ${cfg.color.split(' ')[0]} space-y-2`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-base font-bold ${cfg.color.split(' ')[1]}`}>{cfg.id}</span>
                <span className="text-[10px] text-[#8FA0BF] uppercase">CONFIGURATION</span>
              </div>
              <h3 className="text-xs font-bold text-[#E6EDF7]">{cfg.title}</h3>
              <p className="text-[11px] text-[#8FA0BF] font-sans leading-relaxed">
                {cfg.desc}
              </p>
            </div>
          ))}
        </div>

        {/* SECTION 1: BENCHMARK TARGET THRESHOLDS */}
        <div className="p-5 rounded bg-[#111A2E] border border-[#22304D] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#22304D]">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-[#F59E0B]" />
              <h2 className="text-xs font-bold text-[#E6EDF7] tracking-wider uppercase">
                FORMAL BENCHMARK TARGET THRESHOLDS
              </h2>
            </div>
            <span className="text-[11px] text-[#F59E0B] font-bold bg-[#F59E0B]/10 px-2 py-0.5 rounded border border-[#F59E0B]/30">
              TARGET CRITERIA (SPECIFICATION ONLY)
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {BENCHMARK_TARGETS.map((t) => (
              <div key={t.name} className="p-3 bg-[#0B1220] rounded border border-[#22304D] space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8FA0BF] truncate pr-2">{t.name}</span>
                  <span className="font-bold text-[#22C55E] bg-[#16223B] px-1.5 py-0.2 rounded border border-[#22304D]">
                    {t.target}
                  </span>
                </div>
                <p className="text-[10px] text-[#8FA0BF]/80 font-sans leading-tight">
                  {t.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 2: MEASURED BENCHMARK OUTPUT */}
        <div className="p-5 rounded bg-[#111A2E] border border-[#22304D] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#22304D]">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#0E7C86]" />
              <h2 className="text-xs font-bold text-[#E6EDF7] tracking-wider uppercase">
                MEASURED BENCHMARK RUN TELEMETRY
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#8FA0BF]">
              <Info className="w-3.5 h-3.5 text-[#0E7C86]" />
              <span>Strict Rule 30: Never invent results. Requires backend worker execution.</span>
            </div>
          </div>

          {isLoading ? (
            <LoadingState message="Checking backend for measured benchmark results..." />
          ) : !latestRun || !latestRun.metrics ? (
            /* NO RESULTS AVAILABLE STATE */
            <div className="p-8 text-center bg-[#0B1220] rounded border border-dashed border-[#22304D] space-y-3">
              <div className="w-10 h-10 rounded-full bg-[#16223B] border border-[#22304D] mx-auto flex items-center justify-center text-[#8FA0BF]">
                <AlertCircle className="w-5 h-5 text-[#8FA0BF]" />
              </div>
              <div>
                <div className="text-sm font-bold text-[#E6EDF7] tracking-wider">
                  NO RESULTS AVAILABLE
                </div>
                <p className="text-xs text-[#8FA0BF] max-w-md mx-auto mt-1 font-sans">
                  No automated evaluation run has been dispatched on the backend benchmark suite yet.
                  Sentinel-X strictly preserves ground truth and never displays fabricated metric percentages.
                </p>
              </div>
              <button
                onClick={handleRunSuite}
                className="px-4 py-1.5 rounded bg-[#16223B] hover:bg-[#1f3054] text-[#0E7C86] font-bold text-xs border border-[#22304D] transition-colors"
              >
                DISPATCH BENCHMARK SUITE NOW
              </button>
            </div>
          ) : (
            /* ACTUAL BENCHMARK RUN DATA IF RETURNED FROM BACKEND */
            <div className="rounded border border-[#22304D] overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#16223B] text-[#8FA0BF] text-[10px] uppercase">
                  <tr>
                    <th className="px-4 py-3">Metric</th>
                    <th className="px-4 py-3">Target</th>
                    <th className="px-4 py-3 text-center">B0 (Alert Only)</th>
                    <th className="px-4 py-3 text-center">B1 (Static SOAR)</th>
                    <th className="px-4 py-3 text-center">B2 (No Replan)</th>
                    <th className="px-4 py-3 text-center">B3 (Full Sentinel-X)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#22304D]">
                  {latestRun.metrics.map((m) => (
                    <tr key={m.name} className="hover:bg-[#16223B]/40">
                      <td className="px-4 py-3 font-semibold text-[#E6EDF7]">{m.name}</td>
                      <td className="px-4 py-3 text-[#22C55E]">{m.target}</td>
                      <td className="px-4 py-3 text-center text-[#8FA0BF]">{m.b0 ?? '—'}</td>
                      <td className="px-4 py-3 text-center text-[#8FA0BF]">{m.b1 ?? '—'}</td>
                      <td className="px-4 py-3 text-center text-[#8FA0BF]">{m.b2 ?? '—'}</td>
                      <td className="px-4 py-3 text-center font-bold text-[#12929E]">{m.b3 ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
