import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf8');

describe('CI archgate runner routing', () => {
  it('uses self-hosted archgate only on supported X64 runners', () => {
    expect(workflow).toMatch(
      /- name: Initialize archgate project\n\s+if: runner\.arch == 'X64'\n\s+run: pnpm exec archgate init/
    );
    expect(workflow).toMatch(
      /- name: Run archgate check\n\s+if: runner\.arch == 'X64'\n\s+run: pnpm exec archgate check --ci/
    );
  });

  it('routes unsupported self-hosted runners to the hosted fallback', () => {
    expect(workflow).toMatch(
      /- id: mark\n\s+if: runner\.arch == 'X64' && success\(\)\n\s+run: echo "passed=true"/
    );
    expect(workflow).toContain("if: needs._archgate-self-hosted.outputs.passed != 'true'");
  });
});
