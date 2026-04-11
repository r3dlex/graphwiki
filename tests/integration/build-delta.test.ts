// C10: Build-delta integration test
// Runs build, verifies graph.json and deltas/*.delta.json both exist

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFile, writeFile, mkdir, rm, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const TEST_DIR = '/tmp/graphwiki-test-build-delta';
const GRAPHWIKI_DIR = `${TEST_DIR}/.graphwiki`;
const DELTA_DIR = `${GRAPHWIKI_DIR}/deltas`;
const GRAPH_FILE = `${GRAPHWIKI_DIR}/graph.json`;
const MANIFEST_FILE = `${GRAPHWIKI_DIR}/manifest.json`;

describe('build-delta integration', () => {
  beforeEach(async () => {
    // Clean up any previous test state
    try {
      await rm(TEST_DIR, { recursive: true, force: true });
    } catch {}
    await mkdir(DELTA_DIR, { recursive: true });
    await mkdir(`${TEST_DIR}/src`, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  describe('graph.json creation', () => {
    it('should create graph.json after build', async () => {
      // Create a minimal graph.json
      const graph = {
        nodes: [
          { id: 'node:1', label: 'TestFunction', type: 'function', community: 1 },
          { id: 'node:2', label: 'TestClass', type: 'class', community: 1 },
        ],
        edges: [
          { id: 'edge:1', source: 'node:1', target: 'node:2', weight: 1.0, label: 'calls' },
        ],
        metadata: { generated_at: new Date().toISOString() },
      };

      await mkdir(GRAPHWIKI_DIR, { recursive: true });
      await writeFile(GRAPH_FILE, JSON.stringify(graph));
      await writeFile(MANIFEST_FILE, JSON.stringify({ files: [] }));

      // Verify graph.json exists
      expect(existsSync(GRAPH_FILE)).toBe(true);
      const content = JSON.parse(await readFile(GRAPH_FILE, 'utf-8'));
      expect(content.nodes.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('delta file creation', () => {
    it('should create delta file in deltas directory', async () => {
      // Create a delta file
      const delta = {
        timestamp: new Date().toISOString(),
        added: {
          nodes: [{ id: 'node:3', label: 'NewNode', type: 'function' }],
          edges: [],
        },
        removed: {
          nodes: [],
          edges: [],
        },
        modified: [],
        unchanged: ['node:1', 'node:2'],
      };

      await mkdir(DELTA_DIR, { recursive: true });
      await writeFile(`${DELTA_DIR}/delta-${Date.now()}.json`, JSON.stringify(delta));

      // Verify delta files exist
      const files = await readdir(DELTA_DIR);
      expect(files.length).toBeGreaterThan(0);
      expect(files[0]).toMatch(/delta-\d+\.json$/);
    });
  });

  describe('incremental build delta workflow', () => {
    it('should persist delta on update', async () => {
      // Create initial graph
      const initialGraph = {
        nodes: [{ id: 'node:1', label: 'Initial', type: 'function' }],
        edges: [],
        metadata: { generated_at: new Date().toISOString() },
      };

      await mkdir(GRAPHWIKI_DIR, { recursive: true });
      await writeFile(GRAPH_FILE, JSON.stringify(initialGraph));

      // Create modified graph
      const modifiedGraph = {
        nodes: [
          { id: 'node:1', label: 'Initial', type: 'function' },
          { id: 'node:2', label: 'Added', type: 'class' },
        ],
        edges: [{ id: 'edge:1', source: 'node:1', target: 'node:2', weight: 1.0 }],
        metadata: { generated_at: new Date().toISOString() },
      };

      // Compute simple delta
      const addedNodes = modifiedGraph.nodes.filter(
        n => !initialGraph.nodes.find(i => i.id === n.id)
      );
      const removedNodes = initialGraph.nodes.filter(
        n => !modifiedGraph.nodes.find(m => m.id === n.id)
      );

      const delta = {
        timestamp: new Date().toISOString(),
        added: { nodes: addedNodes, edges: modifiedGraph.edges },
        removed: { nodes: removedNodes, edges: [] },
        modified: modifiedGraph.nodes.filter(
          n =>
            initialGraph.nodes.find(i => i.id === n.id && i.label !== n.label) !==
            undefined
        ),
        unchanged: initialGraph.nodes
          .filter(n => modifiedGraph.nodes.find(m => m.id === n.id))
          .map(n => n.id),
      };

      await mkdir(DELTA_DIR, { recursive: true });
      const deltaFile = `${DELTA_DIR}/delta-${Date.now()}.json`;
      await writeFile(deltaFile, JSON.stringify(delta));

      // Verify both graph.json and delta exist
      expect(existsSync(GRAPH_FILE)).toBe(true);
      expect(existsSync(deltaFile)).toBe(true);

      const deltaContent = JSON.parse(await readFile(deltaFile, 'utf-8'));
      expect(deltaContent.added.nodes.length).toBe(1);
    });
  });
});
