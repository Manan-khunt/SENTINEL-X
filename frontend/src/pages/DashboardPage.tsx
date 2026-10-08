import React from 'react';
import { DashboardHeader } from '../components/incidents/DashboardHeader';
import { AttackGraph } from '../components/graph/AttackGraph';
import { AgentTimeline } from '../components/timeline/AgentTimeline';
import { ActionProof } from '../components/actions/ActionProof';
import { AttackPathList } from '../components/incidents/AttackPathList';

export const DashboardPage: React.FC = () => {
  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#0B1220]">
      {/* Dashboard Sub-Header */}
      <DashboardHeader />

      {/* Main 3-Column Console Area (40% / 32% / 28%) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Live Attack Graph (~40%) */}
        <section className="w-[40%] h-full flex flex-col relative overflow-hidden" aria-label="Live Attack Graph">
          <AttackGraph />
        </section>

        {/* Center: Agent Activity / Timeline (~32%) */}
        <section className="w-[32%] h-full flex flex-col relative overflow-hidden" aria-label="Agent Activity Timeline">
          <AgentTimeline />
        </section>

        {/* Right: Action Proof / Approval (~28%) */}
        <section className="w-[28%] h-full flex flex-col relative overflow-hidden" aria-label="Action Proof and Human Approval">
          <ActionProof />
        </section>
      </div>

      {/* Bottom: Current Attack Paths */}
      <AttackPathList />
    </div>
  );
};
