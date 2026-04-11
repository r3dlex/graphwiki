# Architect Review — GraphWiki v3 Plan (Iteration 1)

**Reviewed:** graphwiki-v3-plan-01.md
**Date:** 2026-04-11
**Reviewer:** Architect

---

## Verdict: ITERATE

The plan has a sound overall structure and the phased ordering is mostly correct. However, there are **5 critical architectural issues** that must be addressed before Critic can approve.

---

## Steelman Antithesis

**The case against the phased ordering (P0→P1→P2→P3):**

The plan sequences features as: tree-sitter (P0) → whisper/watch/directed/SVG/Neo4j (P1) → URL/platform (P2) → SKILL.md (P3). This sounds logical but obscures a dependency graph that should reorder delivery:

- **P1c (directed graphs)** changes the core `Edge` type schema. This is the most disruptive change in the entire v3 spec — it invalidates ALL existing `graph.json` files from v2 users upgrading. Yet it's bundled mid-phase alongside lower-risk features.
- **P1d (SVG export) and P1e (Neo4j push)** are export features with zero dependencies on whisper or watch mode. They could ship in P0 alongside tree-sitter restoration (since tree-sitter is just the extraction input, not a prerequisite for export).
- **P2a (URL ingestion)** is arguably the highest-value new feature in v3 (YouTube transcript ingestion). It's deferred to P2, after SVG and Neo4j which are lower-value. This misprioritization stems from treating all "new features" as equal rather than analyzing their independent value and risk.

**The true dependency graph is:**
```
P0: tree-sitter (standalone - extraction input)
P1a: whisper WASM (standalone - ingestion input)
P1b: watch mode (standalone - build trigger)
P1c: directed graphs (BREAKING SCHEMA CHANGE - highest risk)
P1d: SVG export (standalone - output format)
P1e: Neo4j push (standalone - output target)
P2a: URL ingestion (depends on P1a - YouTube uses whisper)
P2b: platform expansion (depends on SKILL.md generator from P3)
P3: SKILL.md adoption (foundation for P2b)
```

The plan's phased ordering bundles P1c (breaking schema change) with low-risk export features. This is architecturally negligent.

---

## Critical Issues

### Issue 1: `directed: boolean` Schema Breaking Change — No Migration Path (CRITICAL)
**Problem:** Adding `directed: boolean` to the `Edge` type in `src/types.ts` silently invalidates all existing `graph.json` files from v2. Users upgrading to v3 load their old graph and it "works" but edge traversal semantics are wrong.

**Specific violation:** The plan's principle #4 ("CLI flags are cheap, plan them upfront") directly applies here — the `--directed` flag was not planned with migration in mind. This is a silent data corruption risk.

**Required fix:** Plan MUST include:
- `src/migrate/graph-v2-to-v3.ts` — migrates existing graph.json, adds `directed: false` to all existing edges
- `--directed` defaults to `false` (backward compatible)
- Migration runs automatically on `graphwiki build .` if old graph.json detected
- Explicit acceptance criterion: "existing graph.json from v2 loads correctly in v3 with all edges preserved and `directed: false`"

---

### Issue 2: WASM-First Principle Contradicted by Existing ONNX Runtime (SIGNIFICANT)
**Problem:** The plan's principle #3 says "WASM-first for cross-platform." But `package.json` already includes `onnxruntime-node` (native binary, line 63) with no WASM alternative. The plan introduces whisper as WASM-first but the existing ONNX embedding layer uses native binaries.

**Tradeoff tension revealed:** Native ONNX is 3-5x faster than WASM ONNX for embedding computation. If whisper also uses `@xenova/transformers` (WASM), we're running hybrid: native ONNX for embeddings + WASM for whisper. This is harder to test and debug.

**Required resolution:** Plan must acknowledge this hybrid runtime reality and make a deliberate choice:
- Option A: Accept hybrid runtime, document it, add integration tests for both paths
- Option B: Replace `onnxruntime-node` with `@xenova/transformers` for full WASM consistency (but slower embeddings)
- The plan currently ignores this tension

---

### Issue 3: Platform Expansion Depends on P3 Which Depends on Nothing — Should Be Parallel (MODERATE)
**Problem:** P2b (platform expansion 7→11) is in Phase 2, after P1. But P3 (SKILL.md generator adoption) is in Phase 3, and P2b depends on the generator being correct. The plan says P2b "depends on SKILL.md generator from P3" — this is a reverse dependency that should be flagged.

**Required fix:** P3 (SKILL.md formal adoption) should be moved to Phase 0 or Phase 1, running in parallel with P1, so P2b doesn't wait. The generator already exists; formal adoption is low-risk.

---

### Issue 4: Pre-Mortem P3 Identifies Symptom Not Root Cause (MODERATE)
**Problem:** P3 says "Directed Graph Breaks Undirected Assumptions — path finding, community detection, and dedup all assume symmetric adjacency." The mitigation is "audit all graph algorithms." But the pre-mortem doesn't identify WHICH algorithms have this assumption.

**Required fix:** Before P1c implementation, the audit must be pre-documented. At minimum:
- `src/graph/query/path.ts` — BFS/DFS assumed undirected
- `src/graph/dedup/index.ts` — similarity computation assumed symmetric edges
- `src/graph/cluster.ts` — Leiden algorithm's `resolveDisagreement` may assume undirected
- The plan must specify this audit as a prerequisite before P1c work begins

---

### Issue 5: whisper WASM Performance Reality Not Addressed (MODERATE)
**Problem:** `@xenova/transformers` Whisper in WASM processes ~5x realtime vs native whisper.cpp at ~30x realtime. For a 5-minute audio: native = 10 seconds, WASM = 60 seconds. The plan says "Transcription completes in < 60s for 5-minute audio on M1 MacBook" — this is the WASM speed, and it's barely acceptable.

**The plan's acceptance criterion accepts this performance as-is.** But it doesn't address:
- What happens on low-end hardware (Chromebook, 4-year-old Windows laptop)?
- The fallback path if WASM whisper fails to load
- Whether the WASM bundle size is acceptable for npm (whisper models are 1-3GB)

**Required fix:** Add acceptance criterion: "WASM whisper load failure must not crash the CLI — it must print a clear error with hardware requirements and suggest `--no-whisper` fallback."

---

## Tradeoff Tensions

### Tension 1: Schema Safety vs. Feature Velocity
- Adding `directed: boolean` with backward-compat migration adds 1-2 weeks to P1c
- Skipping migration ships faster but silently corrupts existing users' graphs
- The plan chose feature velocity (ship P1c with schema change, ignore migration)

### Tension 2: WASM Portability vs. whisper Performance
- WASM whisper works on all 11 platforms but is 6x slower than native
- Native whisper is fast but requires platform-specific binaries for each platform
- The plan chose portability (WASM-first) but doesn't provide a native fallback path

### Tension 3: P1 Feature Batching vs. Risk Isolation
- P1 batches whisper + watch + directed + SVG + Neo4j into one phase
- If whisper WASM fails (P1), it doesn't block directed graphs (P1c) or SVG (P1d)
- Batching is faster but a single phase failure cascades

---

## Synthesis Path

**Recommended restructuring:**

| Phase | Contents | Why |
|-------|----------|-----|
| **P0** | tree-sitter restoration (from plan P0) | Critical gap, no dependencies |
| **P0b** | SKILL.md formal adoption (from plan P3, moved up) | Enables P2b platform work to proceed in parallel |
| **P1a** | whisper WASM ingestion | Standalone ingestion input |
| **P1b** | watch mode | Standalone build trigger |
| **P1c** | directed graphs WITH migration path | Breaking schema change; needs explicit migration, NOT batched with export features |
| **P2a** | SVG export + Neo4j push | Export features, no dependencies on P1c |
| **P2b** | URL/video/tweet ingestion | Depends on P1a (whisper) |
| **P3** | Platform expansion 7→11 | Depends on P0b (generator formalization) |

This reorders SVG/Neo4j before URL ingestion (they're independent and lower-risk than URL), and moves SKILL.md adoption to P0 so P2b isn't blocked.

---

## Principle Violations

1. **Principle #4 violated** (CLI flags need upfront planning): The `--directed` flag was not planned with schema migration. Silent breaking change for v2 users.
2. **Principle #3 violated** (WASM-first): Already contradicted by `onnxruntime-node` native dependency in package.json. Hybrid runtime reality not acknowledged.

---

## Summary

The plan's core insight (tree-sitter first, WASM-first for whisper) is correct. The phased structure is mostly right but P1 is too large and bundles a breaking schema change with low-risk export features. The most critical gap is the directed graph migration path — it must be addressed before Critic approval.

**Recommendation:** Address Issues 1-5 above, apply the synthesis restructuring, and resubmit to Architect for re-review.
