import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8');

describe('README runtime contract', () => {
  it('uses the supported full build path for first and repeat builds', () => {
    expect(readme).toContain('graphwiki build .\ngraphwiki status');
    expect(readme).not.toContain('--update');
    expect(readme).not.toContain('--resume');
  });

  it('does not advertise unconnected ONNX or MCP server behavior', () => {
    expect(readme).not.toContain('--no-onnx');
    expect(readme).not.toContain('graphwiki serve');
    expect(readme).not.toContain('MCP transports');
    expect(readme).not.toContain('The server supports stdio and HTTP MCP transports.');
  });

  it('distinguishes UTF-8 file ingest from build-time PDF prompts', () => {
    expect(readme).toContain('graphwiki ingest notes.md');
    expect(readme).not.toContain('graphwiki ingest raw/api.pdf');
    expect(readme).toContain('do not pass a binary PDF to');
    expect(readme).toContain('build-time discovery writes the prompt under');
  });
});
