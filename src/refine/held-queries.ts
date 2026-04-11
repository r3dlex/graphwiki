// Held-out query set for validation
// Used to validate refinement improvements against held-out queries

import { readFile, writeFile, mkdir, access } from 'fs/promises';

export interface HeldOutQuery {
  query: string;
  expectedTier?: number;
  category?: string;
}

/**
 * Load held-out queries from JSON file
 */
export async function loadHeldOutQueries(
  heldOutPath = '.graphwiki/held-out-queries.json'
): Promise<HeldOutQuery[]> {
  try {
    const content = await readFile(heldOutPath, 'utf-8');
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      return data;
    }
    if (data.queries && Array.isArray(data.queries)) {
      return data.queries;
    }
    return [];
  } catch {
    // Return empty array if file doesn't exist
    return [];
  }
}

/**
 * Save held-out queries to JSON file
 */
export async function saveHeldOutQueries(
  queries: HeldOutQuery[],
  heldOutPath = '.graphwiki/held-out-queries.json'
): Promise<void> {
  const dir = heldOutPath.substring(0, heldOutPath.lastIndexOf('/'));
  if (dir) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(heldOutPath, JSON.stringify({ queries }, null, 2), 'utf-8');
}

/**
 * Check if held-out queries file exists
 */
export async function hasHeldOutQueries(
  heldOutPath = '.graphwiki/held-out-queries.json'
): Promise<boolean> {
  try {
    await access(heldOutPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create held-out queries file with synthetic benchmark queries
 */
export async function createDefaultHeldOutQueries(
  heldOutPath = '.graphwiki/held-out-queries.json'
): Promise<void> {
  const defaultQueries: HeldOutQuery[] = [
    { query: 'How does the extraction pipeline handle TypeScript files?', category: 'extraction' },
    { query: 'What is the deduplication merge threshold?', category: 'dedup' },
    { query: 'How does the query router tier-3 routing work?', category: 'query' },
    { query: 'What communities were detected in the last build?', category: 'community' },
    { query: 'How do I run the benchmark comparison?', category: 'benchmark' },
    { query: 'What languages are supported for extraction?', category: 'extraction' },
    { query: 'How does incremental build compute deltas?', category: 'build' },
    { query: 'What is the wiki compilation budget?', category: 'wiki' },
    { query: 'How do I configure the LLM provider?', category: 'config' },
    { query: 'What is the failure threshold for refinement?', category: 'refine' },
    { query: 'How does the batch coordinator handle retries?', category: 'extraction' },
    { query: 'What is the max hops setting for query routing?', category: 'query' },
    { query: 'How do I enable debug logging?', category: 'config' },
    { query: 'What is the cluster resolution setting?', category: 'community' },
    { query: 'How does the ratchet validation work?', category: 'refine' },
    { query: 'What tokenization does the embedding use?', category: 'dedup' },
    { query: 'How do I export the graph to GraphML?', category: 'export' },
    { query: 'What is the circuit breaker threshold?', category: 'extraction' },
    { query: 'How does the drift detection work?', category: 'community' },
    { query: 'What is the cache TTL for queries?', category: 'query' },
  ];

  await saveHeldOutQueries(defaultQueries, heldOutPath);
}
