import React from 'react';
import { X, Database, Server, User, Laptop, Key, Cpu, Activity } from 'lucide-react';
import type { GraphNode, GraphEdge } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { RiskBadge } from '../common/RiskBadge';

interface GraphNodeDetailsProps {
  node: GraphNode;
  edges: GraphEdge[];
  onClose: () => void;
}

export const GraphNodeDetails: React.FC<GraphNodeDetailsProps> = ({ node, edges, onClose }) => {
  const getIcon = () => {
    switch (node.type) {
      case 'database':
        return <Database className="w-5 h-5 text-[#F59E0B]" />;
      case 'server':
        return <Server className="w-5 h-5 text-[#3B82F6]" />;
      case 'user':
        return <User className="w-5 h-5 text-[#E6EDF7]" />;
      case 'workstation':
      case 'device':
        return <Laptop className="w-5 h-5 text-[#8FA0BF]" />;
      case 'credential':
      case 'service_token':
        return <Key className="w-5 h-5 text-[#A78BFA]" />;
      default:
        return <Cpu className="w-5 h-5 text-[#0E7C86]" />;
    }
  };

  const connectedEdges = edges.filter(
    (e) => e.source === node.id || e.target === node.id
  );

  return (
    <div className="absolute top-3 right-3 w-80 bg-[#111A2E]/95 border border-[#22304D] rounded shadow-2xl p-4 text-xs font-mono z-20 backdrop-blur-md animate-in slide-in-from-right-4 duration-150 select-none">
      <div className="flex items-center justify-between pb-3 border-b border-[#22304D]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-[#16223B] border border-[#22304D]">
            {getIcon()}
          </div>
          <div>
            <h3 className="font-bold text-[#E6EDF7] text-sm tracking-wide truncate max-w-[170px]">
              {node.label}
            </h3>
            <span className="text-[10px] text-[#8FA0BF] uppercase">{node.type}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-[#8FA0BF] hover:text-[#E6EDF7] rounded hover:bg-[#16223B]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="py-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[#8FA0BF]">STATUS</span>
          <StatusBadge status={node.status} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[#8FA0BF]">CRITICALITY</span>
          <RiskBadge score={node.criticality} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[#8FA0BF]">PROTECTION</span>
          {node.isCrownJewel ? (
            <span className="px-1.5 py-0.5 rounded bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40 font-bold text-[10px]">
              ★ CROWN JEWEL
            </span>
          ) : (
            <span className="text-[#8FA0BF]">STANDARD ASSET</span>
          )}
        </div>

        {node.ipAddress && (
          <div className="flex items-center justify-between">
            <span className="text-[#8FA0BF]">IP ADDRESS</span>
            <span className="text-[#E6EDF7]">{node.ipAddress}</span>
          </div>
        )}

        {node.hostname && (
          <div className="flex items-center justify-between">
            <span className="text-[#8FA0BF]">HOSTNAME</span>
            <span className="text-[#E6EDF7]">{node.hostname}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-[#8FA0BF]">LAST OBSERVED</span>
          <span className="text-[#8FA0BF]">{node.lastObserved || 'Active'}</span>
        </div>

        {node.isDiff && (
          <div className="p-2 rounded bg-[#A78BFA]/10 border border-[#A78BFA]/40 text-[#A78BFA] text-[11px] flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 shrink-0" />
            <span>MUTATION DETECTED: Node added in adversary pivot</span>
          </div>
        )}

        <div className="pt-2 border-t border-[#22304D]">
          <div className="text-[10px] text-[#8FA0BF] uppercase mb-1.5">
            Current Connections ({connectedEdges.length})
          </div>
          <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
            {connectedEdges.length === 0 ? (
              <span className="text-[#8FA0BF] italic">No active connections</span>
            ) : (
              connectedEdges.map((e) => (
                <div
                  key={e.id}
                  className="p-1.5 rounded bg-[#0B1220] border border-[#22304D] flex items-center justify-between text-[10px]"
                >
                  <span className="text-[#8FA0BF] truncate max-w-[130px]">
                    {e.source === node.id ? `→ ${e.target}` : `← ${e.source}`}
                  </span>
                  <StatusBadge status={e.status} size="sm" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
