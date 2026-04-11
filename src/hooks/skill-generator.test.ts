import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('process', () => ({
  exit: vi.fn(),
  argv: ['node', 'skill-generator.js', '--check'],
  cwd: vi.fn(() => '/test'),
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockRejectedValue(new Error('File not found')),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

import { parseFrontmatter, parseSections, generateHooksJsonEntries } from './skill-generator.js';

describe('skill-generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseFrontmatter', () => {
    it('parses valid YAML frontmatter', () => {
      const content = `---
name: GraphWiki
version: 2.0
description: A knowledge graph for code
platforms: [claude, codex, gemini]
---

# Content
`;
      const result = parseFrontmatter(content);
      expect(result.name).toBe('GraphWiki');
      expect(result.version).toBe('2.0');
      expect(result.description).toBe('A knowledge graph for code');
      expect(result.platforms).toEqual(['claude', 'codex', 'gemini']);
    });

    it('throws error for missing frontmatter', () => {
      const content = `# No frontmatter
`;
      expect(() => parseFrontmatter(content)).toThrow('Missing YAML frontmatter');
    });

    it('handles platforms array', () => {
      const content = `---
name: Test
version: 1.0
description: Test desc
platforms: [claude, codex]
---
`;
      const result = parseFrontmatter(content);
      expect(result.platforms).toEqual(['claude', 'codex']);
    });

    it('handles platforms array with spaces', () => {
      const content = `---
name: Test
version: 1.0
description: Test
platforms: [ claude , codex ]
---
`;
      const result = parseFrontmatter(content);
      expect(result.platforms).toEqual(['claude', 'codex']);
    });

    it('handles missing optional fields', () => {
      const content = `---
name: Test
---
`;
      const result = parseFrontmatter(content);
      expect(result.name).toBe('Test');
      expect(result.version).toBe('');
      expect(result.description).toBe('');
      expect(result.platforms).toEqual([]);
    });

    it('handles lines without colon', () => {
      const content = `---
name: Test
version: 1.0
# This is a comment line
description: Test desc
---
`;
      const result = parseFrontmatter(content);
      expect(result.name).toBe('Test');
      expect(result.description).toBe('Test desc');
    });
  });

  describe('parseSections', () => {
    it('parses markdown sections by headings', () => {
      const content = `# Section 1

Content of section 1

## Section 2

Content of section 2
`;
      const result = parseSections(content);
      expect(result.get('Section 1')).toBe('Content of section 1');
      expect(result.get('Section 2')).toBe('Content of section 2');
    });

    it('ignores headings inside code blocks', () => {
      const content = `# Section 1

\`\`\`
# Not a real heading
\`\`\`

## Section 2

Real content
`;
      const result = parseSections(content);
      expect(result.get('Section 1')).toContain('# Not a real heading');
      expect(result.get('Section 2')).toBe('Real content');
    });

    it('handles h3 headings', () => {
      const content = `### H3 Section

H3 content
`;
      const result = parseSections(content);
      expect(result.get('H3 Section')).toBe('H3 content');
    });

    it('handles empty content', () => {
      const result = parseSections('');
      expect(result.size).toBe(0);
    });

    it('handles content without headings', () => {
      const content = `Just some plain text without any headings`;
      const result = parseSections(content);
      expect(result.size).toBe(0);
    });

    it('handles multiple code blocks correctly', () => {
      const content = `# Section

\`\`\`js
const x = 1;
\`\`\`

## Another

\`\`\`ts
const y = 2;
\`\`\`
`;
      const result = parseSections(content);
      expect(result.get('Section')).toBeDefined();
      expect(result.get('Another')).toBeDefined();
    });
  });

  describe('generateHooksJsonEntries', () => {
    it('returns valid JSON string', () => {
      const result = generateHooksJsonEntries();

      expect(typeof result).toBe('string');
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('PreToolUse');
      expect(parsed).toHaveProperty('SessionStart');
      expect(parsed).toHaveProperty('PostToolUse');
    });

    it('contains graphwiki commands', () => {
      const result = generateHooksJsonEntries();

      expect(result).toContain('graphwiki-pretool');
      expect(result).toContain('graphwiki-session-start');
      expect(result).toContain('graphwiki-posttool');
    });
  });
});
