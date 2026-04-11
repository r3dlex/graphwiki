# Architect Review — GraphWiki v3 Plan (Iteration 2)

**Reviewed:** graphwiki-v3-plan-02.md
**Previous review:** Iteration 1 (ITERATE)
**Date:** 2026-04-11
**Reviewer:** Architect

---

## Verdict: APPROVE

All 5 issues from Iteration 1 have been addressed. The plan is architecturally sound.

---

## Iteration 1 Issues — Status

### Issue 1: Directed Graph Migration Path — RESOLVED
Phase P0-migrate is now a distinct phase with 7 specific changes (P0m-1 through P0m-7). The migration includes:
- Schema version field in types.ts
- Migration script with idempotency
- Auto-migration on load in graph builder
- Manual `migrate` CLI command
- Migration test

### Issue 2: Hybrid Runtime Acknowledged — RESOLVED
The "Hybrid Runtime" ADR row explicitly recommends Option B (hybrid acknowledged): Keep `onnxruntime-node` for embeddings (faster), use `@xenova/transformers` for whisper WASM. This is the pragmatic choice.

### Issue 3: P3 Blocking P2b — RESOLVED
P0b (SKILL.md formalization) now runs in P0, parallel with tree-sitter. P2c (platform expansion) runs after P0b completes. The dependency is satisfied.

### Issue 4: Pre-Mortem P3 Naming — RESOLVED
All 5 affected functions are named in the pre-mortem: `findPath()`, `bfs()`, `dfs()` in path.ts; `computeSimilarity()` in dedup/index.ts; `leiden()`/`resolveDisagreement()` in cluster.ts.

### Issue 5: whisper WASM Load Failure — RESOLVED
P1a-7 adds `whisper-fallback.test.ts`. Acceptance criterion explicitly requires clear error message with hardware requirements and `--no-whisper` suggestion.

---

## Remaining Minor Observations (Not Blocking)

### Observation 1: `--mode deep` still vague
The acceptance criterion says "--mode deep produces 2x more entity nodes per file (baseline: 10 → 20)." This is concrete. No change needed.

### Observation 2: whisper WASM POC should be Week 0
The plan correctly identifies "Validate whisper WASM feasibility in Week 0 proof-of-concept before committing to P1a" as a follow-up. This is critical path — if whisper WASM fails POC, P1a must pivot to Option B (local files only, no URL ingest) or native whisper with platform-specific binaries.

### Observation 3: P2a (SVG/Neo4j) moved before P2b (URL ingest)
This is correct — SVG/Neo4j have zero dependencies on whisper, so they should ship earlier. The plan now correctly reflects this.

---

## Steelman Revisited

The Iteration 1 steelman argued that P1c (directed graphs) was bundled with export features and should be isolated. The Iteration 2 plan now has P0-migrate as a separate phase preceding P1c, which is the correct isolation. No further steelman objections.

---

## Summary

All 5 Architect issues resolved. Plan is approved for Critic review.
