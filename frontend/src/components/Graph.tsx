// Attack graph rendered from the backend snapshot only.
// Diff overlay (new pivot nodes/edges) comes from the latest graph.diff
// audit event payload — never invented on the client.
import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import type { GraphDiffPayload, GraphSnapshot } from '../types';

const TYPE_COLOR: Record<string, string> = {
  user: '#3B82F6',
  device: '#0E7C86',
  server: '#0E7C86',
  credential: '#F59E0B',
  service_token: '#A78BFA',
  service: '#8FA0BF',
  database: '#22C55E',
};

function edgeKey(e: { src: string; dst: string }) {
  return `${e.src}>>${e.dst}`;
}

export function AttackGraph({
  snapshot,
  activeNodes,
  diff,
  height,
}: {
  snapshot: GraphSnapshot;
  activeNodes: Set<string>;
  diff: GraphDiffPayload | null;
  height: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const diffNodes = new Set<string>([
    ...(diff?.new_nodes || []),
    ...(diff?.new_active_paths || []).flat(),
  ]);
  const diffEdges = new Set<string>([
    ...(diff?.changed_edges || []).map(edgeKey),
    ...flattenEdges(diff?.new_active_paths || []),
  ]);

  useEffect(() => {
    if (!ref.current) return;
    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }
    const elements: cytoscape.ElementDefinition[] = [
      ...snapshot.nodes.map((n) => ({
        data: {
          id: n.id,
          label: n.id,
          type: n.type,
          color: TYPE_COLOR[n.type] || '#8FA0BF',
          protected: !!n.protected,
          active: activeNodes.has(n.id),
          isDiff: diffNodes.has(n.id),
        },
      })),
      ...snapshot.edges.map((e) => ({
        data: {
          id: `${e.src}>>${e.dst}>>${e.kind}`,
          source: e.src,
          target: e.dst,
          kind: e.kind,
          active: activeNodes.has(e.src) && activeNodes.has(e.dst),
          isDiff: diffEdges.has(edgeKey(e)),
        },
      })),
    ];
    const cy = cytoscape({
      container: ref.current,
      elements,
      layout: { name: 'breadthfirst', directed: true, padding: 24, spacingFactor: 1.4 } as never,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            color: '#E6EDF7',
            'font-size': 9,
            'font-family': 'JetBrains Mono, monospace',
            'background-color': 'data(color)',
            'border-width': 2,
            'border-color': '#22304D',
            width: 26,
            height: 26,
            'text-valign': 'bottom',
            'text-margin-y': 6,
          },
        },
        {
          selector: 'node[active = 1]',
          style: { 'border-color': '#EF4444', 'border-width': 3 },
        },
        {
          selector: 'node[protected = 1]',
          style: {
            'border-color': '#F59E0B',
            'border-width': 3,
            shape: 'diamond',
            width: 32,
            height: 32,
          },
        },
        {
          selector: 'node[isDiff = 1]',
          style: { 'border-color': '#A78BFA', 'border-width': 4 },
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': '#22304D',
            'target-arrow-color': '#22304D',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(kind)',
            color: '#8FA0BF',
            'font-size': 8,
            'font-family': 'JetBrains Mono, monospace',
          },
        },
        {
          selector: 'edge[active = 1]',
          style: {
            'line-color': '#EF4444',
            'target-arrow-color': '#EF4444',
            width: 2.5,
          },
        },
        {
          selector: 'edge[isDiff = 1]',
          style: {
            'line-color': '#A78BFA',
            'target-arrow-color': '#A78BFA',
            width: 3,
            'line-style': 'dashed',
          },
        },
      ],
    });
    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
    // Rebuild when snapshot version or diff changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.version, JSON.stringify(snapshot.nodes), JSON.stringify(snapshot.edges), JSON.stringify(diff)]);

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={ref} className="cytoscape-container absolute inset-0" />
      <div className="absolute top-2 left-2 flex flex-wrap gap-1.5 font-mono text-[10px] text-[#8FA0BF]">
        <span className="px-1.5 py-0.5 rounded bg-[#0B1220]/90 border border-[#22304D]">
          <span className="text-[#EF4444]">━</span> ACTIVE PATH
        </span>
        <span className="px-1.5 py-0.5 rounded bg-[#0B1220]/90 border border-[#22304D]">
          <span className="text-[#A78BFA]">┄</span> NEW / DIFF
        </span>
        <span className="px-1.5 py-0.5 rounded bg-[#0B1220]/90 border border-[#22304D]">
          <span className="text-[#F59E0B]">◆</span> PROTECTED
        </span>
      </div>
      <div className="absolute bottom-2 right-2 font-mono text-[10px] text-[#8FA0BF] px-1.5 py-0.5 rounded bg-[#0B1220]/90 border border-[#22304D]">
        v{snapshot.version} · {snapshot.nodes.length} nodes · {snapshot.edges.length} edges
      </div>
    </div>
  );
}

function flattenEdges(paths: string[][]): string[] {
  const out: string[] = [];
  for (const p of paths) {
    for (let i = 0; i + 1 < p.length; i++) out.push(`${p[i]}>>${p[i + 1]}`);
  }
  return out;
}
