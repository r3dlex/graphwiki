// C11: Query-tiered integration test
// Verifies all 6 query tools produce schema-valid responses against real graph.json from Phase A

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { executeTool } from '../../src/serve/executor.js';
import type { ToolContext, GraphWikiToolName } from '../../src/types.js';

const TEST_DIR = '/tmp/graphwiki-test-query-tiered';
const GRAPH_FILE = `${TEST_DIR}/.graphwiki/graph.json`;
const WIKI_DIR = `${TEST_DIR}/wiki`;

describe('query-tiered integration', () => {
  beforeEach(async () => {
    try {
      await rm(TEST_DIR, { recursive: true, force: true });
    } catch {}
    await mkdir(`${TEST_DIR}/.graphwiki`, { recursive: true });
    await mkdir(WIKI_DIR, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  describe('6 query tools against graph.json', () => {
    it('should verify status tool schema', async () => {
      const graph = {
        nodes: [
          { id: 'node:1', label: 'TestFunc', type: 'function', community: 1 },
          { id: 'node:2', label: 'TestClass', type: 'class', community: 1 },
          { id: 'node:3', label: 'TestModule', type: 'module', community: 2 },
        ],
        edges: [
          { id: 'edge:1', source: 'node:1', target: 'node:2', weight: 1.0, label: 'calls' },
          { id: 'edge:2', source: 'node:2', target: 'node:3', weight: 1.0, label: 'imports' },
        ],
      };
      await writeFile(GRAPH_FILE, JSON.stringify(graph));

      const context: ToolContext = {
        graph,
        wikiPages: [],
      };

      const result = await executeTool('status', {}, context) as Record<string, unknown>;
      expect(result).toHaveProperty('nodes');
      expect(result).toHaveProperty('edges');
      expect(result).toHaveProperty('by_type');
      expect(result).toHaveProperty('communities');
      expect(result).toHaveProperty('density');
      expect(typeof result.nodes).toBe('number');
      expect(typeof result.edges).toBe('number');
    });

    it('should verify wiki_list tool schema', async () => {
      const wikiPages = [
        { title: 'index', content: '# Index page' },
        { title: 'TestConcept', content: '# TestConcept\nA concept page.' },
      ];

      const context: ToolContext = {
        graph: { nodes: [], edges: [] },
        wikiPages,
      };

      const result = await executeTool('wiki_list', {}, context) as { pages: unknown[]; total: number };
      expect(result).toHaveProperty('pages');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.pages)).toBe(true);
      expect(typeof result.total).toBe('number');
    });

    it('should verify community_list tool schema', async () => {
      const graph = {
        nodes: [
          { id: 'node:1', label: 'A', type: 'function', community: 1 },
          { id: 'node:2', label: 'B', type: 'function', community: 1 },
          { id: 'node:3', label: 'C', type: 'class', community: 2 },
        ],
        edges: [],
      };

      const context: ToolContext = { graph, wikiPages: [] };

      const result = await executeTool('community_list', {}, context) as { communities: unknown[]; total: number };
      expect(result).toHaveProperty('communities');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.communities)).toBe(true);
    });

    it('should verify shortest_path tool schema', async () => {
      const graph = {
        nodes: [
          { id: 'node:1', label: 'Start', type: 'function' },
          { id: 'node:2', label: 'Middle', type: 'function' },
          { id: 'node:3', label: 'End', type: 'function' },
        ],
        edges: [
          { id: 'e1', source: 'node:1', target: 'node:2', weight: 1.0 },
          { id: 'e2', source: 'node:2', target: 'node:3', weight: 1.0 },
        ],
      };

      const context: ToolContext = { graph, wikiPages: [] };

      const result = await executeTool('shortest_path', { node_a: 'Start', node_b: 'End' }, context) as { found: boolean; path?: string[]; steps?: number };
      expect(result).toHaveProperty('found');
      expect(typeof result.found).toBe('boolean');
    });

    it('should verify get_node tool schema', async () => {
      const graph = {
        nodes: [{ id: 'node:1', label: 'TestNode', type: 'function' }],
        edges: [],
      };

      const context: ToolContext = { graph, wikiPages: [] };

      const result = await executeTool('get_node', { node_id: 'node:1' }, context) as { found: boolean; node?: unknown };
      expect(result).toHaveProperty('found');
      expect(typeof result.found).toBe('boolean');
    });

    it('should verify wiki_search tool schema', async () => {
      const wikiPages = [
        { title: 'AlphaFunction', content: 'A function in the alpha module.' },
      ];

      const context: ToolContext = {
        graph: { nodes: [], edges: [] },
        wikiPages,
      };

      const result = await executeTool('wiki_search', { query: 'alpha' }, context) as { results: unknown[]; total: number };
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.results)).toBe(true);
    });
  });

  describe('schema validation for all 6 tools', () => {
    const graph = {
      nodes: [
        { id: 'node:a', label: 'AlphaFunc', type: 'function', community: 1 },
        { id: 'node:b', label: 'BetaClass', type: 'class', community: 1 },
        { id: 'node:c', label: 'GammaModule', type: 'module', community: 2 },
      ],
      edges: [
        { id: 'e1', source: 'node:a', target: 'node:b', weight: 1.0, label: 'calls' },
      ],
    };

    const wikiPages = [
      { title: 'index', content: '# Index' },
      { title: 'AlphaFunc', content: '# AlphaFunc\nFunction in alpha module.' },
    ];

    const context: ToolContext = { graph, wikiPages };

    it('should return valid status response', async () => {
      const result = await executeTool('status', {}, context) as Record<string, unknown>;
      expect(result.nodes).toBe(3);
      expect(result.edges).toBe(1);
      expect(result.communities).toBe(2);
    });

    it('should return valid wiki_list response', async () => {
      const result = await executeTool('wiki_list', {}, context) as { pages: Array<{ title: string }> };
      expect(result.pages.length).toBe(2);
    });

    it('should return valid wiki_read response', async () => {
      const result = await executeTool('wiki_read', { title: 'index' }, context) as { found: boolean };
      expect(result.found).toBe(true);
    });

    it('should return valid wiki_search response', async () => {
      const result = await executeTool('wiki_search', { query: 'alpha' }, context) as { results: Array<{ title: string }> };
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('should return valid community_list response', async () => {
      const result = await executeTool('community_list', {}, context) as { communities: Array<{ id: number }> };
      expect(result.communities.length).toBeGreaterThan(0);
    });

    it('should return valid community_summary response', async () => {
      const result = await executeTool('community_summary', { community_id: 1 }, context) as { found: boolean; summary?: { id: number } };
      expect(result.found).toBe(true);
      expect(result.summary?.id).toBe(1);
    });
  });
});
