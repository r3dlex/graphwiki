import matter from 'gray-matter';
import type { GraphNode, GraphEdge } from '../types.js';

export function extractFromMarkdown(
  content: string,
  sourcePath: string,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const { data: frontmatter, content: body } = matter(content);
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const docId = sourcePath.replace(/[^a-zA-Z0-9]/g, '_');

  // Document node
  const title = (frontmatter['title'] as string) ?? sourcePath.split('/').pop() ?? sourcePath;
  nodes.push({
    id: docId,
    type: 'document',
    label: title,
    properties: { ...frontmatter, content: body.substring(0, 500) },
    provenance: [sourcePath],
  });

  // Heading nodes
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let match;
  let headingIndex = 0;
  while ((match = headingRegex.exec(body)) !== null) {
    const level = match[1]!.length;
    const text = match[2]!.trim();
    const headingId = `${docId}-h${headingIndex++}`;
    nodes.push({
      id: headingId,
      type: 'concept',
      label: text,
      properties: { level, source: sourcePath },
      provenance: [sourcePath],
    });
    edges.push({
      id: `${docId}-defines-${headingId}`,
      source: docId,
      target: headingId,
      weight: 1.0,
      label: 'defines',
    });
  }

  // Wikilink edges: [[target]]
  const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
  while ((match = wikilinkRegex.exec(body)) !== null) {
    const target = match[1]!.split('|')[0]!.trim();
    const targetId = target.replace(/[^a-zA-Z0-9]/g, '_');
    edges.push({
      id: `${docId}-references-${targetId}`,
      source: docId,
      target: targetId,
      weight: 0.8,
      label: 'references',
    });
  }

  // Markdown link edges: [text](url)
  const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  while ((match = mdLinkRegex.exec(body)) !== null) {
    const url = match[2]!;
    if (!url.startsWith('http')) {
      const targetId = url.replace(/[^a-zA-Z0-9]/g, '_');
      edges.push({
        id: `${docId}-references-${targetId}`,
        source: docId,
        target: targetId,
        weight: 0.6,
        label: 'references',
      });
    }
  }

  return { nodes, edges };
}
