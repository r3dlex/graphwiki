import { describe, it, expect } from 'vitest';
import { extractFromMarkdown } from './frontmatter-extractor.js';

describe('extractFromMarkdown', () => {
  it('empty markdown produces 1 document node, 0 edges', () => {
    const { nodes, edges } = extractFromMarkdown('', 'test/empty.md');
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.type).toBe('document');
    expect(edges).toHaveLength(0);
  });

  it('uses frontmatter title as label', () => {
    const content = '---\ntitle: My Doc\n---\nHello';
    const { nodes } = extractFromMarkdown(content, 'test/doc.md');
    expect(nodes[0]!.label).toBe('My Doc');
  });

  it('uses filename as label when no frontmatter title', () => {
    const { nodes } = extractFromMarkdown('Hello', 'test/my-file.md');
    expect(nodes[0]!.label).toBe('my-file.md');
  });

  it('creates concept nodes and defines edges for headings', () => {
    const content = '# Intro\n\n## Section A\n\n### Sub';
    const { nodes, edges } = extractFromMarkdown(content, 'doc.md');
    const concepts = nodes.filter(n => n.type === 'concept');
    expect(concepts).toHaveLength(3);
    const definesEdges = edges.filter(e => e.label === 'defines');
    expect(definesEdges).toHaveLength(3);
  });

  it('creates references edges for wikilinks', () => {
    const content = 'See [[Other Page]] and [[Another|alias]]';
    const { edges } = extractFromMarkdown(content, 'doc.md');
    const refs = edges.filter(e => e.label === 'references' && e.weight === 0.8);
    expect(refs).toHaveLength(2);
  });

  it('creates references edges for local markdown links, ignores http', () => {
    const content = 'See [local](./other.md) and [external](https://example.com)';
    const { edges } = extractFromMarkdown(content, 'doc.md');
    const refs = edges.filter(e => e.label === 'references' && e.weight === 0.6);
    expect(refs).toHaveLength(1);
  });
});
