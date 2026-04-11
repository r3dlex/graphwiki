#!/usr/bin/env node
/**
 * GraphWiki Lint Errors Hook
 * Runs lint check and reports errors.
 *
 * Integration: hooks.json command -> node run.cjs scripts/graphwiki-lint-errors.mjs
 * Input: { cwd, directory, ... }
 * Output: { continue: true }
 */

import { spawn } from 'child_process';
import { readStdin } from '../lib/stdin.mjs';

const GRAPHWIKI_CLI = process.env.GRAPHWIKI_CLI ?? 'graphwiki';
const PROJECT_ROOT = process.env.GRAPHWIKI_PROJECT_ROOT ?? '.';

function spawnGraphwiki(args, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const proc = spawn(GRAPHWIKI_CLI, args, { cwd: PROJECT_ROOT });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });
    proc.on('close', (code) => resolve({ stdout, stderr, exitCode: code ?? 0 }));
    proc.on('error', (err) => resolve({ stdout: '', stderr: err.message, exitCode: 1 }));
    setTimeout(() => {
      try { proc.kill(); } catch {}
      resolve({ stdout, stderr, exitCode: 124 });
    }, timeoutMs);
  });
}

async function main() {
  let event;
  try {
    const raw = await readStdin();
    event = JSON.parse(raw.trim());
  } catch {
    process.stdout.write(JSON.stringify({ continue: true }) + '\n');
    return;
  }

  console.error('[GraphWiki] Running lint check...');
  const result = await spawnGraphwiki(['lint'], 30000);

  if (result.exitCode !== 0) {
    console.error('[GraphWiki] Lint errors found:', result.stdout);
  } else {
    console.error('[GraphWiki] Lint passed');
  }

  process.stdout.write(JSON.stringify({ continue: true }) + '\n');
}

main();
