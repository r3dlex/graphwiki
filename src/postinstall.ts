#!/usr/bin/env node
// GraphWiki postinstall script — runs after npm install
// Skips auto-install in non-interactive (CI/pipe) environments
import { createInterface } from 'readline';
import { mkdir, writeFile } from 'fs/promises';
import { detectPlatforms, installSkill } from './hooks/skill-installer.js';

async function askYesNo(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() !== 'n');
    });
  });
}

async function runPostInstall(): Promise<void> {
  if (!process.stdout.isTTY) {
    console.log('[GraphWiki] Non-interactive environment detected, skipping skill auto-install. Run "graphwiki skill install" manually.');
    return;
  }
  if (process.env.GRAPHWIKI_SKIP_POSTINSTALL) {
    console.log('[GraphWiki] GRAPHWIKI_SKIP_POSTINSTALL set, skipping skill auto-install.');
    return;
  }

  try {
    const platforms = await detectPlatforms();
    if (platforms.length === 0) {
      console.log('[GraphWiki] No supported AI platforms detected. Run "graphwiki skill install" to install manually.');
      return;
    }

    const installed: string[] = [];

    if (process.env.GRAPHWIKI_AUTO_INSTALL === '1') {
      console.log('[GraphWiki] Auto-installing for all detected platforms...');
      for (const platform of platforms) {
        await installSkill(platform);
        installed.push(platform);
        console.log(`[GraphWiki] Skill installed for ${platform}`);
      }
    } else {
      for (const platform of platforms) {
        const yes = await askYesNo(`Install GraphWiki skill for ${platform}? (Y/n) `);
        if (yes) {
          await installSkill(platform);
          installed.push(platform);
          console.log(`[GraphWiki] Skill installed for ${platform}`);
        } else {
          console.log(`[GraphWiki] Skipped ${platform}`);
        }
      }
    }

    if (installed.length > 0) {
      await mkdir('.graphwiki', { recursive: true });
      await writeFile(
        '.graphwiki/installed-platforms.json',
        JSON.stringify({ platforms: installed, installed_at: new Date().toISOString() }, null, 2),
        'utf-8'
      );
    }
  } catch (err) {
    console.warn('[GraphWiki] Skill auto-install failed (non-fatal):', err instanceof Error ? err.message : err);
  }
}

runPostInstall().catch(() => process.exit(0));
