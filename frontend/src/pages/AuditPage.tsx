import React from 'react';
import { AuditTable } from '../components/audit/AuditTable';
import { FileText, Hash } from 'lucide-react';

export const AuditPage: React.FC = () => {
  return (
    <div className="flex flex-col h-full w-full bg-[#0B1220] overflow-hidden select-none font-mono">
      {/* Header */}
      <div className="h-12 px-6 bg-[#111A2E] border-b border-[#22304D] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <FileText className="w-4 h-4 text-[#0E7C86]" />
          <h1 className="text-sm font-bold text-[#E6EDF7] tracking-wider uppercase">
            IMMUTABLE CRYPTOGRAPHIC AUDIT TRAIL
          </h1>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#8FA0BF]">
          <Hash className="w-3.5 h-3.5 text-[#A78BFA]" />
          <span>SHA-256 HASH CHAINING ACTIVE</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <AuditTable />
      </div>
    </div>
  );
};
