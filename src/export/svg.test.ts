import { describe, it, expect, vi } from 'vitest';
import { layoutGraph, generateSvg, getCommunityColor } from './svg.js';
import type { GraphDocument, GraphNode, GraphEdge } from '../types.js';

vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

describe('svg', () => {
  const simpleNodes: GraphNode[] = [
    { id: 'n1', label: 'Node One', type: 'function' },
    { id: 'n2', label: 'Node Two', type: 'class' },
    { id: 'n3', label: 'Node Three', type: 'module', community: 1 },
  ];

  const simpleEdges: GraphEdge[] = [
    { id: 'e1', source: 'n1', target: 'n2', weight: 1 },
    { id: 'e2', source: 'n2', target: 'n3', weight: 0.5 },
  ];

  const simpleGraph: GraphDocument = {
    nodes: simpleNodes,
    edges: simpleEdges,
    metadata: { directed: true },
  };

  describe('layoutGraph', () => {
    it('returns layout nodes for given graph', () => {
      const result = layoutGraph(simpleNodes, simpleEdges);
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('x');
      expect(result[0]).toHaveProperty('y');
      expect(result[0]).toHaveProperty('label');
    });

    it('applies community when present', () => {
      const result = layoutGraph(simpleNodes, simpleEdges);
      const n3 = result.find(n => n.id === 'n3');
      expect(n3?.community).toBe(1);
    });
  });

  describe('getCommunityColor', () => {
    it('returns gray for undefined community', () => {
      const result = getCommunityColor(undefined);
      expect(result).toBe('#6b7280');
    });

    it('returns color from palette for valid community', () => {
      const result = getCommunityColor(0);
      expect(result).toBe('#6366f1');
    });

    it('wraps community index around palette', () => {
      const result = getCommunityColor(100);
      // Should not throw, palette access is modulo
      expect(result).toBeTruthy();
    });
  });

  describe('generateSvg', () => {
    it('returns SVG string', () => {
      const result = generateSvg(simpleGraph);
      expect(result).toContain('<?xml');
      expect(result).toContain('<svg');
      expect(result).toContain('</svg>');
    });

    it('contains nodes', () => {
      const result = generateSvg(simpleGraph);
      expect(result).toContain('<g id="nodes">');
      expect(result).toContain('<circle');
      expect(result).toContain('Node One');
    });

    it('contains edges with arrow for directed graph', () => {
      const result = generateSvg(simpleGraph);
      expect(result).toContain('<g id="edges">');
      expect(result).toContain('marker-end');
    });

    it('contains legend for communities', () => {
      const result = generateSvg(simpleGraph);
      expect(result).toContain('<g id="legend">');
      expect(result).toContain('Communities');
    });

    it('shows node and edge counts in title', () => {
      const result = generateSvg(simpleGraph);
      expect(result).toContain('3 nodes');
      expect(result).toContain('2 edges');
    });

    it('includes directed flag when set', () => {
      const result = generateSvg(simpleGraph);
      expect(result).toContain('directed');
    });

    it('escapes XML in labels', () => {
      const nodesWithXml: GraphNode[] = [
        { id: 'n1', label: 'Node <test> & "quotes"', type: 'function' },
      ];
      const result = generateSvg({ nodes: nodesWithXml, edges: [] });
      expect(result).toContain('&lt;test&gt;');
      expect(result).toContain('&amp;');
    });

    it('handles undirected graph without arrow markers', () => {
      const undirected: GraphDocument = {
        nodes: simpleNodes,
        edges: simpleEdges,
        metadata: { directed: false },
      };
      const result = generateSvg(undirected);
      expect(result).not.toContain('marker-end');
    });

    it('handles empty graph', () => {
      const empty: GraphDocument = { nodes: [], edges: [] };
      const result = generateSvg(empty);
      expect(result).toContain('<svg');
      expect(result).toContain('0 nodes');
    });

    it('renders edge labels when present', () => {
      const edgesWithLabel: GraphEdge[] = [
        { id: 'e1', source: 'n1', target: 'n2', weight: 1, label: 'calls' },
      ];
      const result = generateSvg({ nodes: simpleNodes, edges: edgesWithLabel });
      expect(result).toContain('calls');
    });
  });
});
