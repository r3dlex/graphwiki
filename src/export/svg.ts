// SVG export for GraphWiki v2
// Renders nodes, edges (arrows if directed), communities as colors

import type { GraphDocument, GraphNode, GraphEdge } from '../types.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const COMMUNITY_COLORS = [
  '#6366f1', // indigo
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#84cc16', // lime
];

export function getCommunityColor(community: number | undefined): string {
  if (community === undefined) return '#6b7280'; // gray for unassigned
  return COMMUNITY_COLORS[community % COMMUNITY_COLORS.length] ?? '#6366f1';
}

// Simple force-directed layout
interface LayoutNode {
  id: string;
  label: string;
  x: number;
  y: number;
  community: number | undefined;
}

// Force-directed layout for SVG
export function layoutGraph(nodes: GraphNode[], edges: GraphEdge[], width = 1200, height = 900): LayoutNode[] {
  const positions = new Map<string, { x: number; y: number }>();

  // Initialize with grid-ish positions
  const cols = Math.ceil(Math.sqrt(nodes.length));
  nodes.forEach((node, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.set(node.id, {
      x: 100 + col * (width / cols),
      y: 100 + row * (height / (Math.ceil(nodes.length / cols) + 1)),
    });
  });

  // Simple force-directed iterations
  const REPULSION = 8000;
  const ATTRACTION = 0.005;
  const DAMPING = 0.85;
  const ITERATIONS = 100;

  const velocities = new Map<string, { vx: number; vy: number }>();
  nodes.forEach((n) => velocities.set(n.id, { vx: 0, vy: 0 }));

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const forces = new Map<string, { fx: number; fy: number }>();
    nodes.forEach((n) => forces.set(n.id, { fx: 0, fy: 0 }));

    // Repulsion between all pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        if (!a || !b) continue;
        const posA = positions.get(a.id);
        const posB = positions.get(b.id);
        if (!posA || !posB) continue;

        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = REPULSION / (dist * dist);

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        const fA = forces.get(a.id)!;
        const fB = forces.get(b.id)!;
        fA.fx -= fx;
        fA.fy -= fy;
        fB.fx += fx;
        fB.fy += fy;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const posS = positions.get(edge.source);
      const posT = positions.get(edge.target);
      if (!posS || !posT) continue;

      const dx = posT.x - posS.x;
      const dy = posT.y - posS.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      const force = dist * ATTRACTION;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      const fS = forces.get(edge.source)!;
      const fT = forces.get(edge.target)!;
      fS.fx += fx;
      fS.fy += fy;
      fT.fx -= fx;
      fT.fy -= fy;
    }

    // Apply forces
    for (const node of nodes) {
      const vel = velocities.get(node.id)!;
      const force = forces.get(node.id)!;
      vel.vx = (vel.vx + force.fx) * DAMPING;
      vel.vy = (vel.vy + force.fy) * DAMPING;

      const pos = positions.get(node.id)!;
      pos.x = Math.max(60, Math.min(width - 60, pos.x + vel.vx));
      pos.y = Math.max(60, Math.min(height - 60, pos.y + vel.vy));
    }
  }

  return nodes.map((n) => {
    const pos = positions.get(n.id)!;
    return { id: n.id, label: n.label, x: pos.x, y: pos.y, community: n.community };
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Export graph as SVG
 */
export async function exportSvg(
  graph: GraphDocument,
  outputPath: string
): Promise<void> {
  const svg = generateSvg(graph);
  await mkdir(join(outputPath, '..'), { recursive: true });
  await writeFile(outputPath, svg, 'utf-8');
}

/**
 * Generate SVG string
 */
export function generateSvg(graph: GraphDocument, width = 1200, height = 900): string {
  const directed = graph.metadata?.directed === true;
  const layoutNodes = layoutGraph(graph.nodes, graph.edges ?? [], width, height);
  const posMap = new Map(layoutNodes.map((n) => [n.id, n]));

  const lines: string[] = [];

  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);

  // Background
  lines.push(`  <rect width="${width}" height="${height}" fill="#0f172a"/>`);

  // Title
  lines.push(`  <text x="${width / 2}" y="30" text-anchor="middle" fill="#e2e8f0" font-family="system-ui,sans-serif" font-size="16" font-weight="600">GraphWiki Knowledge Graph</text>`);
  lines.push(`  <text x="${width / 2}" y="50" text-anchor="middle" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="12">${graph.nodes.length} nodes · ${graph.edges.length} edges${directed ? ' · directed' : ''}</text>`);

  // Edges
  lines.push(`  <g id="edges">`);
  for (const edge of graph.edges) {
    const source = posMap.get(edge.source);
    const target = posMap.get(edge.target);
    if (!source || !target) continue;

    const key = directed ? `${edge.source}->${edge.target}` : `${edge.source}:${edge.target}`;
    const color = '#475569';
    const labelColor = '#94a3b8';

    if (directed) {
      // Arrow marker
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;

      // Shorten to avoid overlap with node circles
      const nodeRadius = 20;
      const sx = source.x + nx * nodeRadius;
      const sy = source.y + ny * nodeRadius;
      const tx = target.x - nx * (nodeRadius + 8);
      const ty = target.y - ny * (nodeRadius + 8);

      lines.push(`    <defs>`);
      lines.push(`      <marker id="arrow-${key.replace(/[^a-zA-Z0-9]/g, '_')}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">`);
      lines.push(`        <polygon points="0 0, 10 3.5, 0 7" fill="${color}"/>`);
      lines.push(`      </marker>`);
      lines.push(`    </defs>`);
      lines.push(`    <line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${tx.toFixed(1)}" y2="${ty.toFixed(1)}" stroke="${color}" stroke-width="1.5" marker-end="url(#arrow-${key.replace(/[^a-zA-Z0-9]/g, '_')})"/>`);
    } else {
      lines.push(`    <line x1="${source.x.toFixed(1)}" y1="${source.y.toFixed(1)}" x2="${target.x.toFixed(1)}" y2="${target.y.toFixed(1)}" stroke="${color}" stroke-width="1.5" opacity="0.7"/>`);
    }

    if (edge.label) {
      const mx = (source.x + target.x) / 2;
      const my = (source.y + target.y) / 2;
      lines.push(`    <text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" text-anchor="middle" fill="${labelColor}" font-family="system-ui,sans-serif" font-size="9">${escapeXml(edge.label)}</text>`);
    }
  }
  lines.push(`  </g>`);

  // Nodes
  lines.push(`  <g id="nodes">`);
  for (const node of layoutNodes) {
    const color = getCommunityColor(node.community);
    lines.push(`    <circle cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="20" fill="${color}" opacity="0.9"/>`);
    lines.push(`    <text x="${node.x.toFixed(1)}" y="${(node.y + 4).toFixed(1)}" text-anchor="middle" fill="#f8fafc" font-family="system-ui,sans-serif" font-size="10" font-weight="500">${escapeXml(node.label.substring(0, 16))}</text>`);
  }
  lines.push(`  </g>`);

  // Legend for communities
  const communities = [...new Set(graph.nodes.map((n) => n.community).filter((c) => c !== undefined))] as number[];
  if (communities.length > 0) {
    const legendX = width - 140;
    let legendY = 80;
    lines.push(`  <g id="legend">`);
    lines.push(`    <text x="${legendX}" y="${legendY}" fill="#e2e8f0" font-family="system-ui,sans-serif" font-size="11" font-weight="600">Communities</text>`);
    legendY += 18;
    for (const comm of communities.slice(0, 8)) {
      lines.push(`    <circle cx="${legendX + 6}" cy="${legendY - 4}" r="6" fill="${getCommunityColor(comm)}"/>`);
      lines.push(`    <text x="${legendX + 18}" y="${legendY}" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="10">${comm}</text>`);
      legendY += 18;
    }
    lines.push(`  </g>`);
  }

  lines.push(`</svg>`);

  return lines.join('\n');
}

/**
 * Export graph to SVG format
 */
export async function exportToSvg(
  graph: GraphDocument,
  outputDir = 'graphwiki-out/exports'
): Promise<string> {
  const outputPath = join(outputDir, 'graph.svg');
  await exportSvg(graph, outputPath);
  return outputPath;
}
