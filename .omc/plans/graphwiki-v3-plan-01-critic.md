# Critic Review — GraphWiki v3 Plan (Iteration 1)

**Reviewed:** graphwiki-v3-plan-01.md
**Architect review:** graphwiki-v3-plan-01-architect.md (ITERATE)
**Date:** 2026-04-11
**Reviewer:** Critic

---

## Verdict: ITERATE

The plan has a solid foundation and the phased structure is mostly sound. However, **6 critical quality issues** prevent approval. The Architect identified 5 issues; this review confirms all of them and adds 2 more. The plan cannot proceed to approval until these are resolved.

---

## Critical Quality Issues (Must Fix)

### CQ1: Directed Graph Migration Path Missing (BLOCKING — inherited from Architect Issue 1)

**Issue:** The plan adds `directed: boolean` to the `Edge` type but provides no migration path for existing v2 `graph.json` files. This is a **silent data corruption risk** — users upgrading from v2 to v3 will have edges without the `directed` field, and the code must assume `directed: false` by default. But there's no migration function, no version marker in the graph schema, and no test for the migration.

**Principle violated:** Principle #4 ("CLI flags are cheap, plan them upfront") — the `--directed` flag was not planned with schema migration. This is not a hypothetical risk; it's a guaranteed breakage for every v2 user who upgrades.

**Specific missing elements:**
- No `src/migrate/graph-v2-to-v3.ts` migration script
- No `graphSchemaVersion: "2.0" | "3.0"` field in the graph file header
- No acceptance criterion: "existing graph.json from v2 loads correctly in v3 with all edges preserved"
- No test: `tests/migration/v2-to-v3.test.ts` that verifies an old graph.json loads correctly

**Required fix:** Add a Phase P0 item (or prepend to Phase P1c):
- P0-migrate-1: Add `graphSchemaVersion` to `src/types.ts`
- P0-migrate-2: Implement `src/migrate/graph-v2-to-v3.ts` that adds `directed: false` to all existing edges
- P0-migrate-3: Add migration test: load old graph.json, verify all edges have `directed: false`
- P0-migrate-4: Document migration in `SPEC.md`

---

### CQ2: Hybrid Runtime Reality Not Acknowledged (SIGNIFICANT — inherited from Architect Issue 2)

**Issue:** Principle #3 says "WASM-first for cross-platform." But `package.json` already includes `onnxruntime-node` (native binary, line 63), which is NOT WASM. The whisper plan uses `@xenova/transformers` (WASM). This creates a hybrid runtime: native ONNX for embeddings + WASM for whisper. The plan doesn't acknowledge this contradiction.

**Why this matters:** Hybrid runtime means twice the testing matrix (WASM path + native path). ONNX WASM fallback exists (`@xenova/transformers` can run ONNX models in WASM) but is not being used. The plan is introducing WASM for whisper while the existing embedding layer uses native — these should be unified.

**Required fix:** The plan must address this by choosing one of:
- **Option A:** Replace `onnxruntime-node` with `@xenova/transformers` for full WASM consistency. Slower embeddings but simpler testing matrix.
- **Option B:** Keep `onnxruntime-node` for embeddings, add `@xenova/transformers` for whisper WASM. Explicitly accept the hybrid runtime, document it, add integration tests covering both paths.
- The plan currently has no position on this.

---

### CQ3: Pre-Mortem P3 Is Incomplete — Doesn't Name the Affected Algorithms (MODERATE — inherited from Architect Issue 4)

**Issue:** Pre-mortem P3 says "path finding, community detection, and dedup all assume symmetric adjacency" but doesn't identify WHICH specific functions/algorithms have this assumption. "Audit all graph algorithms" is not a plan — it's a directive to make a plan.

**Required fix:** The plan must pre-document the audit scope. At minimum:
- `src/graph/query/path.ts`: `findPath()`, `bfs()`, `dfs()` — assumed undirected
- `src/dedup/index.ts`: `Deduplicator.computeSimilarity()` — assumed symmetric edges
- `src/graph/cluster.ts`: Leiden `resolveDisagreement()` — may assume undirected
- This audit must be a **prerequisite** listed in the plan, not an inline note in the pre-mortem

---

### CQ4: whisper WASM Load Failure Handling Missing (MODERATE — inherited from Architect Issue 5)

**Issue:** The plan's whisper acceptance criterion says "Transcription completes in < 60s" but doesn't address what happens if WASM whisper fails to load. Common failure modes:
- WASM not supported in the environment
- Out of memory (models are 1-3GB)
- Browser compatibility (if running in a sandbox)

**Required fix:** Add acceptance criterion: "If WASM whisper fails to load, `graphwiki add <media>` must print a clear error message stating the failure reason, hardware requirements (8GB RAM minimum), and suggest `--no-whisper` as a fallback."

---

### CQ5: Platform Expansion P2b Blocked by P3 — Dependency Not Enforced (MODERATE — inherited from Architect Issue 3)

**Issue:** The plan says P2b (platform expansion 7→11) depends on P3 (SKILL.md generator formalization). But the phases are ordered P1 → P2 → P3, meaning P2b is scheduled before P3 is complete. This is a sequencing bug.

**Architect's synthesis correctly moves P3 to P0/P1.** The plan's phased ordering must be updated to match: P3 (SKILL.md adoption) runs in parallel with P1 so P2b isn't blocked.

**Required fix:** Apply the Architect's synthesis restructuring. P3 (SKILL.md formal adoption) must complete before P2b (platform expansion) begins.

---

### CQ6: URL Ingestion Priority Mismatch — Highest-Value Feature Deferred (MODERATE)

**Issue:** P2a (URL/video/tweet ingestion) is the highest-value new feature in v3 (YouTube transcript ingestion is the marquee use case). But it's deferred to P2, after SVG export (P1d) and Neo4j push (P1e), which are lower-value export features with no dependencies on whisper.

**This is a priority inversion.** URL ingestion doesn't depend on SVG or Neo4j — it depends on whisper (P1a). So it should be in P2 (after P1a) but before P2b (platform expansion). SVG and Neo4j should move to P0 alongside tree-sitter restoration since they have no extraction dependencies.

**Required fix:** Reorder: SVG export (P1d) and Neo4j push (P1e) should ship in P0 alongside tree-sitter restoration. URL ingestion (P2a) stays in P2 after whisper (P1a). This reflects true dependency order rather than treating all "new features" as equal.

---

## Quality Criteria Assessment

| Criterion | Status | Notes |
|----------|--------|-------|
| **Testable acceptance criteria** | PARTIAL | ~60% of acceptance criteria are concrete. Missing: migration acceptance, WASM load failure handling, undirected assumption audit criteria |
| **Risk mitigations** | PARTIAL | Pre-mortem covers 6 scenarios but P3 (directed) mitigation is weak — "audit all algorithms" without naming them |
| **80%+ file/line citations** | FAIL | Plan makes claims about `src/extract/ast-extractor.ts`, `src/cli.ts`, `src/types.ts` but doesn't cite specific line numbers. Gap analysis (which this plan is based on) had file-level citations. |
| **No vague terms** | PARTIAL | "Transcription completes in < 60s" is concrete. But "higher fidelity" in `--mode deep` acceptance is vague — higher than what baseline? 2x? |
| **Viable alternatives considered** | YES | Viable Options table has >= 2 options for each major decision |
| **Dependency ordering** | FAIL | P3 blocks P2b but ships after P2b. SVG/Neo4j (no deps) ship in P1 while URL ingestion (depends on whisper) ships in P2. |
| **ADR included** | YES | ADR section present with Decision, Drivers, Alternatives, Why chosen, Consequences, Follow-ups |

---

## Required Revisions

The plan must be updated with the following changes before Critic can approve:

1. **Add Phase P0-migrate items** (CQ1): migration script, schema version field, migration test, SPEC.md documentation
2. **Address hybrid runtime** (CQ2): Option A or Option B, explicitly chosen and documented
3. **Name affected algorithms in pre-mortem P3** (CQ3): specific functions in path.ts, dedup/index.ts, cluster.ts
4. **Add WASM load failure acceptance criterion** (CQ4): clear error message, hardware requirements, `--no-whisper` fallback
5. **Apply Architect's synthesis restructuring** (CQ5): P3 before P2b, P3 in P0/P1 parallel
6. **Reorder SVG/Neo4j before URL ingestion** (CQ6): reflect true dependency order

---

## Summary

The Architect correctly identified that the directed graph schema change needs a migration path — this is the most critical gap. The hybrid runtime acknowledgment is a close second. Once these 6 issues are addressed, the plan should be ready for approval.

**Recommendation:** Address all 6 CQ issues, update the plan file, and resubmit for Architect + Critic re-review (Iteration 2).
