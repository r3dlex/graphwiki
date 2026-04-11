import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RefinementHistory, createRefinementHistory } from '../../src/refine/history.js';
import { createRatchet } from '../../src/refine/ratchet.js';
import { loadHeldOutQueries, saveHeldOutQueries } from '../../src/refine/held-queries.js';
import { rm, mkdir } from 'fs/promises';
import { join } from 'path';

const TEST_DIR = '/tmp/graphwiki-test-refinement';

describe('refinement-validate integration', () => {
  const historyPath = join(TEST_DIR, 'history.jsonl');
  const heldOutPath = join(TEST_DIR, 'held-out-queries.json');

  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  it('should validate refinement against held-out queries', async () => {
    // Create history with two entries for validation
    const history = new RefinementHistory(historyPath);

    const entry1: import('../../src/types.js').RefinementHistoryEntry = {
      version: 'v1',
      timestamp: '2024-01-01T00:00:00Z',
      promptDiff: 'Initial version',
      diagnostics: [{ nodeId: 'node-1', weakness: 'low-confidence', suggestion: 'improve', estimatedImpact: 0.1 }],
      validationScore: 0.7,
    };

    const entry2: import('../../src/types.js').RefinementHistoryEntry = {
      version: 'v2',
      timestamp: '2024-01-02T00:00:00Z',
      promptDiff: 'Improved version',
      diagnostics: [{ nodeId: 'node-1', weakness: 'low-confidence', suggestion: 'improved', estimatedImpact: 0.2 }],
      validationScore: 0.75,
    };

    await history.append(entry1);
    await history.append(entry2);

    // Save held-out queries
    const queries = [
      { query: 'How does extraction work?', category: 'extraction' },
      { query: 'What is the merge threshold?', category: 'dedup' },
    ];
    await saveHeldOutQueries(queries, heldOutPath);

    // Verify held-out queries can be loaded
    const loaded = await loadHeldOutQueries(heldOutPath);
    expect(loaded.length).toBe(2);
    expect(loaded[0].query).toBe('How does extraction work?');
  });

  it('should validate with ratchet', async () => {
    const ratchet = createRatchet();

    const tuningScores: import('../../src/types.js').QueryScore[] = [
      { query: 'q1', confidence: 0.8, efficiency: 0.7, tier: 2, tokens: 100 },
      { query: 'q2', confidence: 0.6, efficiency: 0.5, tier: 1, tokens: 150 },
    ];

    const validationScores: import('../../src/types.js').QueryScore[] = [
      { query: 'q1', confidence: 0.85, efficiency: 0.75, tier: 2, tokens: 100 },
      { query: 'q2', confidence: 0.65, efficiency: 0.55, tier: 1, tokens: 150 },
    ];

    const result = ratchet.validate(tuningScores, validationScores);

    expect(result.passed).toBe(true);
    expect(result.compositeScore).toBeGreaterThan(0);
    expect(result.details.threshold).toBe(0.6);
  });

  it('should generate audit trail', async () => {
    const history = new RefinementHistory(historyPath);

    const entry: import('../../src/types.js').RefinementHistoryEntry = {
      version: 'v1',
      timestamp: '2024-01-01T00:00:00Z',
      promptDiff: 'Initial',
      diagnostics: [{ nodeId: 'node-1', weakness: 'low', suggestion: 'improve', estimatedImpact: 0.1 }],
      validationScore: 0.7,
    };

    await history.append(entry);

    const audit = await history.auditTrail();

    expect(audit.length).toBe(1);
    expect(audit[0].promptVersion).toBe('v1');
    expect(audit[0].score).toBe(0.7);
  });

  it('should rollback to previous version', async () => {
    const history = new RefinementHistory(historyPath);

    for (let i = 1; i <= 3; i++) {
      await history.append({
        version: `v${i}`,
        timestamp: new Date().toISOString(),
        promptDiff: `Version ${i}`,
        diagnostics: [],
        validationScore: 0.6 + i * 0.05,
      });
    }

    const latestBefore = await history.getLatestVersion();
    expect(latestBefore).toBe('v3');

    await history.rollback('v1');

    const latestAfter = await history.getLatestVersion();
    expect(latestAfter).toBe('v1');

    const historyAfter = await history.getHistory();
    expect(historyAfter.length).toBe(1);
  });
});
