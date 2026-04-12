import { describe, it, expect, afterEach } from 'vitest';
import { generateExtractionPrompt } from './prompt-generator.js';
import { readFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('generateExtractionPrompt', () => {
  const testDir = join(tmpdir(), 'graphwiki-test-prompts-' + Date.now());

  afterEach(async () => {
    try { await rm(testDir, { recursive: true, force: true }); } catch {}
  });

  it('creates pendingDir if it does not exist', async () => {
    const promptPath = await generateExtractionPrompt('/path/to/file.pdf', testDir);
    expect(existsSync(testDir)).toBe(true);
    expect(existsSync(promptPath)).toBe(true);
  });

  it('returns correct promptPath', async () => {
    const promptPath = await generateExtractionPrompt('/docs/report.pdf', testDir);
    expect(promptPath).toContain('report.pdf.prompt.md');
  });

  it('prompt file contains sourceFile reference', async () => {
    const source = '/docs/my-report.pdf';
    const promptPath = await generateExtractionPrompt(source, testDir);
    const content = await readFile(promptPath, 'utf-8');
    expect(content).toContain(source);
  });

  it('prompt file contains resultPath reference', async () => {
    const promptPath = await generateExtractionPrompt('/docs/report.pdf', testDir);
    const content = await readFile(promptPath, 'utf-8');
    expect(content).toContain('.result.json');
  });

  it('sanitizes special characters in slug', async () => {
    const promptPath = await generateExtractionPrompt('/path/to/my file (1).pdf', testDir);
    expect(promptPath).not.toContain(' ');
    expect(promptPath).not.toContain('(');
  });
});
