#!/usr/bin/env node
/**
 * GraphWiki Build Report Hook
 * Runs build and generates a detailed report.
 *
 * Integration: hooks.json command -> node run.cjs scripts/graphwiki-build-report.mjs
 * Input: { cwd, directory, ... }
 * Output: { continue: true }
 */

import { spawn } from 'child_process';
import { readStdin } from '../lib/stdin.mjs';

const GRAPHWIKI_CLI = process.env.GRAPHWIKI_CLI ?? 'graphwiki';
const PROJECT_ROOT = process.env.GRAPHWIKI_PROJECT_ROOT ?? '.';

function spawnGraphwiki(args, timeoutMs = 120000) {
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

  const targetDir = event?.directory || event?.cwd || PROJECT_ROOT;

  console.error('[GraphWiki] Building graph with report from:', targetDir);
  const buildResult = await spawnGraphwiki(['build', targetDir, '--report'], 120000);

  if (buildResult.exitCode !== 0) {
    console.error('[GraphWiki] Build failed:', buildResult.stderr);
  } else {
    console.error('[GraphWiki] Build complete, generating report...');
    const reportResult = await spawnGraphwiki(['export', 'report'], 30000);
    if (reportResult.exitCode !== 0) {
      console.error('[GraphWiki] Report generation failed');
    } else {
      console.log(reportResult.stdout);
    }
  }

  process.stdout.write(JSON.stringify({ continue: true }) + '\n');
}

main();
