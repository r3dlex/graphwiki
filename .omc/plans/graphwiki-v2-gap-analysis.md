# GraphWiki v2 — Implementation Gap Analysis & Phased Plan (Revision 3)

**Generated:** 2026-04-11
**Mode:** Ralplan short (RALPLAN-DR) + pre-mortem
**Branch:** main
**Status:** 416 tests, build, lint passing
**Revision note:** Revision 3 expands pre-mortem (3->6 scenarios), splits Phase B into B.1/B.2, adds D4 to Phase 2, tightens acceptance criteria, and adds missing item assignments throughout.

---

## RALPLAN-DR Summary

### Principles
1. **Fix the silent npm publish failure first** — `lib/` is not in `package.json` `files` array but all 7 hook scripts import from it. This is the highest-risk bug: passes local dev, fails every `npm install`. It must be in Phase 0.
2. **Extraction fidelity gates everything** — the dedup, wiki, and query pipelines all depend on clean graph output. Stub tokenizers and missing tree-sitter parsers are the root cause of cascade failures.
3. **MCP query tools are the minimum viable product** — the server must respond to tools before anything else is reachable. The dual-transport server is ready; the executor layer is the gap.
4. **Incremental by default** — every build must compute deltas, not re-extract unchanged files. The delta subsystem exists; the wiring to CLI does not.
5. **Offline resilience** — the HuggingFace model URL is a single point of failure. Every phase that uses embeddings needs an offline fallback.

### Decision Drivers
| # | Driver | Description |
|---|--------|-------------|
| D1 | **Critical: `lib/` missing from `files` array** | All 7 hook scripts import `../lib/stdin.mjs`. Without adding `"lib"` to `package.json` `files`, every `npm install` breaks the skill. Highest-priority fix. |
| D2 | **E2E usability** | MCP server must respond to at least `status`, `query_graph`, `wiki_list`, `wiki_search`, `community_list` tools. Without executor wiring, nothing is reachable. |
| D3 | **Extraction quality** — `ASTExtractor` stub parsers + broken tokenizer = garbage graph. Fixing extraction quality also requires wiring `LLMExtractor` into `cli.ts build` command (not automatic). |
| D4 | **Incremental build contract** — `computeDelta` exists but `incrementalBuild()` does not, and the `build` command does not call it. |
| D5 | **Token billing accuracy** — `BaselineRunner` uses `length/4` estimates. The benchmark comparison is meaningless without accurate counts. |
| D6 | **HF model availability** — network, geo-block, or downtime on HuggingFace blocks all embedding-dependent features with no offline fallback. |

### Viable Options
| Phase | Option A (recommended) | Option B | Option C |
|-------|------------------------|----------|----------|
| **Phase 0** | Add `"lib"` to `files` array (1-line fix) | Leave as-is (silent failure on publish) | — |
| **Phase A** | Real tokenizer via `@huggingface/transformers` + tree-sitter-* packages + wire LLMExtractor to build | Use HTTP embedding API instead of local ONNX | LLM-only extraction, skip local ONNX |
| **Phase B** | 6 CLI commands + MCP executor functions for query tools | Full 15-tool batch in one sprint | — |
| **Phase 2** | `incrementalBuild()` + delta wiring to build command | Full rebuild each time (skip delta) | — |
| **Phase 4** | File-backed refinement history + held-out queries | In-memory only (lose history on restart) | — |

---

## Pre-Mortem (6 Failure Scenarios)

### P1: HuggingFace Model Download Fails (BLOCKING)
**Scenario:** Phase A is deployed. At runtime, `ONNXEmbedding.loadModel()` tries to fetch from `https://huggingface.co/Xenova/transformers.js/resolve/main/models/onnx/all-MiniLM-L6-v2/model.onnx`. The download fails due to network issues, geo-blocking, or HuggingFace downtime.

**Impact:** All embedding-dependent features break: deduplication produces no merges, query routing has no semantic tier, and the entire semantic layer is offline.

**Mitigation:**
- Bundle a fallback: add a `--no-onnx` flag that falls back to `text.length`-based rough similarity
- Add `GRAPHWIKI_EMBEDDING_URL` env var override
- Consider bundling a quantized model (~20MB) in the npm package for the 3 most common languages
- Add a health check in `ingest` command that verifies model availability before accepting files

### P2: MCP Tool Executor Wires Wrong Graph State (DATA CORRUPTION)
**Scenario:** Phase B is deployed. The MCP `build` tool executor modifies `graphState.graph` but multiple concurrent HTTP clients have stale copies. Writes race and the graph silently loses edges.

**Impact:** Graph silently diverges across clients. Provenance traces become unreliable. Hard to detect post-hoc.

**Mitigation:**
- The `createMutex()` in `mcp-http.ts` exists but is not wired into tool executors. Phase B must wire `writeLock` before any mutation.
- Add sequence numbers to graph state so clients can detect staleness.
- Phase B should start with read-only query tools (`status`, `wiki_list`, `wiki_read`, `wiki_search`, `community_list`, `community_summary`) — no `build`/`ingest` tools until concurrency is addressed.

### P3: Integration Tests Never Written (QUALITY ROT)
**Scenario:** Phase C is deployed with MCP build/ingest tools. `tests/integration/` and `tests/benchmark/` directories exist in `package.json` scripts but contain zero files (verified: glob returned only `tests/archgate/violation-fixture.ts`).

**Impact:** No regression protection for integration scenarios. MCP tool calls, extraction pipeline, and incremental build are all unvalidated against each other. A future change to the extraction pipeline silently breaks the build tool.

**Mitigation:**
- Phase C must include at least 3 integration tests: (a) MCP stdio tool call → response, (b) build command → graph file, (c) incremental build → delta file
- Add `tests/integration/` files as part of Phase C gate criteria, not deferred to later

### P4: BatchState Partial-Write Corruption (fs.writeFile no fsync)
**Scenario:** `batch-coordinator.ts:99-100` uses `fs.writeFile` with no fsync, no write-then-rename. The process crashes mid-write.

**Impact:** Truncated JSON written to disk. `readState()` catches JSON parse errors, returns `null`, ALL progress is silently discarded. Build restarts from scratch, re-extracting all already-processed files.

**Mitigation:**
- Add atomic write pattern (write to temp file + rename) to Phase 2 scope
- Verify on read: if parse fails, treat as corrupted state, not empty state

### P5: Build Command Stub Never Invokes Pipeline (HIGHEST PROBABILITY)
**Scenario:** `cli.ts:122-158` logs "Build complete!" regardless of pipeline wiring. Phase A's acceptance ("graphwiki build . produces graph.json with nodes and edges") could be satisfied by an empty graph. The CLI stub always succeeds, so there is no error signal if the pipeline fails silently.

**Impact:** Executor wires everything, `graph.json` has 0 nodes, no error reported, nothing works.

**Mitigation:**
- Add explicit assertion to Phase A acceptance: "graph.json must contain >= 5 nodes AND >= 1 edge"
- Add logging of pipeline stages with failure indicators

### P6: Cache Invalidation Race (Concurrent Incremental Builds)
**Scenario:** Two processes run `--update` simultaneously. Both read the manifest, both compute the same delta (neither has committed yet), both write to cache. The second writer wins; the first writer's cache entries become orphaned.

**Impact:** Manifest entries silently diverge from actual cache files. Incremental builds produce incomplete or inconsistent graphs.

**Mitigation:**
- Add file locking for manifest during read-write cycles (Phase 2 D1)
- Use `.lock` file or `flock` advisory locking to serialize manifest access

---

## Structured Gap Table

### Section 1 — Architecture Overview FULLY IMPLEMENTED
- `src/index.ts` re-exports all public types and classes
- Directory structure matches spec
- Data flow: extract -> dedup -> cluster -> wiki -> query -> serve

### Section 2 — Tech Stack MOSTLY IMPLEMENTED (~90%)
- TypeScript, Vitest, ESLint, pnpm, tsup, ONNX, tree-sitter, Express all present
- **CRITICAL GAP (rev #1 error corrected):** `lib/` directory EXISTS with `lib/stdin.mjs` — but `"lib"` is NOT in `package.json` `files` array. All 7 hook scripts import `../lib/stdin.mjs`. This silently passes local testing but FAILS on `npm install`. This is a **1-line fix** that must go in Phase 0.
- tree-sitter language parser packages (`tree-sitter-typescript`, `tree-sitter-python`, etc.) NOT in `package.json`

### Section 3 — Graph Schema FULLY IMPLEMENTED
- All types match spec exactly
- **`IncrementalBuildResult` NOT in `types.ts`** — referenced in spec Sections 7 and 17

### Section 4 — Extraction PARTIAL (~65%)
**What exists:**
- `ast-extractor.ts` — full traversal logic; stub lazy-loaders for 17 languages
- `llm-extractor.ts` — full orchestration (cache, dispatcher, validator, coordinator)
- `extraction-cache.ts` — content-addressable cache with manifest
- `batch-coordinator.ts`, `rate-dispatcher.ts`, `schema-validator.ts` — all complete

**Gaps:**
- tree-sitter parser packages not in `package.json` — runtime fallback for non-TS languages
- **`_tokenize()` in `ONNXEmbedding` uses stub vocab** — produces noise embeddings
- **`cli.ts build` command is a stub** (lines 122-158) — does not invoke `ASTExtractor`, `LLMExtractor`, `GraphBuilder`, or `BatchCoordinator`. Must be wired as part of Phase A.
- **`ingest` in `cli.ts`** (lines 214-256) creates a minimal source node only. "Wire LLMExtractor to ingest" means replace the stub entirely with `LLMExtractor.extract(buffer, type, path)`.

### Section 5 — Semantic Deduplication PARTIAL (~60%)
- Framework complete (Deduplicator, ONNXEmbedding)
- HF URL model fetch is fragile (see pre-mortem P1)
- Stub tokenizer produces garbage embeddings

### Section 6 — Community Detection FULLY IMPLEMENTED
- `cluster.ts` — Leiden algorithm, tested
- `community-summary.ts`, `drift.ts` — complete

### Section 7 — Delta Tracking PARTIAL (~55%)
- `computeDelta()` exists and works
- **NOT wired to CLI** — `persistDelta()` exists but no CLI command calls it
- **`IncrementalBuildResult` type missing from `types.ts`**
- **No `incrementalBuild()` in `GraphBuilder`** — spec requires this method

### Section 8 — Wiki Compilation FULLY IMPLEMENTED
- `WikiCompiler` 3-stage pipeline complete
- `linter.ts`, `updater.ts`, `index-generator.ts`, `wiki-graph-map.ts` — all present

### Section 9 — Query System PARTIAL (~80%)
- `QueryRouter` with 5-tier routing complete
- No `LLMRouter` high-level wrapper class
- No `query/embedder.ts` (referenced in spec but not present)

### Section 10 — MCP Server PARTIAL (~60%)
- Transport + all 15 tool definitions complete
- **Tool executor function NOT wired to any concrete implementation** — `registerTools()` returns a handler but the `executor` function passed to it has no body
- **No MCP `initialize` handshake** handler
- **No `wiki_list`, `wiki_read`, `wiki_search`, `community_list`, `community_summary` CLI commands** — only `status` exists
- `writeLock` mutex exists but not wired to tool mutations

### Section 11 — Benchmarking PARTIAL (~55%)
- All 4 methods (grep, naive, RAG, graphwiki) implemented
- Uses `text.length / 4` estimates, not real tokenizer
- No held-out query set
- No `baseline_comparison` method

### Section 12 — Skill System FULLY IMPLEMENTED
- `skill-generator.ts` generates all 7 platform files
- All hook scripts present (**rev #1 corrected** — 6 scripts exist, not stub)
- **7 genuinely missing scripts:** `graphwiki-build.mjs`, `graphwiki-lint-errors.mjs`, `graphwiki-report.mjs`, `graphwiki-query.mjs`, `graphwiki-status.mjs`, `graphwiki-rollback.mjs`, `graphwiki-build-report.mjs`

### Section 13 — Testing MOSTLY IMPLEMENTED (~80%)
- 416 unit tests passing
- **MISSING:** `tests/integration/` directory is empty (only `tests/archgate/violation-fixture.ts` exists). `tests/benchmark/` directory is empty. These directories are referenced in `package.json` scripts but contain no files.

### Section 14 — File Organization MOSTLY IMPLEMENTED (~85%)
**Verified file audit (rev #1 vs rev #2 corrections):**

| File | Rev #1 Status | Rev #2 Status (verified) |
|------|--------------|--------------------------|
| `scripts/graphwiki-pretool.mjs` | MISSING | **EXISTS** (full impl, 262 lines) |
| `scripts/graphwiki-session-start.mjs` | MISSING | **EXISTS** (full impl, 76 lines) |
| `scripts/graphwiki-posttool.mjs` | MISSING | **EXISTS** (full impl, 76 lines) |
| `scripts/graphwiki-auggie-pretool.mjs` | MISSING | **EXISTS** |
| `scripts/graphwiki-auggie-session-start.mjs` | MISSING | **EXISTS** |
| `scripts/graphwiki-auggie-posttool.mjs` | MISSING | **EXISTS** |
| `lib/stdin.mjs` | MISSING | **EXISTS** |
| `scripts/graphwiki-build.mjs` | MISSING | MISSING |
| `scripts/graphwiki-lint-errors.mjs` | MISSING | MISSING |
| `scripts/graphwiki-report.mjs` | MISSING | MISSING |
| `scripts/graphwiki-query.mjs` | MISSING | MISSING |
| `scripts/graphwiki-status.mjs` | MISSING | MISSING |
| `scripts/graphwiki-rollback.mjs` | MISSING | MISSING |
| `scripts/graphwiki-build-report.mjs` | MISSING | MISSING |
| `src/query/embedder.ts` | MISSING | MISSING (referenced in spec) |
| `tests/integration/*.ts` | MISSING | MISSING (dir empty) |
| `tests/benchmark/*.ts` | MISSING | MISSING (dir empty) |
| `src/errors/` directory | MISSING | MISSING |

**Summary:** Rev #1 over-claimed 9 missing files. Actually 7 exist and 9 are genuinely missing.

### Section 15 — Error Handling PARTIAL (~30%)
- Basic validation and circuit breaker exist
- No `ErrorCatalog` class
- No structured error taxonomy in `src/errors/`
- No graceful degradation strategy

### Section 16 — Refinement System PARTIAL (~60%)
- All refinement classes exist
- No persistence layer (`RefinementHistory` in-memory only)
- No `heldOutQueries` mechanism
- No `auditTrail()` implementation

### Section 17 — Build Pipeline PARTIAL (~45%)
- `GraphBuilder` exists but no `incrementalBuild()`
- `cli.ts build` command is a stub (no pipeline wired)
- `cli.ts ingest` command is a stub (creates minimal node only)
- CLI flags (`--update`, `--resume`, `--force`) logged but not wired

### Section 18 — Project Status PARTIAL (~55%)
- CLI has 12 commands wired (build, query, ask, ingest, lint, status, path, benchmark, refine, serve, skill, export)
- Version mismatch: spec says `2.0.0-alpha.0`, `package.json` says `2.0.0`

---

## Revised Implementation Phases

### Phase 0: Hotfix — Add `lib/` to `package.json` files array (10 minutes)
**CRITICAL. Do before any other phase.**

**Steps:**
1. Add `"lib"` to `package.json` `files` array (insert after `"scripts"`)
2. Verify: `npm pack --dry-run` includes `lib/stdin.mjs`
3. No test changes needed

**Acceptance:** `npm pack --dry-run 2>/dev/null | grep -q lib/` returns true.

---

### Phase A: Extraction Quality + Build Pipeline Wiring (Week 1-2)

**Scope:**
- Real tokenizer for `ONNXEmbedding`
- tree-sitter parser packages added to `package.json`
- Wire `LLMExtractor` + `ASTExtractor` into `cli.ts build` command
- Define `IncrementalBuildResult` type to `src/types.ts`
- Implement `incrementalBuild()` in `src/graph/builder.ts`
- Wire `computeDelta` into build command
- Add offline fallback flag `--no-onnx` with rough similarity

**Explicit enumeration of all 11 changes:**

| # | File | Change |
|---|------|--------|
| A1 | `package.json` | Add `"tree-sitter-typescript", "tree-sitter-python", "tree-sitter-go", "tree-sitter-rust", "tree-sitter-java", "tree-sitter-c", "tree-sitter-cpp", "tree-sitter-c-sharp", "tree-sitter-bash"` to `devDependencies` |
| A2 | `src/dedup/embedding.ts` | Replace `_tokenize()` stub with `@huggingface/transformers` tokenizer (add as dependency) OR use `tiktoken` for fallback |
| A3 | `src/types.ts` | Add `IncrementalBuildResult` interface with fields: `{ addedNodes: GraphNode[], removedNodes: string[], modifiedNodes: GraphNode[], unchangedNodes: string[], totalNodes: number, totalEdges: number, buildDurationMs: number }` |
| A4 | `src/graph/builder.ts` | Add `incrementalBuild()` method using `computeDelta` |
| A5 | `src/cli.ts` `build` command | Replace stub with: (a) invoke `ASTExtractor` for code files, (b) invoke `LLMExtractor` for docs, (c) call `BatchCoordinator`, (d) call `GraphBuilder`, (e) call `incrementalBuild()`, (f) wire `--update` flag to delta mode |
| A6 | `src/cli.ts` `build` command | Wire `--force` to clear cache and full rebuild |
| A7 | `src/cli.ts` `build` command | Wire `--resume` to read `BatchState` and continue |
| A8 | `src/cli.ts` `build` command | Wire `--permissive` to `LLMExtractor` permissive mode |
| A9 | `src/cli.ts` `build` command | Wire `--full-cluster` to include all communities |
| A10 | `src/graph/delta.ts` | Call `persistDelta()` when `--update` is used |
| A11 | `src/dedup/embedding.ts` | Add `--no-onnx` fallback: use `text.length / 50` as rough similarity score |

**Acceptance:**
- `graphwiki build .` produces a `.graphwiki/graph.json` with **>= 5 nodes AND >= 1 edge**
- `graphwiki build . --update` on unchanged corpus re-extracts 0 files (all cache hits)
- `graphwiki build . --update` on changed files only re-extracts changed files
- `graphwiki build . --force` clears cache AND manifest is deleted (verify by checking `.graphwiki/manifest.json` does not exist after `--force`)
- `graphwiki build . --no-onnx` flag accepted and build completes (even if embeddings are stub/rough)
- Without network, `--no-onnx` flag allows build to proceed with rough similarity

---

### Phase B.1: MCP Query Tools with Stub Graph (Immediate, Week 1)
**Runs immediately after Phase 0. No dependency on Phase A.**

**Scope:** 6 CLI commands + MCP executor for query-only tools using a pre-seeded graph fixture (not Phase A output).

**All 11 changes (same as old Phase B, but using stub graph fixture):**

| # | CLI command | MCP tool name | Executor function | Status |
|---|-------------|---------------|-------------------|--------|
| B1 | `graphwiki status` | `status` | `execStatus(graph)` | CLI command exists (cli.ts:313-357) — verify MCP executor wires to it |
| B2 | `graphwiki wiki-list` | `wiki_list` | `execWikiList(graph, wikiDir)` | **NEW**: list wiki pages, filter by type |
| B3 | `graphwiki wiki-read <title>` | `wiki_read` | `execWikiRead(graph, wikiDir, title)` | **NEW**: read specific wiki page |
| B4 | `graphwiki wiki-search <query>` | `wiki_search` | `execWikiSearch(graph, wikiDir, query)` | **NEW**: search wiki by content |
| B5 | `graphwiki community-list` | `community_list` | `execCommunityList(graph)` | **NEW**: list all communities |
| B6 | `graphwiki community-summary <id>` | `community_summary` | `execCommunitySummary(graph, wikiDir, id)` | **NEW**: get community summary |
| B7 | Wire `mcp-stdio.ts` to executor | `tools/call` handler | `registerTools(GRAPH_WIKI_TOOLS, executor)` | Connect `serve/tools.ts` to transport |
| B8 | Wire `mcp-http.ts` to executor | `tools/call` handler | Same executor, HTTP transport | Connect to HTTP transport |
| B9 | Add MCP `initialize` handshake | `initialize` | Return server capabilities | Required for MCP protocol |
| B10 | Add `graphwiki path <a> <b>` MCP tool | `shortest_path` | `execShortestPath(graph, a, b)` | CLI command exists (cli.ts:359-394) — wire to MCP |
| B11 | Add `graphwiki get-node <id>` MCP tool | `get_node` | `execGetNode(graph, id)` | **NEW**: get node by ID with neighbors |

**Fixture creation (part of Phase B.1 scope):**

| # | Fixture file | Content |
|---|-------------|---------|
| B12 | `tests/fixtures/sample-graph.json` | Simple 3-node, 2-edge graph fixture (nodes must have `id`, `type`, `label`; edges must have `source`, `target`) |
| B13 | `tests/fixtures/sample-wiki-pages.json` | 3 minimal wiki pages: (1) index page, (2) overview page, (3) one concept page — each with `title` and `content` fields |

**Acceptance:**
- MCP stdio responds to 6+ tools with **schema-valid response objects** (each tool returns expected field structure, not empty `{}`)
- `graphwiki status` outputs node count, edge count, communities, density
- `graphwiki wiki-list` returns list of wiki pages from fixture
- `graphwiki community-list` outputs communities with node counts from fixture
- MCP HTTP transport responds to `/mcp` POST with tool call

---

### Phase B.2: Real Graph Verification (After Phase A complete, Week 2-3)
**Prerequisite: Phase A must be complete (graph.json produced by Phase A).**

**Scope:** Verify same 6 tools work against real graph.json produced by Phase A.

**All 4 changes:**

| # | Change |
|---|--------|
| B14 | Wire `execWikiList`, `execWikiRead`, `execWikiSearch` to real `wiki/` directory (not fixture) |
| B15 | Wire `execCommunityList`, `execCommunitySummary` to real graph (not fixture) |
| B16 | Add `tests/integration/query-tiered.test.ts` — verifies same 6 query tools work against real `.graphwiki/graph.json` |
| B17 | Implement the 7 missing skill scripts: `graphwiki-build.mjs`, `graphwiki-lint-errors.mjs`, `graphwiki-report.mjs`, `graphwiki-query.mjs`, `graphwiki-status.mjs`, `graphwiki-rollback.mjs`, `graphwiki-build-report.mjs` — or explicitly mark as "optional polish, not blocking" |

**Acceptance:**
- `wiki-list` returns pages from real `wiki/` directory
- `community-list` returns communities from real graph
- All 6 query tools produce schema-valid responses against real graph data
- 1 integration test passes: `tests/integration/query-tiered.test.ts`

---

### Phase C: MCP Build/Ingest Tools (Week 3, after Phase A)

**Scope:** Wire `build` and `ingest` tools to MCP executor. Add 3 integration tests.

**Prerequisite:** Phase A must be complete (extraction pipeline wired to CLI) before this phase.

**All 10 changes:**

| # | Change |
|---|--------|
| C1 | Wire `cli.ts build` command as MCP `build` tool |
| C2 | Wire `cli.ts ingest` command as MCP `ingest` tool — replace stub (cli.ts:214-256) with `LLMExtractor.extract(buffer, type, path)` |
| C3 | Wire `writeLock` mutex before any graph mutation in tool executor — **positive criterion:** writeLock mutex is acquired before any graph mutation; verified by `mcp-stdio.test.ts` concurrent mutation test |
| C4 | Wire `lint --fix` as MCP `lint` tool |
| C5 | Wire `benchmark` command as MCP `benchmark` tool |
| C6 | Wire `ask` command as MCP `ask` tool |
| C7 | Wire `query` command as MCP `query_graph` tool (keyword matching on graph nodes) |
| C8 | Wire `get_neighbors` MCP tool using `tools.ts getNeighbors()` |
| C9 | Add `tests/integration/mcp-stdio.test.ts` — starts stdio transport, makes 3 tool calls, verifies JSON-RPC responses, includes concurrent mutation test for writeLock |
| C10 | Add `tests/integration/build-delta.test.ts` — runs build, verifies `.graphwiki/graph.json` and `graphwiki-out/deltas/*.delta.json` both exist |
| C11 | Add `tests/integration/query-tiered.test.ts` — verifies all 6 query tools produce schema-valid responses against real graph.json from Phase A |

**Acceptance:**
- All 15 MCP tools respond with valid JSON-RPC responses
- 3 integration tests pass: (1) `tests/integration/mcp-stdio.test.ts`, (2) `tests/integration/build-delta.test.ts`, (3) `tests/integration/query-tiered.test.ts` — all must be enumerated in the change table
- **Concurrent HTTP clients do not corrupt graph state** — positive criterion: writeLock mutex is acquired before any graph mutation; verified by `mcp-stdio.test.ts` concurrent mutation test

---

### Phase 2: Incremental Build & Delta Tracking (Week 2-3, overlaps Phase A/B)

**Scope:** Delta persistence, lock file management, atomic writes, and crash recovery.

| # | Change |
|---|--------|
| D1 | Add lock file management to `cli.ts build` — write `.graphwiki/.lock` with PID and version, check on start, refuse if locked by another process. Handles concurrent incremental builds (P6 mitigation). |
| D2 | Add `graphwiki rollback` CLI command — restore previous graph from `graphwiki-out/deltas/` |
| D3 | Wire `DriftLog` output to `graphwiki-out/drift.log` |
| D4 | Fix `batch-coordinator.ts` orphaned-assignment gap on crash recovery. Current: `writeState()` serializes `assigned_files` as array but if process crashes after `assignFiles` but before `markComplete`, those assignments are silently lost. Add: recovery path for orphaned subagent assignments on resume. Add: `tests/integration/batch-state-recovery.test.ts` that exercises assign->crash->resume cycle. Mitigates P4 partial-write corruption by adding atomic write pattern (write to temp + rename) and treating parse failures as corrupted state, not empty state. |

---

### Phase 4: Refinement Persistence (Week 4-5)

| # | Change |
|---|--------|
| E1 | Implement `auditTrail()` in `src/refine/history.ts` — file-backed JSON storage with timestamped entries |
| E2 | Add `src/refine/held-queries.ts` — loads `held_out_queries.json` for validation |
| E3 | Wire `Ratchet.validate()` into `graphwiki refine --validate` CLI command |
| E4 | Implement rollback for prompt versions in history |
| E5 | Add `tests/integration/refinement-validate.test.ts` |
| E6 | Specify path/schema for refinement history: `graphwiki-out/refinement-history.json` with schema: `{ version: string, entries: Array<{ id: string, timestamp: string, promptVersion: string, score: number, diagnostics: string[] }> }` |

---

### Phase 5: Benchmark Token Accuracy (Week 5-6)

| # | Change |
|---|--------|
| F1 | Add `tiktoken` package for GPT tokenization |
| F2 | Replace `text.length / 4` in `baseline-runner.ts` with real tiktoken counts using `cl100k_base` tokenizer (GPT-4 / GPT-3.5 Turbo tokenizer) |
| F3 | Add `baseline_comparison()` method — runs current vs stored baseline |
| F4 | Add `held_out_queries.json` with 20 benchmark queries (need held-out set from v1 or synthetic) |
| F5 | Generate `BenchmarkReport` with `total_tokens`, `avg_tokens_per_query`, `winner` |
| F6 | Add `tests/benchmark/` files — at least `token-accuracy.test.ts` |

---

## Version Fix

- Spec says `2.0.0-alpha.0`; `package.json` says `2.0.0`. Recommendation: `2.0.0-alpha.1` for published npm until Phase C is complete, then bump to `2.0.0` on first stable release.

---

## Success Criteria Summary

| Phase | Criterion |
|-------|-----------|
| Phase 0 | `npm pack --dry-run` includes `lib/stdin.mjs` |
| Phase A | `graphwiki build .` produces graph.json with >= 5 nodes AND >= 1 edge; `--update` does delta-only; `--force` clears cache AND manifest is deleted; `--no-onnx` fallback works without network |
| Phase B.1 | MCP stdio responds to 6+ tools with schema-valid response objects; `tests/fixtures/sample-graph.json` and `tests/fixtures/sample-wiki-pages.json` fixtures created |
| Phase B.2 | Same 6 tools work against real graph.json produced by Phase A; wiki-list returns pages from real wiki/ directory; community-list returns communities from real graph |
| Phase C | All 15 tools wired; 3 integration tests pass (name all 3: (1) mcp-stdio.test.ts, (2) build-delta.test.ts, (3) query-tiered.test.ts); writeLock mutex acquired before any graph mutation |
| Phase 2 | Lock file prevents concurrent builds; atomic write pattern in BatchCoordinator; orphaned-assignment recovery path exists; rollback restores graph |
| Phase 4 | Refinement history persisted to `graphwiki-out/refinement-history.json` with specified schema; rollback works |
| Phase 5 | Token counts accurate (< 2% error vs tiktoken); `cl100k_base` tokenizer used; benchmark shows winner |

---

## Open Questions
- [ ] **HF model strategy:** Bundle quantized model in npm (adds ~20MB) or fetch at runtime with offline fallback? Decision gates Phase A tokenization approach.
- [ ] **Held-out query set:** Does a `held_out_queries.json` from GraphWiki v1 exist? If so, use it. If not, who writes the 20 benchmark queries for Phase 5?
- [ ] **Version:** `2.0.0-alpha.0` (spec) vs `2.0.0` (package.json) — adopt `2.0.0-alpha.1`?
- [ ] **`ingest` interpretation:** `cli.ts:214-256` creates a minimal source node. "Wire LLMExtractor to ingest" = replace stub entirely with `LLMExtractor.extract()`. Confirmed? If yes, the stub at lines 230-246 is removed.
- [ ] **`query/embedder.ts`:** Explicitly mark as "defer to post-Phase C" — `QueryRouter` tier-2 can use keyword matching instead of embedding-based routing until after Phase C is complete.
- [ ] **7 missing scripts:** `graphwiki-build.mjs`, `graphwiki-report.mjs`, `graphwiki-query.mjs`, `graphwiki-status.mjs`, `graphwiki-rollback.mjs`, `graphwiki-build-report.mjs`, `graphwiki-lint-errors.mjs` — assigned to Phase B.2 scope as optional polish, not blocking.
