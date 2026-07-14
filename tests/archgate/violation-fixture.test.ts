/**
 * Behavioral contract: committed Archgate rules must reject a known violation.
 */

import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const archgate = resolve(process.cwd(), 'node_modules/.bin/archgate');
const temporaryProjects: string[] = [];

afterEach(() => {
  for (const project of temporaryProjects.splice(0)) {
    rmSync(project, { recursive: true, force: true });
  }
});

function runArchgate(cwd: string) {
  return spawnSync(archgate, ['check', '--ci'], {
    cwd,
    encoding: 'utf8',
    timeout: 60_000,
  });
}

function createProject(): string {
  const project = mkdtempSync(resolve(tmpdir(), 'graphwiki-archgate-'));
  temporaryProjects.push(project);
  cpSync(resolve('.archgate'), resolve(project, '.archgate'), { recursive: true });
  cpSync(resolve('src'), resolve(project, 'src'), { recursive: true });
  return project;
}

function expectViolation(project: string, rule: string): void {
  const violated = runArchgate(project);
  const output = `${violated.stdout}\n${violated.stderr}`;
  expect(violated.status, output).not.toBe(0);
  expect(output).toContain(rule);
}

describe('archgate violation fixture', () => {
  it('loads the committed rule set and rejects a SHA-256 violation', () => {
    const project = createProject();
    const builder = resolve(project, 'src/graph/builder.ts');

    const baseline = runArchgate(project);
    expect(baseline.status, baseline.stderr || baseline.stdout).toBe(0);

    const source = readFileSync(builder, 'utf8');
    expect(source).toMatch(/createHash\(['"]sha256['"]\)/);
    writeFileSync(builder, source.replace(/createHash\(['"]sha256['"]\)/, 'createHash("md5")'));

    expectViolation(project, 'gw-graph-001');
  });

  it('checks generated pages under the CLI default wiki directory', () => {
    const project = createProject();
    const page = resolve(project, 'graphwiki-out/wiki/broken.md');
    mkdirSync(dirname(page), { recursive: true });
    writeFileSync(page, 'No frontmatter. [[does-not-exist]]\n');

    const violated = runArchgate(project);
    const output = `${violated.stdout}\n${violated.stderr}`;
    expect(violated.status, output).not.toBe(0);
    expect(output).toContain('gw-wiki-001');
    expect(output).toContain('gw-wiki-003');
  });

  it('rejects writes to raw input through normal path construction', () => {
    const project = createProject();
    writeFileSync(
      resolve(project, 'src/raw-write-probe.ts'),
      "import { writeFileSync } from 'node:fs';\nimport { join } from 'node:path';\nwriteFileSync(join('raw', 'probe.txt'), 'mutated');\n"
    );

    expectViolation(project, 'gw-wiki-002');
  });

  it('fails closed when a required policy input disappears', () => {
    const project = createProject();
    rmSync(resolve(project, 'src/graph/builder.ts'));

    expectViolation(project, 'gw-graph-001');
  });
});
