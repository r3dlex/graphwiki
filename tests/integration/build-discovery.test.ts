import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface GraphDocument {
  nodes: Array<{ id: string; source_file?: string }>;
  edges: Array<{ id: string }>;
}

const repoRoot = resolve(import.meta.dirname, '../..');
const cliPath = join(repoRoot, 'dist/cli.js');

function build(projectRoot: string): string {
  return execFileSync(
    process.execPath,
    [cliPath, 'build', '.'],
    { cwd: projectRoot, encoding: 'utf8' },
  );
}

function buildFrom(cwd: string, projectRoot: string): string {
  return execFileSync(
    process.execPath,
    [cliPath, 'build', projectRoot],
    { cwd, encoding: 'utf8' },
  );
}

function readGraph(projectRoot: string): GraphDocument {
  return JSON.parse(
    readFileSync(join(projectRoot, 'graphwiki-out', 'graph.json'), 'utf8'),
  ) as GraphDocument;
}

describe('build file discovery', () => {
  it('keeps two unchanged full builds free of generated nodes and edges', () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'graphwiki-build-idempotent-'));
    writeFileSync(join(projectRoot, 'source.md'), '# Source\n\n## Stable concept\n');

    build(projectRoot);
    const first = readGraph(projectRoot);
    build(projectRoot);
    const second = readGraph(projectRoot);

    expect(second).toEqual(first);
    expect(second.nodes.some((node) => node.source_file?.startsWith('graphwiki-out/'))).toBe(false);
    expect(second.edges).toEqual(first.edges);
  });

  it.each([
    ['a custom wiki root', 'generated/wiki'],
    ['a wiki root nested under raw input', 'raw/generated/wiki'],
    ['square brackets in the wiki root', 'generated/[wiki]'],
    ['an asterisk in the wiki root', 'generated/star*wiki'],
    ['a question mark in the wiki root', 'generated/what?wiki'],
    ['a backslash in the wiki root', 'generated/back\\slash'],
  ])('does not re-ingest generated pages from %s', (_label, wikiRoot) => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'graphwiki-build-custom-wiki-'));
    const configDir = join(projectRoot, '.graphwiki');
    mkdirSync(configDir);
    writeFileSync(
      join(configDir, 'config.json'),
      JSON.stringify({ paths: { wiki: wikiRoot } }),
    );
    writeFileSync(join(projectRoot, 'source.md'), '# Source\n\n## Stable concept\n');

    build(projectRoot);
    const first = readGraph(projectRoot);
    writeFileSync(join(projectRoot, wikiRoot, 'generated.md'), '# Generated\n\n## Must stay excluded\n');
    build(projectRoot);
    const second = readGraph(projectRoot);

    expect(second).toEqual(first);
    expect(second.nodes.some((node) => node.source_file?.startsWith(`${wikiRoot}/`))).toBe(false);
  });

  it('loads configuration relative to an explicit build path', () => {
    const parentRoot = mkdtempSync(join(tmpdir(), 'graphwiki-build-from-parent-'));
    const projectRoot = join(parentRoot, 'target');
    const configDir = join(projectRoot, '.graphwiki');
    const callerPendingDir = join(parentRoot, '.graphwiki', 'pending');
    mkdirSync(configDir, { recursive: true });
    mkdirSync(callerPendingDir, { recursive: true });
    writeFileSync(
      join(configDir, 'config.json'),
      JSON.stringify({ paths: { wiki: 'generated/wiki' } }),
    );
    writeFileSync(join(projectRoot, 'source.md'), '# Source\n\n## Stable concept\n');
    writeFileSync(join(projectRoot, 'manual.pdf'), '%PDF-1.4 test fixture');
    writeFileSync(
      join(callerPendingDir, 'unrelated.result.json'),
      JSON.stringify({
        nodes: [{ id: 'alien-from-cwd', type: 'concept', label: 'Alien', source_file: 'unrelated.md' }],
        edges: [],
      }),
    );

    buildFrom(parentRoot, projectRoot);
    const first = readGraph(projectRoot);
    writeFileSync(join(projectRoot, 'generated/wiki/generated.md'), '# Generated\n\n## Must stay excluded\n');
    buildFrom(parentRoot, projectRoot);
    const second = readGraph(projectRoot);

    expect(second).toEqual(first);
    expect(second.nodes.some((node) => node.id === 'alien-from-cwd')).toBe(false);
    expect(second.nodes.some((node) => node.source_file?.startsWith('generated/wiki/'))).toBe(false);
    expect(existsSync(join(projectRoot, '.graphwiki', 'batch', 'batch-state.json'))).toBe(true);
    expect(existsSync(join(projectRoot, '.graphwiki', 'pending', 'manual.pdf.prompt.md'))).toBe(true);
    expect(existsSync(join(parentRoot, '.graphwiki', 'batch'))).toBe(false);
    expect(existsSync(join(parentRoot, '.graphwiki', '.lock'))).toBe(false);
    expect(existsSync(join(callerPendingDir, 'manual.pdf.prompt.md'))).toBe(false);
  });

  it('discovers raw markdown and PDF inputs exactly once', () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'graphwiki-build-raw-'));
    const rawDir = join(projectRoot, 'raw');
    mkdirSync(rawDir);
    writeFileSync(join(rawDir, 'notes.md'), '# Notes\n\n## One concept\n');
    writeFileSync(join(rawDir, 'manual.pdf'), '%PDF-1.4 test fixture');

    const output = build(projectRoot);
    const graph = readGraph(projectRoot);

    expect(graph.nodes.filter((node) => node.source_file === 'raw/notes.md')).toHaveLength(3);
    expect(output).toContain('[GraphWiki] Generated 1 extraction prompts');
    expect(output).not.toContain('[GraphWiki] Generated 2 extraction prompts');
  });
});
