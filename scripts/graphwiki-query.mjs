#!/usr/bin/env node
/**
 * GraphWiki Query Hook
 * Query the knowledge graph.
 *
 * Integration: hooks.json command -> node run.cjs scripts/graphwiki-query.mjs
 * Input: { cwd, directory, query, ... }
 * Output: { continue: true }
 */

import { spawn } from 'child_process';
import { readStdin } from '../lib/stdin.mjs';

const GRAPHWIKI_CLI = process.env.GRAPHWIKI_CLI ?? 'graphwiki';
const PROJECT_ROOT = process.env.GRAPHWIKI_PROJECT_ROOT ?? '.';

function spawnGraphwiki(args, timeoutMs = 10000) {
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

  const query = event?.query;
  if (!query) {
    console.error('[GraphWiki] No query provided');
    process.stdout.write(JSON.stringify({ continue: true }) + '\n');
    return;
  }

  console.error('[GraphWiki] Querying graph:', query);
  const result = await spawnGraphwiki(['query', query], 10000);

  if (result.exitCode !== 0) {
    console.error('[GraphWiki] Query failed:', result.stderr);
  } else {
    console.log(result.stdout);
  }

  process.stdout.write(JSON.stringify({ continue: true }) + '\n');
}

main();
