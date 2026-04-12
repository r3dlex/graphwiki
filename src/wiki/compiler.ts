import type {
  GraphDocument,
  GraphNode,
  GraphEdge,
  LLMProvider,
} from '../types.js';
import type {
  CommunityMeta,
  WikiPage,
  CompilationConfig,
  Stage1Result,
  Stage2Result,
  Stage3Result,
} from './types.js';

const DEFAULT_CONFIG: Required<CompilationConfig> = {
  stage1_budget_in: 1500,
  stage1_budget_out: 800,
  stage2_budget_in: 1000,
  stage2_budget_out: 600,
  stage3_budget_in: 3000,
  stage3_budget_out: 1000,
  parallel_limit: 3,
  mode: 'standard',
  format: 'obsidian',
};

export class WikiCompiler {
  private config: Required<CompilationConfig>;

  constructor(_provider: LLMProvider | null, config: CompilationConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async compileCommunity(
    community: CommunityMeta,
    nodes: GraphNode[],
    edges: GraphEdge[],
  ): Promise<WikiPage> {
    const stage1 = await this.compileStage1(community, nodes, edges);
    const pageName = community.label || `community-${community.id}`;
    const sections: string[] = [];

    for (const header of stage1.section_headers) {
      const stage2 = await this.compileStage2(header, nodes, edges);
      const sectionContent: string[] = [stage2.section_content];

      // In deep mode, run stage3 for every node in the community
      if (this.config.mode === 'deep') {
        const communityNodes = nodes.filter((n) => n.community === community.id);
        for (const node of communityNodes) {
          const stage3 = await this.compileStage3(node.id, node.label);
          const nodeLink = (this.config.format ?? 'obsidian') === 'plain'
            ? `[${node.label}](${node.label.replace(/\s+/g, '-').toLowerCase()}.md)`
            : `[[${node.label}]]`;
          sectionContent.push(`\n### ${nodeLink}\n\n${stage3.deep_content}`);
        }
      }

      sections.push(`## ${header}\n\n${sectionContent.join('\n')}`);
    }

    // Build wikilinks for related nodes in this community
    const communityNodes = nodes.filter((n) => n.community === community.id);
    const relatedLinks = communityNodes
      .map((n) => {
        const link = (this.config.format ?? 'obsidian') === 'plain'
          ? `[${n.label}](${n.label.replace(/\s+/g, '-').toLowerCase()}.md)`
          : `[[${n.label}]]`;
        return `- ${link}`;
      })
      .join('\n');
    const relatedSection = communityNodes.length > 0
      ? `\n\n## Related\n\n${relatedLinks}`
      : '';

    const content = `# ${pageName}\n\n${stage1.outline}\n\n${sections.join('\n\n')}${relatedSection}`;

    // Derive tags from node types and community
    const nodeTypes = [...new Set(communityNodes.map((n) => n.type))];
    const tags: string[] = ['generated', 'graphwiki', ...nodeTypes];
    if (community.id !== undefined) {
      tags.push(`community-${community.id}`);
    }

    return {
      path: `wiki/${pageName.replace(/\s+/g, '-').toLowerCase()}.md`,
      frontmatter: {
        community: community.id,
        label: pageName,
        type: 'community',
        tags,
      },
      content,
    };
  }

  generateCanvas(pages: WikiPage[]): string {
    const GRID_COLS = Math.ceil(Math.sqrt(pages.length || 1));
    const COL_WIDTH = 300;
    const ROW_HEIGHT = 120;

    const canvasNodes = pages.map((page, i) => {
      const col = i % GRID_COLS;
      const row = Math.floor(i / GRID_COLS);
      const fileName = page.path.startsWith('wiki/')
        ? page.path.slice(5)
        : page.path;
      return {
        id: page.frontmatter.label.replace(/\s+/g, '-').toLowerCase(),
        type: 'file',
        file: fileName,
        x: col * COL_WIDTH,
        y: row * ROW_HEIGHT,
        width: 250,
        height: 60,
      };
    });

    return JSON.stringify({ nodes: canvasNodes, edges: [] }, null, 2);
  }

  async compileStage1(
    community: CommunityMeta,
    nodes: GraphNode[],
    edges: GraphEdge[],
  ): Promise<Stage1Result> {
    const communityNodes = nodes.filter((n) => n.community === community.id);
    const communityEdges = edges.filter(
      (e) =>
        communityNodes.some((n) => n.id === e.source) &&
        communityNodes.some((n) => n.id === e.target),
    );

    // Group nodes by type to create section headers
    const typeGroups = new Map<string, GraphNode[]>();
    for (const node of communityNodes) {
      const type = node.type ?? 'unknown';
      if (!typeGroups.has(type)) typeGroups.set(type, []);
      typeGroups.get(type)!.push(node);
    }

    const section_headers = [...typeGroups.keys()].map((type) => {
      // Capitalize and naive pluralize
      const cap = type.charAt(0).toUpperCase() + type.slice(1);
      return cap.endsWith('s') ? cap : `${cap}s`;
    });

    const outline = `Community ${community.label || community.id} contains ${communityNodes.length} nodes and ${communityEdges.length} edges`;

    return {
      section_headers: section_headers.length > 0 ? section_headers : ['Overview'],
      outline,
      tokens_used: 0,
    };
  }

  async compileStage2(
    sectionHeader: string,
    nodes: GraphNode[],
    edges: GraphEdge[],
  ): Promise<Stage2Result> {
    // Derive the type from the section header (reverse of pluralize/capitalize)
    const derivedType = sectionHeader.replace(/s$/i, '').toLowerCase();
    const matchingNodes = nodes.filter((n) => (n.type ?? '').toLowerCase() === derivedType);

    const nodeEntries = matchingNodes.map((node) => {
      const snippet = typeof node.properties?.['content'] === 'string'
        ? (node.properties['content'] as string).substring(0, 200)
        : node.label;
      const nodeEdges = edges.filter((e) => e.source === node.id || e.target === node.id);
      const relList = nodeEdges
        .map((e) => `  - ${e.source} --${e.label || 'related'}--> ${e.target}`)
        .join('\n');
      return `### ${node.label}\n\n${snippet}${relList ? `\n\nRelationships:\n${relList}` : ''}`;
    });

    return {
      section_content: nodeEntries.join('\n\n') || `No ${sectionHeader.toLowerCase()} found.`,
      tokens_used: 0,
    };
  }

  async compileStage3(_nodeId: string, sourceContent: string): Promise<Stage3Result> {
    return {
      deep_content: sourceContent,
      source_verified: true,
      tokens_used: 0,
    };
  }

  async compileAll(
    communities: CommunityMeta[],
    graph: GraphDocument,
  ): Promise<WikiPage[]> {
    // Sort by priority: highest node count first, then god nodes, then dependency order
    const sorted = [...communities].sort((a, b) => {
      if (b.node_count !== a.node_count) return b.node_count - a.node_count;
      const aGods = a.god_node_ids?.length ?? 0;
      const bGods = b.god_node_ids?.length ?? 0;
      if (bGods !== aGods) return bGods - aGods;
      return (a.dependency_order ?? a.id) - (b.dependency_order ?? b.id);
    });

    const results: WikiPage[] = [];
    const limit = this.config.parallel_limit;

    for (let i = 0; i < sorted.length; i += limit) {
      const batch = sorted.slice(i, i + limit);
      const pages = await Promise.all(
        batch.map((community) => {
          const communityNodes = graph.nodes.filter(
            (n) => n.community === community.id,
          );
          const communityEdges = graph.edges.filter(
            (e) =>
              communityNodes.some((n) => n.id === e.source) &&
              communityNodes.some((n) => n.id === e.target),
          );
          return this.compileCommunity(community, communityNodes, communityEdges);
        }),
      );
      results.push(...pages);
    }

    return results;
  }
}
