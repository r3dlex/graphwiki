// Drift detection for GraphWiki v2
// Tracks community drift between graph versions

import type { DriftLogEntry } from "../types.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";

export class DriftDetector {
  private runCount: number = 0;
  private logPath: string;

  constructor(config: {
    drift_threshold: number;
    max_scoped_runs: number;
    logPath?: string;
  }) {
    this.logPath = config.logPath ?? "graphwiki-out/drift-log.json";
    this._ensureLogDir();
  }

  /**
   * Detect community drift between two community assignments.
   * Returns a DriftLogEntry describing what changed.
   */
  detect(
    previousCommunities: Map<string, number> | null,
    newCommunities: Map<string, number>,
    affectedNodes: Set<string>
  ): DriftLogEntry {
    this.runCount++;

    const driftedNodes: string[] = [];
    const previous = previousCommunities ?? new Map();

    // Find nodes that changed community
    for (const [nodeId, newComm] of newCommunities) {
      const prevComm = previous.get(nodeId);
      if (prevComm !== undefined && prevComm !== newComm) {
        driftedNodes.push(nodeId);
      }
    }

    // Determine if drift exceeds threshold

    // Nodes affected by change (nodes whose neighbors changed community)
    const affectedByChange = new Set<string>();
    if (previousCommunities) {
      for (const affectedNode of affectedNodes) {
        const newComm = newCommunities.get(affectedNode);
        const prevComm = previousCommunities.get(affectedNode);
        if (newComm !== prevComm) {
          affectedByChange.add(affectedNode);
        }
      }
    }

    const entry: DriftLogEntry = {
      timestamp: new Date().toISOString(),
      drifted_nodes: driftedNodes,
      new_communities: Object.fromEntries(newCommunities),
      affected_by_change: affectedByChange,
    };

    // Persist to drift-log.json
    this._persistLog(entry);

    return entry;
  }

  private _ensureLogDir(): void {
    const dir = dirname(this.logPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  private _persistLog(entry: DriftLogEntry): void {
    let logs: DriftLogEntry[] = [];

    if (existsSync(this.logPath)) {
      try {
        const content = readFileSync(this.logPath, "utf-8");
        logs = JSON.parse(content);
      } catch {
        logs = [];
      }
    }

    // Serialize Set fields
    const serializable = {
      ...entry,
      affected_by_change: Array.from(entry.affected_by_change),
    };

    logs.push(serializable as unknown as DriftLogEntry);

    writeFileSync(this.logPath, JSON.stringify(logs, null, 2), "utf-8");
  }

  getRunCount(): number {
    return this.runCount;
  }

  reset(): void {
    this.runCount = 0;
  }
}
