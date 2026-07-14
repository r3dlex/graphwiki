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

describe('archgate violation fixture', () => {
  it('loads the committed rule set and rejects a SHA-256 violation', () => {
    const project = mkdtempSync(resolve(tmpdir(), 'graphwiki-archgate-'));
    temporaryProjects.push(project);

    cpSync(resolve('.archgate'), resolve(project, '.archgate'), { recursive: true });
    const builder = resolve(project, 'src/graph/builder.ts');
    mkdirSync(dirname(builder), { recursive: true });
    cpSync(resolve('src/graph/builder.ts'), builder);

    const baseline = runArchgate(project);
    expect(baseline.status, baseline.stderr || baseline.stdout).toBe(0);

    const source = readFileSync(builder, 'utf8');
    expect(source).toMatch(/createHash\(['"]sha256['"]\)/);
    writeFileSync(builder, source.replace(/createHash\(['"]sha256['"]\)/, 'createHash("md5")'));

    const violated = runArchgate(project);
    const output = `${violated.stdout}\n${violated.stderr}`;
    expect(violated.status, output).not.toBe(0);
    expect(output).toContain('gw-graph-001');
  });
});
