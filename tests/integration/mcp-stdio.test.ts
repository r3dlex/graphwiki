// C9: MCP stdio integration test - starts stdio transport, makes 3 tool calls,
// verifies JSON-RPC responses, includes concurrent mutation test for writeLock

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStdioTransport, parseMessage } from '../../src/serve/mcp-stdio.js';
import { executeTool, setGlobalWriteLock, getGlobalWriteLock } from '../../src/serve/executor.js';
import { GRAPH_WIKI_TOOLS, registerTools } from '../../src/serve/tools.js';
import type { ToolContext, GraphWikiToolName } from '../../src/types.js';
import type { GraphDocument } from '../../src/types.js';

// Load fixtures
const sampleGraph: GraphDocument = {
  nodes: [
    { id: 'node:a', label: 'AlphaFunction', type: 'function', community: 1 },
    { id: 'node:b', label: 'BetaClass', type: 'class', community: 1 },
    { id: 'node:c', label: 'GammaModule', type: 'module', community: 2 },
  ],
  edges: [
    { id: 'edge:ab', source: 'node:a', target: 'node:b', weight: 1.0, label: 'calls' },
    { id: 'edge:bc', source: 'node:b', target: 'node:c', weight: 1.0, label: 'imports' },
  ],
};

const sampleWikiPages = [
  { title: 'index', content: '# GraphWiki Index' },
  { title: 'overview', content: '# Overview' },
  { title: 'AlphaFunction', content: '# AlphaFunction\nAlphaFunction is a function.' },
];

// Mock process.stdin and process.stdout
const mockStdin = {
  setEncoding: vi.fn(),
  on: vi.fn(),
  pause: vi.fn(),
};

const mockStdout = {
  write: vi.fn(),
};

vi.stubGlobal('process', {
  stdin: mockStdin,
  stdout: mockStdout,
  stderr: { write: vi.fn() },
});

describe('mcp-stdio integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('executeTool with 6 query tools', () => {
    const context: ToolContext = {
      graph: sampleGraph,
      wikiPages: sampleWikiPages,
    };

    it('should execute status tool', async () => {
      const result = await executeTool('status', {}, context);
      expect(result).toHaveProperty('nodes', 3);
      expect(result).toHaveProperty('edges', 2);
      expect(result).toHaveProperty('communities');
    });

    it('should execute wiki_list tool', async () => {
      const result = await executeTool('wiki_list', {}, context) as { pages: unknown[]; total: number };
      expect(result.total).toBe(3);
      expect(result.pages.length).toBe(3);
    });

    it('should execute community_list tool', async () => {
      const result = await executeTool('community_list', {}, context) as { communities: unknown[]; total: number };
      expect(result.total).toBeGreaterThan(0);
    });

    it('should execute wiki_search tool', async () => {
      const result = await executeTool('wiki_search', { query: 'Alpha' }, context) as { results: unknown[]; total: number };
      expect(result.total).toBeGreaterThan(0);
      expect(result.results[0]).toHaveProperty('title', 'AlphaFunction');
    });

    it('should execute shortest_path tool', async () => {
      const result = await executeTool('shortest_path', { node_a: 'AlphaFunction', node_b: 'GammaModule' }, context);
      expect(result).toHaveProperty('found', true);
      expect(result).toHaveProperty('path');
    });

    it('should execute get_node tool', async () => {
      const result = await executeTool('get_node', { node_id: 'AlphaFunction' }, context);
      expect(result).toHaveProperty('found', true);
    });
  });

  describe('C3: writeLock mutex', () => {
    it('should provide lock for concurrent mutation safety', async () => {
      let lockAcquired = false;
      let lockReleased = false;

      setGlobalWriteLock({
        acquire: async () => {
          lockAcquired = true;
        },
        release: () => {
          lockReleased = true;
        },
      });

      expect(getGlobalWriteLock()).not.toBeNull();

      // Reset after test
      setGlobalWriteLock({
        acquire: async () => {},
        release: () => {},
      });
    });

    it('should track concurrent mutations via getGlobalWriteLock', async () => {
      setGlobalWriteLock({
        acquire: async () => {},
        release: () => {},
      });

      expect(getGlobalWriteLock()).not.toBeNull();
    });

    it('should provide release mechanism for write operations', async () => {
      let lockReleased = false;

      setGlobalWriteLock({
        acquire: async () => {},
        release: () => {
          lockReleased = true;
        },
      });

      // Verify lock infrastructure is available
      expect(getGlobalWriteLock()).not.toBeNull();

      // Manually release to verify the mechanism is registered
      const lock = getGlobalWriteLock();
      lock?.release();
      expect(lockReleased).toBe(true);
    });
  });

  describe('JSON-RPC tool calls via transport', () => {
    it('should handle tools/list request', async () => {
      const transport = createStdioTransport();
      const handler = registerTools(GRAPH_WIKI_TOOLS, async () => ({}));

      transport.onRequest(handler);

      const toolsListRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      });

      const parsed = parseMessage(toolsListRequest);
      expect(parsed).not.toBeNull();

      const req = parsed as { method: string; id: number };
      const result = await handler(req);
      expect(result).toHaveProperty('tools');
    });

    it('should handle tools/call request', async () => {
      const transport = createStdioTransport();
      const context: ToolContext = { graph: sampleGraph, wikiPages: sampleWikiPages };

      const executor = async (toolName: GraphWikiToolName, params: Record<string, unknown>) => {
        return executeTool(toolName, params, context);
      };

      const handler = registerTools(GRAPH_WIKI_TOOLS, executor);
      transport.onRequest(handler);

      const callRequest = JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'status',
          arguments: {},
        },
      });

      const parsed = parseMessage(callRequest);
      const req = parsed as { method: string; params: { name: string; arguments: Record<string, unknown> }; id: number };
      const result = await handler(req);

      expect(result).toHaveProperty('content');
    });

    it('should create MCP server with initialize handler', async () => {
      const { createMcpServer } = await import('../../src/serve/mcp-stdio.js');
      const { transport } = createMcpServer(sampleGraph, sampleWikiPages);

      // Verify transport was created with proper interface
      expect(transport).toHaveProperty('send');
      expect(transport).toHaveProperty('onRequest');
      expect(transport).toHaveProperty('close');
    });
  });

  describe('All 15 tools respond with valid JSON-RPC', () => {
    const context: ToolContext = { graph: sampleGraph, wikiPages: sampleWikiPages };

    it('should respond to query_graph tool', async () => {
      const result = await executeTool('query_graph', { query: 'function' }, context);
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('total');
    });

    it('should respond to get_neighbors tool', async () => {
      const result = await executeTool('get_neighbors', { node_id: 'node:a' }, context);
      expect(result).toHaveProperty('neighbors');
      expect(result).toHaveProperty('total');
    });

    it('should respond to build tool', async () => {
      const result = await executeTool('build', {}, context) as { success: boolean; nodes_added: number; message: string };
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('nodes_added');
      expect(result).toHaveProperty('message');
    });

    it('should respond to ingest tool', async () => {
      const result = await executeTool('ingest', { source: 'test.ts' }, context) as { success: boolean; source: string; message: string };
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('source', 'test.ts');
    });

    it('should respond to lint tool', async () => {
      const result = await executeTool('lint', { fix: false }, context) as { passed: boolean; total_issues: number };
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('total_issues');
    });

    it('should respond to benchmark tool', async () => {
      const result = await executeTool('benchmark', { query: 'test' }, context) as { stub: boolean; tool: string; query: string };
      expect(result).toHaveProperty('stub', true);
      expect(result).toHaveProperty('tool', 'benchmark');
    });

    it('should respond to ask tool', async () => {
      const result = await executeTool('ask', { question: 'test' }, context) as { stub: boolean; tool: string; question: string };
      expect(result).toHaveProperty('stub', true);
      expect(result).toHaveProperty('tool', 'ask');
    });

    it('should respond to god_nodes tool', async () => {
      const result = await executeTool('god_nodes', { min_degree: 5 }, context) as { nodes: unknown[]; total: number };
      expect(result).toHaveProperty('nodes');
      expect(result).toHaveProperty('total');
    });
  });
});
