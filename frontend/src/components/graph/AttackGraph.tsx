import React, { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import { ZoomIn, ZoomOut, Maximize2, Activity } from 'lucide-react';
import { useIncidentStore } from '../../stores/incidentStore';
import { GraphLegend } from './GraphLegend';
import { GraphNodeDetails } from './GraphNodeDetails';
import { GraphEdgeDetails } from './GraphEdgeDetails';

export const AttackGraph: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const {
    nodes,
    edges,
    selectedNode,
    selectedEdge,
    selectNode,
    selectEdge,
    diffBannerActive,
  } = useIncidentStore();

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      boxSelectionEnabled: false,
      autounselectify: false,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'color': '#E6EDF7',
            'font-family': 'JetBrains Mono, monospace',
            'font-size': '11px',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'background-color': '#16223B',
            'border-width': 2,
            'border-color': '#22304D',
            'width': 44,
            'height': 44,
            'text-background-color': '#0B1220',
            'text-background-opacity': 0.8,
            'text-background-padding': '3px',
            'text-background-shape': 'roundrectangle',
          },
        },
        {
          selector: 'node[type = "database"]',
          style: {
            'shape': 'round-rectangle',
            'width': 50,
            'height': 50,
            'border-color': '#0E7C86',
            'background-color': '#0E3B45',
          },
        },
        {
          selector: 'node[?isCrownJewel]',
          style: {
            'shape': 'diamond',
            'width': 56,
            'height': 56,
            'border-width': 3,
            'border-color': '#F59E0B',
            'background-color': '#16223B',
            'color': '#F59E0B',
            'font-weight': 'bold',
          },
        },
        {
          selector: 'node[status = "COMPROMISED"]',
          style: {
            'border-color': '#EF4444',
            'border-width': 2.5,
          },
        },
        {
          selector: 'node[status = "ISOLATED"]',
          style: {
            'border-color': '#8FA0BF',
            'opacity': 0.5,
            'background-color': '#0B1220',
          },
        },
        {
          selector: 'node[?isDiff]',
          style: {
            'border-color': '#A78BFA',
            'border-width': 3,
            'background-color': '#20163B',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#0E7C86',
            'border-width': 4,
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 2.5,
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'line-color': '#22304D',
            'target-arrow-color': '#22304D',
            'arrow-scale': 1.2,
          },
        },
        {
          selector: 'edge[status = "ACTIVE"]',
          style: {
            'line-color': '#EF4444',
            'target-arrow-color': '#EF4444',
            'width': 3,
          },
        },
        {
          selector: 'edge[status = "BLOCKED"]',
          style: {
            'line-color': '#8FA0BF',
            'target-arrow-color': '#8FA0BF',
            'line-style': 'dashed',
            'opacity': 0.35,
            'width': 2,
          },
        },
        {
          selector: 'edge[status = "SAFE"]',
          style: {
            'line-color': '#22C55E',
            'target-arrow-color': '#22C55E',
            'width': 2,
          },
        },
        {
          selector: 'edge[?isDiff]',
          style: {
            'line-color': '#A78BFA',
            'target-arrow-color': '#A78BFA',
            'width': 3.5,
          },
        },
      ],
      layout: {
        name: 'preset',
      },
    });

    cyRef.current = cy;

    // Click events
    cy.on('tap', 'node', (evt) => {
      const nodeData = evt.target.data();
      const store = useIncidentStore.getState();
      const matchedNode = store.nodes.find((n) => n.id === nodeData.id);
      if (matchedNode) store.selectNode(matchedNode);
    });

    cy.on('tap', 'edge', (evt) => {
      const edgeData = evt.target.data();
      const store = useIncidentStore.getState();
      const matchedEdge = store.edges.find((e) => e.id === edgeData.id);
      if (matchedEdge) store.selectEdge(matchedEdge);
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        const store = useIncidentStore.getState();
        store.selectNode(null);
        store.selectEdge(null);
      }
    });

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  // Sync elements when nodes or edges change in store
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    // Deterministic positions based on node ID for clean SOC layout
    const positions: Record<string, { x: number; y: number }> = {
      user_1042: { x: 80, y: 110 },
      workstation_17: { x: 220, y: 110 },
      server_03: { x: 360, y: 110 },
      customer_db: { x: 500, y: 180 },
      svc_token: { x: 120, y: 260 },
      server_02: { x: 320, y: 260 },
      // Other scenarios
      ext_ip: { x: 90, y: 150 },
      bastion_01: { x: 80, y: 130 },
      jumpbox_internal: { x: 210, y: 130 },
      corp_ad: { x: 340, y: 130 },
      core_ledger: { x: 470, y: 130 },
      admin_root: { x: 80, y: 140 },
      iam_service: { x: 210, y: 140 },
      prod_cluster: { x: 340, y: 140 },
      workstation_09: { x: 100, y: 150 },
      ssh_tunnel: { x: 270, y: 150 },
      syslog_collector: { x: 100, y: 150 },
      llm_ingestor: { x: 260, y: 150 },
      core_api: { x: 420, y: 150 },
      dba_jennifer: { x: 90, y: 150 },
      db_admin_ws: { x: 250, y: 150 },
    };

    cy.batch(() => {
      cy.elements().remove();

      nodes.forEach((n, idx) => {
        const defaultPos = positions[n.id] || { x: 100 + (idx % 3) * 150, y: 100 + Math.floor(idx / 3) * 100 };
        cy.add({
          group: 'nodes',
          data: {
            id: n.id,
            label: n.label,
            type: n.type,
            status: n.status,
            criticality: n.criticality,
            isCrownJewel: n.isCrownJewel,
            isDiff: n.isDiff,
          },
          position: defaultPos,
        });
      });

      edges.forEach((e) => {
        cy.add({
          group: 'edges',
          data: {
            id: e.id,
            source: e.source,
            target: e.target,
            relationship: e.relationship,
            status: e.status,
            isDiff: e.isDiff,
          },
        });
      });
    });

    cy.fit(undefined, 40);
  }, [nodes, edges]);

  // Controls
  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.2);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  const handleFit = () => cyRef.current?.fit(undefined, 40);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#0B1220] overflow-hidden">
      {/* Header Bar */}
      <div className="h-9 px-3 bg-[#111A2E] border-b border-[#22304D] flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="font-bold text-[#E6EDF7] tracking-wider">LIVE ATTACK GRAPH</span>
          <span className="text-[10px] text-[#8FA0BF]">
            ({nodes.length} Nodes, {edges.length} Edges)
          </span>
        </div>

        {/* Viewport Zoom & Fit Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomIn}
            className="p-1 rounded text-[#8FA0BF] hover:text-[#E6EDF7] hover:bg-[#16223B]"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1 rounded text-[#8FA0BF] hover:text-[#E6EDF7] hover:bg-[#16223B]"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleFit}
            className="p-1 rounded text-[#8FA0BF] hover:text-[#E6EDF7] hover:bg-[#16223B]"
            title="Fit to View"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Graph Diff Notification Banner */}
      {diffBannerActive && (
        <div className="bg-[#A78BFA]/20 border-b border-[#A78BFA]/50 text-[#A78BFA] px-3 py-1.5 flex items-center gap-2 text-xs font-mono font-semibold animate-pulse shrink-0">
          <Activity className="w-4 h-4 shrink-0" />
          <span>GRAPH DIFF DETECTED: ADVERSARY PIVOTED VIA SERVICE TOKEN → PATH B ACTIVE → REPLANNING REQUIRED</span>
        </div>
      )}

      {/* Canvas */}
      <div className="relative flex-1 w-full h-full">
        <div ref={containerRef} className="cytoscape-container w-full h-full" />

        {/* Legend */}
        <GraphLegend />

        {/* Details Panels */}
        {selectedNode && (
          <GraphNodeDetails
            node={selectedNode}
            edges={edges}
            onClose={() => selectNode(null)}
          />
        )}

        {selectedEdge && (
          <GraphEdgeDetails
            edge={selectedEdge}
            onClose={() => selectEdge(null)}
          />
        )}
      </div>
    </div>
  );
};
