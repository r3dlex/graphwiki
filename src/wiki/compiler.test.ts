import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WikiCompiler } from './compiler.js';
import type { LLMProvider, GraphDocument } from '../types.js';
import type { CommunityMeta } from './types.js';

const mockProvider: LLMProvider = {
  complete: vi.fn(),
  supportedDocumentFormats: () => ['txt', 'md'],
  supportedImageFormats: () => [],
  maxDocumentPages: () => 100,
  maxImageResolution: () => 4096,
  extractFromDocument: vi.fn(),
  extractFromImage: vi.fn(),
};

describe('WikiCompiler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('compileStage1', () => {
    it('should generate section headers and outline from community data', async () => {
      const compiler = new WikiCompiler(mockProvider);
      const community: CommunityMeta = {
        id: 1,
        node_count: 3,
        label: 'Test Community',
      };
      const nodes = [
        { id: 'n1', label: 'Node 1', type: 'concept', community: 1 },
        { id: 'n2', label: 'Node 2', type: 'entity', community: 1 },
        { id: 'n3', label: 'Node 3', type: 'source', community: 1 },
      ];
      const edges = [
        { id: 'e1', source: 'n1', target: 'n2', weight: 1, label: 'relates' },
        { id: 'e2', source: 'n2', target: 'n3', weight: 0.5 },
      ];

      const result = await compiler.compileStage1(community, nodes, edges);

      expect(result.section_headers.length).toBeGreaterThan(0);
      expect(result.outline).toBeTruthy();
      expect(result.tokens_used).toBe(0);
    });
  });

  describe('compileStage2', () => {
    it('should expand a section with content', async () => {
      const compiler = new WikiCompiler(mockProvider);
      const nodes = [
        { id: 'n1', label: 'Node 1', type: 'concept' },
      ];
      const edges: import('../types.js').GraphEdge[] = [];

      const result = await compiler.compileStage2('Concepts', nodes, edges);

      expect(result.section_content).toBeTruthy();
      expect(result.tokens_used).toBe(0);
    });
  });

  describe('compileStage3', () => {
    it('should return source content as deep_content', async () => {
      const compiler = new WikiCompiler(mockProvider);

      const result = await compiler.compileStage3('n1', 'Some source content here');

      expect(result.deep_content).toBe('Some source content here');
      expect(result.source_verified).toBe(true);
      expect(result.tokens_used).toBe(0);
    });
  });

  describe('compileCommunity', () => {
    it('should compile a full community wiki page', async () => {
      const compiler = new WikiCompiler(mockProvider);
      const community: CommunityMeta = {
        id: 1,
        node_count: 2,
        label: 'My Community',
      };
      const nodes = [
        { id: 'n1', label: 'Concept A', type: 'concept', community: 1 },
        { id: 'n2', label: 'Entity B', type: 'entity', community: 1 },
      ];
      const edges = [
        { id: 'e1', source: 'n1', target: 'n2', weight: 1 },
      ];

      const page = await compiler.compileCommunity(community, nodes, edges);

      expect(page.frontmatter.label).toBe('My Community');
      expect(page.frontmatter.community).toBe(1);
      expect(page.content).toContain('# My Community');
    });
  });

  describe('compileAll', () => {
    it('should compile communities in priority order with parallelism', async () => {
      const compiler = new WikiCompiler(mockProvider, { parallel_limit: 2 });
      const communities: CommunityMeta[] = [
        { id: 1, node_count: 2, label: 'Small Community' },
        { id: 2, node_count: 5, label: 'Large Community' },
        { id: 3, node_count: 3, label: 'Medium Community', god_node_ids: ['n1'] },
      ];
      const graph = {
        nodes: [
          { id: 'n1', label: 'N1', type: 'concept', community: 1 },
          { id: 'n2', label: 'N2', type: 'concept', community: 1 },
          { id: 'n3', label: 'N3', type: 'concept', community: 2 },
          { id: 'n4', label: 'N4', type: 'concept', community: 2 },
          { id: 'n5', label: 'N5', type: 'concept', community: 2 },
          { id: 'n6', label: 'N6', type: 'concept', community: 3 },
          { id: 'n7', label: 'N7', type: 'concept', community: 3 },
          { id: 'n8', label: 'N8', type: 'concept', community: 3 },
        ],
        edges: [],
      };

      const pages = await compiler.compileAll(communities, graph);

      expect(pages.length).toBe(3);
      // Large community (most nodes) should be first
      const firstPage = pages[0];
      expect(firstPage).toBeDefined();
      expect(firstPage!.frontmatter.label).toBe('Large Community');
    });

    it('returns one page per community when no wikiDir is given', async () => {
      const compiler = new WikiCompiler(null);
      const communities: CommunityMeta[] = [
        { id: 0, node_count: 1, label: 'Alpha' },
        { id: 1, node_count: 1, label: 'Beta' },
      ];
      const graph: GraphDocument = {
        nodes: [
          { id: 'a', label: 'A', type: 'concept', community: 0 },
          { id: 'b', label: 'B', type: 'concept', community: 1 },
        ],
        edges: [],
      };

      const pages = await compiler.compileAll(communities, graph);

      expect(pages).toHaveLength(2);
      const labels = pages.map((p) => p.frontmatter.label);
      expect(labels).toContain('Alpha');
      expect(labels).toContain('Beta');
    });

    it('sorts by god_node count when node_counts are equal', async () => {
      const compiler = new WikiCompiler(null);
      const communities: CommunityMeta[] = [
        { id: 0, node_count: 2, label: 'Plain' },
        { id: 1, node_count: 2, label: 'HasGods', god_node_ids: ['x', 'y'] },
      ];
      const graph: GraphDocument = {
        nodes: [
          { id: 'a', label: 'A', type: 'concept', community: 0 },
          { id: 'b', label: 'B', type: 'concept', community: 0 },
          { id: 'x', label: 'X', type: 'concept', community: 1 },
          { id: 'y', label: 'Y', type: 'concept', community: 1 },
        ],
        edges: [],
      };

      const pages = await compiler.compileAll(communities, graph);

      expect(pages[0]!.frontmatter.label).toBe('HasGods');
    });

    it('includes source pages when wikiDir is provided', async () => {
      const compiler = new WikiCompiler(null);
      const communities: CommunityMeta[] = [
        { id: 0, node_count: 2, label: 'Src Community' },
      ];
      const graph: GraphDocument = {
        nodes: [
          { id: 'n1', label: 'Foo', type: 'function', community: 0, source_file: 'src/foo.ts' },
          { id: 'n2', label: 'Bar', type: 'function', community: 0, source_file: 'src/foo.ts' },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', weight: 1 },
        ],
      };

      // Use a real temp dir so mkdirSync/writeFileSync work without mocking
      const { mkdtempSync } = await import('fs');
      const { tmpdir } = await import('os');
      const tmpDir = mkdtempSync(`${tmpdir()}/graphwiki-test-`);

      const pages = await compiler.compileAll(communities, graph, tmpDir);

      // 1 community page + 1 source page
      expect(pages).toHaveLength(2);
      const sourcePage = pages.find((p) => p.frontmatter.type === 'source');
      expect(sourcePage).toBeDefined();
      expect(sourcePage!.path).toMatch(/wiki\/sources\//);
    });
  });

  describe('generateSourcePages', () => {
    it('writes one .md file per source_file that has 2+ nodes', async () => {
      const compiler = new WikiCompiler(null);
      const graph: GraphDocument = {
        nodes: [
          { id: 'n1', label: 'Alpha', type: 'function', source_file: 'src/alpha.ts' },
          { id: 'n2', label: 'Beta', type: 'function', source_file: 'src/alpha.ts' },
          { id: 'n3', label: 'Gamma', type: 'class', source_file: 'src/gamma.ts' },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', weight: 1, label: 'calls' },
        ],
      };

      const { mkdtempSync, readdirSync } = await import('fs');
      const { tmpdir } = await import('os');
      const tmpDir = mkdtempSync(`${tmpdir()}/graphwiki-test-`);

      const pages = compiler.generateSourcePages(graph, tmpDir);

      // Only src/alpha.ts has 2+ nodes; src/gamma.ts is pruned
      expect(pages).toHaveLength(1);
      expect(pages[0]!.frontmatter.type).toBe('source');
      expect(pages[0]!.frontmatter.sources).toEqual(['src/alpha.ts']);
      expect(pages[0]!.path).toBe('wiki/sources/src-alpha.md');

      // File must actually exist on disk
      const { existsSync } = await import('fs');
      const { join } = await import('path');
      expect(existsSync(join(tmpDir, 'sources', 'src-alpha.md'))).toBe(true);
    });

    it('returns empty array when no source_file has 2+ nodes', async () => {
      const compiler = new WikiCompiler(null);
      const graph: GraphDocument = {
        nodes: [
          { id: 'n1', label: 'Lone', type: 'concept', source_file: 'src/lone.ts' },
        ],
        edges: [],
      };

      const { mkdtempSync } = await import('fs');
      const { tmpdir } = await import('os');
      const tmpDir = mkdtempSync(`${tmpdir()}/graphwiki-test-`);

      const pages = compiler.generateSourcePages(graph, tmpDir);

      expect(pages).toHaveLength(0);
    });

    it('skips nodes with no source_file', async () => {
      const compiler = new WikiCompiler(null);
      const graph: GraphDocument = {
        nodes: [
          { id: 'n1', label: 'NoSrc1', type: 'concept' },
          { id: 'n2', label: 'NoSrc2', type: 'concept' },
        ],
        edges: [{ id: 'e1', source: 'n1', target: 'n2', weight: 1 }],
      };

      const { mkdtempSync } = await import('fs');
      const { tmpdir } = await import('os');
      const tmpDir = mkdtempSync(`${tmpdir()}/graphwiki-test-`);

      const pages = compiler.generateSourcePages(graph, tmpDir);

      expect(pages).toHaveLength(0);
    });

    it('source page content lists all extracted concepts', async () => {
      const compiler = new WikiCompiler(null);
      const graph: GraphDocument = {
        nodes: [
          { id: 'n1', label: 'FuncOne', type: 'function', source_file: 'lib/util.ts' },
          { id: 'n2', label: 'FuncTwo', type: 'function', source_file: 'lib/util.ts' },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', weight: 0.9, label: 'calls' },
        ],
      };

      const { mkdtempSync } = await import('fs');
      const { tmpdir } = await import('os');
      const tmpDir = mkdtempSync(`${tmpdir()}/graphwiki-test-`);

      const pages = compiler.generateSourcePages(graph, tmpDir);

      expect(pages).toHaveLength(1);
      const content = pages[0]!.content;
      expect(content).toContain('FuncOne');
      expect(content).toContain('FuncTwo');
      expect(content).toContain('## Relationships');
      expect(content).toContain('FuncOne → FuncTwo');
    });

    it('page frontmatter includes created_at timestamp', async () => {
      const compiler = new WikiCompiler(null);
      const graph: GraphDocument = {
        nodes: [
          { id: 'n1', label: 'X', type: 'concept', source_file: 'a.ts' },
          { id: 'n2', label: 'Y', type: 'concept', source_file: 'a.ts' },
        ],
        edges: [],
      };

      const { mkdtempSync } = await import('fs');
      const { tmpdir } = await import('os');
      const tmpDir = mkdtempSync(`${tmpdir()}/graphwiki-test-`);

      const pages = compiler.generateSourcePages(graph, tmpDir);

      expect(pages[0]!.frontmatter.created_at).toBeTruthy();
      expect(new Date(pages[0]!.frontmatter.created_at!).getTime()).not.toBeNaN();
    });
  });

  describe('compileCommunity — frontmatter fields', () => {
    it('sets confidence to high when all edges are EXTRACTED', async () => {
      const compiler = new WikiCompiler(null);
      const community: CommunityMeta = { id: 0, node_count: 2, label: 'HighConf' };
      const nodes = [
        { id: 'a', label: 'A', type: 'concept', community: 0 },
        { id: 'b', label: 'B', type: 'concept', community: 0 },
      ];
      const edges = [
        { id: 'e1', source: 'a', target: 'b', weight: 1, confidence: 'EXTRACTED' as const },
      ];

      const page = await compiler.compileCommunity(community, nodes, edges);

      expect(page.frontmatter.confidence).toBe('high');
    });

    it('sets confidence to low when majority of edges are INFERRED or AMBIGUOUS', async () => {
      const compiler = new WikiCompiler(null);
      const community: CommunityMeta = { id: 0, node_count: 3, label: 'LowConf' };
      const nodes = [
        { id: 'a', label: 'A', type: 'concept', community: 0 },
        { id: 'b', label: 'B', type: 'concept', community: 0 },
        { id: 'c', label: 'C', type: 'concept', community: 0 },
      ];
      const edges = [
        { id: 'e1', source: 'a', target: 'b', weight: 1, confidence: 'INFERRED' as const },
        { id: 'e2', source: 'b', target: 'c', weight: 1, confidence: 'AMBIGUOUS' as const },
      ];

      const page = await compiler.compileCommunity(community, nodes, edges);

      expect(page.frontmatter.confidence).toBe('low');
    });

    it('sets confidence to medium when edge list is empty', async () => {
      const compiler = new WikiCompiler(null);
      const community: CommunityMeta = { id: 0, node_count: 2, label: 'NoEdges' };
      const nodes = [
        { id: 'a', label: 'A', type: 'concept', community: 0 },
        { id: 'b', label: 'B', type: 'concept', community: 0 },
      ];

      const page = await compiler.compileCommunity(community, nodes, []);

      expect(page.frontmatter.confidence).toBe('medium');
    });

    it('sets confidence to medium for mixed EXTRACTED/INFERRED below majority threshold', async () => {
      const compiler = new WikiCompiler(null);
      const community: CommunityMeta = { id: 0, node_count: 3, label: 'Mixed' };
      const nodes = [
        { id: 'a', label: 'A', type: 'concept', community: 0 },
        { id: 'b', label: 'B', type: 'concept', community: 0 },
        { id: 'c', label: 'C', type: 'concept', community: 0 },
      ];
      // 1 INFERRED out of 3 = 33%, below 50% threshold → medium
      const edges = [
        { id: 'e1', source: 'a', target: 'b', weight: 1, confidence: 'EXTRACTED' as const },
        { id: 'e2', source: 'b', target: 'c', weight: 1, confidence: 'EXTRACTED' as const },
        { id: 'e3', source: 'a', target: 'c', weight: 1, confidence: 'INFERRED' as const },
      ];

      const page = await compiler.compileCommunity(community, nodes, edges);

      expect(page.frontmatter.confidence).toBe('medium');
    });

    it('populates sources from node source_file values', async () => {
      const compiler = new WikiCompiler(null);
      const community: CommunityMeta = { id: 0, node_count: 2, label: 'WithSources' };
      const nodes = [
        { id: 'a', label: 'A', type: 'concept', community: 0, source_file: 'src/foo.ts' },
        { id: 'b', label: 'B', type: 'concept', community: 0, source_file: 'src/bar.ts' },
      ];

      const page = await compiler.compileCommunity(community, nodes, []);

      expect(page.frontmatter.sources).toEqual(
        expect.arrayContaining(['src/foo.ts', 'src/bar.ts']),
      );
    });

    it('deduplicates sources when multiple nodes share the same source_file', async () => {
      const compiler = new WikiCompiler(null);
      const community: CommunityMeta = { id: 0, node_count: 2, label: 'DedupSrc' };
      const nodes = [
        { id: 'a', label: 'A', type: 'concept', community: 0, source_file: 'shared.ts' },
        { id: 'b', label: 'B', type: 'concept', community: 0, source_file: 'shared.ts' },
      ];

      const page = await compiler.compileCommunity(community, nodes, []);

      expect(page.frontmatter.sources).toEqual(['shared.ts']);
    });

    it('leaves sources undefined when no node has a source_file', async () => {
      const compiler = new WikiCompiler(null);
      const community: CommunityMeta = { id: 0, node_count: 2, label: 'NoSrc' };
      const nodes = [
        { id: 'a', label: 'A', type: 'concept', community: 0 },
        { id: 'b', label: 'B', type: 'concept', community: 0 },
      ];

      const page = await compiler.compileCommunity(community, nodes, []);

      expect(page.frontmatter.sources).toBeUndefined();
    });

    it('populates created_at with a valid ISO timestamp', async () => {
      const compiler = new WikiCompiler(null);
      const community: CommunityMeta = { id: 0, node_count: 1, label: 'Ts' };
      const nodes = [{ id: 'a', label: 'A', type: 'concept', community: 0 }];

      const page = await compiler.compileCommunity(community, nodes, []);

      expect(page.frontmatter.created_at).toBeTruthy();
      expect(new Date(page.frontmatter.created_at!).getTime()).not.toBeNaN();
    });

    it('populates related with adjacent community labels', async () => {
      const compiler = new WikiCompiler(null);
      const community: CommunityMeta = { id: 0, node_count: 1, label: 'C0' };
      const nodesC0 = [{ id: 'a', label: 'A', type: 'concept', community: 0 }];
      const allNodes = [
        { id: 'a', label: 'A', type: 'concept', community: 0 },
        { id: 'b', label: 'B', type: 'concept', community: 1 },
      ];
      const allEdges = [
        { id: 'e1', source: 'a', target: 'b', weight: 1 },
      ];

      const page = await compiler.compileCommunity(community, nodesC0, [], allNodes, allEdges);

      expect(page.frontmatter.related).toEqual(['community-1']);
    });

    it('leaves related undefined when there are no cross-community edges', async () => {
      const compiler = new WikiCompiler(null);
      const community: CommunityMeta = { id: 0, node_count: 2, label: 'Isolated' };
      const nodes = [
        { id: 'a', label: 'A', type: 'concept', community: 0 },
        { id: 'b', label: 'B', type: 'concept', community: 0 },
      ];
      const edges = [{ id: 'e1', source: 'a', target: 'b', weight: 1 }];

      const page = await compiler.compileCommunity(community, nodes, edges);

      expect(page.frontmatter.related).toBeUndefined();
    });
  });

  describe('compileCommunity — deep mode', () => {
    it('appends node deep-content sections in deep mode', async () => {
      const compiler = new WikiCompiler(null, { mode: 'deep' });
      const community: CommunityMeta = { id: 0, node_count: 2, label: 'Deep' };
      const nodes = [
        { id: 'a', label: 'Alpha Node', type: 'concept', community: 0 },
        { id: 'b', label: 'Beta Node', type: 'concept', community: 0 },
      ];

      const page = await compiler.compileCommunity(community, nodes, []);

      // Each node label should appear as a deep-content subsection
      expect(page.content).toContain('Alpha Node');
      expect(page.content).toContain('Beta Node');
    });

    it('uses plain link format when format is plain', async () => {
      const compiler = new WikiCompiler(null, { format: 'plain' });
      const community: CommunityMeta = { id: 0, node_count: 1, label: 'Plain' };
      const nodes = [{ id: 'a', label: 'My Node', type: 'concept', community: 0 }];

      const page = await compiler.compileCommunity(community, nodes, []);

      expect(page.content).toContain('[My Node](my-node.md)');
      expect(page.content).not.toContain('[[My Node]]');
    });

    it('uses obsidian wikilink format by default', async () => {
      const compiler = new WikiCompiler(null);
      const community: CommunityMeta = { id: 0, node_count: 1, label: 'Obsidian' };
      const nodes = [{ id: 'a', label: 'My Node', type: 'concept', community: 0 }];

      const page = await compiler.compileCommunity(community, nodes, []);

      expect(page.content).toContain('[[My Node]]');
    });
  });

  describe('compileAll — multi-node multi-community graph', () => {
    it('compiles all communities with correct page paths', async () => {
      const compiler = new WikiCompiler(null, { parallel_limit: 2 });
      const communities: CommunityMeta[] = [
        { id: 0, node_count: 2, label: 'Infra' },
        { id: 1, node_count: 2, label: 'API Layer' },
        { id: 2, node_count: 2, label: 'Data Model' },
      ];
      const graph: GraphDocument = {
        nodes: [
          { id: 'n0a', label: 'N0A', type: 'module', community: 0 },
          { id: 'n0b', label: 'N0B', type: 'module', community: 0 },
          { id: 'n1a', label: 'N1A', type: 'function', community: 1 },
          { id: 'n1b', label: 'N1B', type: 'function', community: 1 },
          { id: 'n2a', label: 'N2A', type: 'class', community: 2 },
          { id: 'n2b', label: 'N2B', type: 'class', community: 2 },
        ],
        edges: [
          { id: 'e1', source: 'n0a', target: 'n1a', weight: 1 },
          { id: 'e2', source: 'n1b', target: 'n2a', weight: 1 },
        ],
      };

      const pages = await compiler.compileAll(communities, graph);

      expect(pages).toHaveLength(3);
      for (const page of pages) {
        expect(page.path).toMatch(/^wiki\/.+\.md$/);
        expect(page.frontmatter.created_at).toBeTruthy();
        expect(page.frontmatter.updated_at).toBeTruthy();
        expect(page.frontmatter.tags).toContain('generated');
        expect(page.frontmatter.tags).toContain('graphwiki');
      }
    });

    it('every page content starts with a level-1 heading', async () => {
      const compiler = new WikiCompiler(null);
      const communities: CommunityMeta[] = [
        { id: 0, node_count: 1, label: 'Alpha' },
        { id: 1, node_count: 1, label: 'Beta' },
      ];
      const graph: GraphDocument = {
        nodes: [
          { id: 'a', label: 'A', type: 'concept', community: 0 },
          { id: 'b', label: 'B', type: 'concept', community: 1 },
        ],
        edges: [],
      };

      const pages = await compiler.compileAll(communities, graph);

      for (const page of pages) {
        expect(page.content).toMatch(/^# /);
      }
    });
  });
});
