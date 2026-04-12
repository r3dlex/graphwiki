import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WikiCompiler } from './compiler.js';
import type { LLMProvider } from '../types.js';
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
  });
});
