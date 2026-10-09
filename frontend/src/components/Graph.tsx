// Attack graph rendered from the backend snapshot only.
// Diff overlay (new pivot nodes/edges) comes from the latest graph.diff
// audit event payload — never invented on the client.
import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import type { GraphDiffPayload, GraphSnapshot } from '../types';
import { TOK, TYPE_COLOR } from '../lib/tokens';

function edgeKey(e: { src: string; dst: string }) {
  return `${e.src}>>${e.dst}`;
}

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function AttackGraph({
  snapshot,
  activeNodes,
  diff,
  height,
  foothold,
}: {
  snapshot: GraphSnapshot;
  activeNodes: Set<string>;
  diff: GraphDiffPayload | null;
  height: string;
  /** Attacker's current foothold (first node of the first active path). */
  foothold?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const prevVersion = useRef<number>(snapshot.version);

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
    const versionChanged = prevVersion.current !== snapshot.version;
    prevVersion.current = snapshot.version;
    const elements: cytoscape.ElementDefinition[] = [
      ...snapshot.nodes.map((n) => ({
        data: {
          id: n.id,
          label: n.id,
          type: n.type,
          color: TYPE_COLOR[n.type] || TOK.muted,
          protected: !!n.protected,
          active: activeNodes.has(n.id),
          isDiff: diffNodes.has(n.id),
          isFoothold: foothold === n.id,
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
            color: TOK.text,
            'font-size': 9,
            'font-family': 'JetBrains Mono, monospace',
            'background-color': 'data(color)',
            'border-width': 2,
            'border-color': TOK.border,
            width: 26,
            height: 26,
            'text-valign': 'bottom',
            'text-margin-y': 6,
          },
        },
        {
          selector: 'node[active = 1]',
          style: { 'border-color': TOK.danger, 'border-width': 3 },
        },
        {
          // Protected crown-jewel asset: diamond + double border + lock label.
          selector: 'node[protected = 1]',
          style: {
            'border-color': TOK.warning,
            'border-width': 3,
            'outline-width': 1.5,
            'outline-color': TOK.warning,
            'outline-style': 'solid',
            shape: 'diamond',
            width: 32,
            height: 32,
          },
        },
        {
          selector: 'node[isDiff = 1]',
          style: { 'border-color': TOK.diff, 'border-width': 4 },
        },
        {
          // Attacker's current foothold: danger fill ring under the node.
          selector: 'node[isFoothold = 1]',
          style: {
            'underlay-color': TOK.danger,
            'underlay-opacity': 0.35,
            'underlay-padding': 6,
            'underlay-shape': 'ellipse',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': TOK.border,
            'target-arrow-color': TOK.border,
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(kind)',
            color: TOK.muted,
            'font-size': 8,
            'font-family': 'JetBrains Mono, monospace',
          },
        },
        {
          selector: 'edge[active = 1]',
          style: {
            'line-color': TOK.danger,
            'target-arrow-color': TOK.danger,
            width: 2.5,
          },
        },
        {
          selector: 'edge[isDiff = 1]',
          style: {
            'line-color': TOK.diff,
            'target-arrow-color': TOK.diff,
            width: 3,
            'line-style': 'dashed',
          },
        },
      ],
    });
    cyRef.current = cy;
    if (!reducedMotion()) {
      // Settle the new layout, then pulse newly discovered edges once
      // (DESIGN.md §7: one pulse, never perpetual).
      cy.fit(undefined, 24);
      if (versionChanged && diffEdges.size > 0) {
        const fresh = cy.edges().filter((e) => diffEdges.has(edgeKey(e.data())));
        fresh.style({ opacity: 0.25 });
        fresh.animate({ style: { opacity: 1 } }, { duration: 600 });
      }
    }
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
    // Rebuild when snapshot version or diff changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.version, JSON.stringify(snapshot.nodes), JSON.stringify(snapshot.edges), JSON.stringify(diff), foothold]);

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={ref} className="cytoscape-container absolute inset-0" />
      <div className="absolute top-2 left-2 flex flex-wrap gap-1.5 font-mono text-[10px] text-muted">
        <span className="px-1.5 py-0.5 rounded bg-bg/90 border border-border">
          <span className="text-danger">━</span> ACTIVE PATH
        </span>
        <span className="px-1.5 py-0.5 rounded bg-bg/90 border border-border">
          <span className="text-diff">┄</span> NEW / DIFF
        </span>
        <span className="px-1.5 py-0.5 rounded bg-bg/90 border border-border">
          <span className="text-warning">◆</span> PROTECTED
        </span>
        {foothold && (
          <span className="px-1.5 py-0.5 rounded bg-bg/90 border border-border">
            <span className="text-danger">◉</span> FOOTHOLD: {foothold}
          </span>
        )}
      </div>
      <div className="absolute bottom-2 right-2 font-mono text-[10px] text-muted px-1.5 py-0.5 rounded bg-bg/90 border border-border">
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
