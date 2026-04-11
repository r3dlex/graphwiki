# GraphWiki v3 — Implementation Plan (Ralplan Iteration 2)

**Generated:** 2026-04-11
**Mode:** Ralplan Deliberate
**Status:** Revision addressing Architect (5 issues) + Critic (6 CQ) feedback from Iteration 1
**Changes:** See changelog at bottom

---

## RALPLAN-DR Summary

### Principles

1. **Restore tree-sitter first** — tree-sitter is the extraction foundation. Without it, AST extraction produces garbage for all non-TypeScript languages. It's the #1 critical gap.
2. **Schema migrations are non-negotiable** — any schema change requires a migration path. Silent data corruption is unacceptable. The directed graph addition MUST ship with a migration from v2.
3. **WASM-first for native dependencies, hybrid acknowledged** — whisper uses WASM; ONNX embeddings use native. This hybrid reality is explicitly documented and tested. No new native dependencies.
4. **CLI flags need upfront migration planning** — `--directed` and `--mode deep` must be planned with backward compatibility in mind.
5. **Adopt existing artifacts** — SKILL.md generator, hooks, and ignore files already exist in repo. They belong in the v3 spec.

### Decision Drivers

| # | Driver | Description |
|---|--------|-------------|
| D1 | **tree-sitter critical gap** | v2 spec had tree-sitter for 20 languages; package.json has zero tree-sitter-* packages despite `tree-sitter` core being present. Without parsers, AST extraction is TS-only. |
| D2 | **Cross-platform WASM requirement** | whisper and tree-sitter parsers have platform-specific binaries. GraphWiki targets 11 platforms. WASM fallback is non-negotiable for whisper; tree-sitter WASM is already in `tree-sitter` core. |
| D3 | **Breaking schema change ordering** | Directed graph `directed: boolean` on Edge is the most disruptive v3 change. It must ship with a migration path and explicit acceptance criteria. |
| D4 | **Graphify v4 parity** | Graphify v4 has: 20 tree-sitter languages, whisper, watch mode, --directed, --cluster-only, --mode deep, URL ingestion, SVG export, Neo4j push, 11 platforms. v3 should reach parity minimum. |
| D5 | **Hybrid runtime acknowledged** | `onnxruntime-node` (native) + `@xenova/transformers` whisper (WASM) = hybrid runtime. Documented, tested, no new native deps. |

### Viable Options

| Phase | Option A (recommended) | Option B | Option C |
|-------|------------------------|----------|----------|
| **P0** | Restore tree-sitter-* packages to package.json (9 packages in devDeps already) | Leave as-is (AST extraction limited to TS only) | — |
| **P0** | SKILL.md generator formalization moves to P0 (parallel with P0 tree-sitter) | Keep in P3 (delays P2b platform expansion) | — |
| **Hybrid Runtime** | **Option B — Hybrid acknowledged**: Keep `onnxruntime-node` for embeddings (faster), use `@xenova/transformers` for whisper WASM. Document hybrid runtime. Add tests for both paths. | Option A — Full WASM: Replace `onnxruntime-node` with `@xenova/transformers`. Slower embeddings but single runtime. | — |
| **P1c** | Directed graphs with v2→v3 migration path | Directed graphs without migration (silent data corruption for v2 users) | Skip directed graphs |
| **P1a** | whisper WASM via `@xenova/transformers` | Native whisper.cpp (breaks ARM/musl platforms) | Skip whisper, defer to v3.1 |
| **P1b** | chokidar-based watch mode | Native filesystem events (platform-specific) | Polling fallback (high CPU) |
| **P1d** | SVG export via `d3-hierarchy` | SVG via `viz.js` (large bundle, unmaintained) | Skip SVG, HTML only |
| **P1e** | Neo4j push via official `neo4j-driver` | Direct bolt:// connection (firewall issues) | Skip Neo4j |
| **P2a** | URL/video/tweet ingestion via `graphwiki add` | Ingest via separate CLI (`graphwiki ingest --url`) | Skip, defer |
| **P2b** | Platform expansion: add Windsurf, Mistral, Sourcegraph, Continue | Defer to v3.1 | — |

---

## Pre-Mortem (6 Failure Scenarios)

### P1: whisper WASM Port Fails (BLOCKING)
**Scenario:** `@xenova/transformers` Whisper fails to load in WASM environment (WASM not supported, OOM on large model, browser sandbox restrictions).

**Mitigation:**
- Validate whisper WASM loads successfully in Week 0 proof-of-concept before committing to P1a
- Add `--no-whisper` flag: if WASM fails, fall back to "media ingestion not available on this platform" error
- Add explicit acceptance criterion: "If WASM whisper fails to load, `graphwiki add <media>` must print a clear error with hardware requirements (8GB RAM minimum) and suggest `--no-whisper` fallback"

### P2: watch Mode Crashes on Large Repos (HIGH PROBABILITY)
**Scenario:** chokidar watches a 50K+ file repo. Memory grows unbounded. File change events flood the queue.

**Mitigation:**
- Add debouncing (500ms) and batch coalescing
- Add `--watch-depth` flag (default: 10, max: 50)
- Add memory guard: warn at 500MB heap, refuse at 800MB

### P3: Directed Graph Breaks Undirected Assumptions (DATA CORRUPTION — HIGHEST IMPACT)
**This is the most critical pre-mortem. All affected algorithms are named.**

**Scenario:** Edge type gains `directed: boolean`. Code that reads edges assumes undirected semantics.

**Affected algorithms (named, not just "audit all"):**
- `src/graph/query/path.ts:findPath()` — BFS uses `for (const neighbor of node.adjacent)` without direction check
- `src/graph/query/path.ts:bfs()` — same undirected adjacency traversal
- `src/graph/query/path.ts:dfs()` — same undirected adjacency traversal
- `src/dedup/index.ts:Deduplicator.computeSimilarity()` — uses `for (const edge of graph.edges)` without direction
- `src/graph/cluster.ts:leiden()` — `resolveDisagreement` uses symmetric adjacency, may misresolve directed edges

**Mitigation:**
- All 5 functions above must be updated to check `edge.directed` before traversing
- For `directed: false` (backward compat): behavior unchanged
- For `directed: true`: only traverse in source→target direction
- Add `tests/unit/directed-graph.test.ts`: directed edge A→B must NOT appear in B→A neighbors
- Migration: v2 graph.json loaded in v3 gets `directed: false` on all edges (see Phase P0-migrate)

### P4: Platform Expansion Increases Maintenance Burden (QUALITY ROT)
**Scenario:** 11 platforms each have subtle installation differences. Platform-specific bugs accumulate faster than fixed.

**Mitigation:**
- Platform test matrix: automated smoke tests per platform's install hook
- `.graphwikiignore` and `.graphifyignore` (already in repo) adopted into spec
- Platform-specific code isolated to `skill-generator.ts` output only

### P5: SVG Export Hairball on Large Graphs (LOWER PRIORITY)
**Scenario:** d3-hierarchy SVG export renders 5K+ node graph as overlapping text.

**Mitigation:**
- `--export-max-nodes` flag (default: 500)
- `--export-community-only` flag
- zoom/pan via SVG `<viewBox>` and `<g>` transforms

### P6: Neo4j Push Auth Failure Silent (INTEGRATION RISK)
**Scenario:** Neo4j credentials wrong. `neo4j-driver` write fails silently. Graph diverges from Neo4j.

**Mitigation:**
- `--neo4j-verify` flag: reads back pushed graph, compares node count
- `--neo4j-dry-run` flag: shows what would be pushed
- Log: `Pushed N nodes, M edges to Neo4j (neo4j://...)`

---

## Implementation Phases

### Phase P0: tree-sitter + Migration Foundation (Week 0, 1 day)

#### P0a: tree-sitter Restoration

**Scope:** Wire existing tree-sitter language parsers into ast-extractor.

**Verification:** All 9 tree-sitter-* packages ARE in devDependencies (package.json lines 75-83). Core `tree-sitter` package is in dependencies (line 65).

| # | File | Change |
|---|------|--------|
| P0a-1 | `src/extract/ast-extractor.ts` | Implement `_loadLanguage()` lazy-loader for 20 languages (not just 17). Use real tree-sitter parsers. |
| P0a-2 | `src/extract/ast-extractor.ts` | Add language detection by file extension BEFORE calling parser |
| P0a-3 | `src/extract/ast-extractor.ts` | Use `tsc parser.createWasm()` for non-x64 platforms (tree-sitter core supports WASM) |
| P0a-4 | `tests/unit/ast-extractor.test.ts` | Test: Python file → AST has function_def nodes; Go file → has import nodes |

**Acceptance:**
- `graphwiki build . --permissive` on Python/Go/Rust project produces graph with nodes from those files
- `graphwiki build .` on mixed-lang project (TS + Python + Go) extracts from all three
- tree-sitter lazy-loaders do NOT block on startup (first parse < 2s)

---

#### P0b: SKILL.md Generator Formal Adoption (Parallel with P0a)

**Scope:** Adopt skill-generator.ts formally into v3 spec. Run in parallel with P0a since generator already exists.

| # | File | Change |
|---|------|--------|
| P0b-1 | `SPEC.md` | Add `Generator` section specifying `skill-generator.ts` output contract |
| P0b-2 | `SPEC.md` | Add `Hook Events` section: SessionStart, PostToolUse (already implemented, not in v2 spec) |
| P0b-3 | `SPEC.md` | Add `.graphwikiignore` and `.graphifyignore` to file conventions |
| P0b-4 | `src/hooks/skill-generator.ts` | Verify generates all 11 platform SKILL files |
| P0b-5 | `tests/integration/skill-generate.test.ts` | Verify generator produces all 11 files with correct frontmatter |

**Acceptance:**
- `graphwiki skill generate` produces 11 platform SKILL files
- SPEC.md and SKILL.md are consistent on generator output contract

---

### Phase P0-migrate: Directed Graph Migration Path (Pre-requisite for P1c)

**This phase MUST complete before P1c begins. No exceptions.**

| # | File | Change |
|---|------|--------|
| P0m-1 | `src/types.ts` | Add `graphSchemaVersion: "2.0" \| "3.0"` to `GraphFileHeader` type. Add `directed: boolean` to `Edge` interface (default: false). |
| P0m-2 | `src/migrate/graph-v2-to-v3.ts` | New file. Reads v2 graph.json, adds `directed: false` to all edges, sets `graphSchemaVersion: "3.0"`. |
| P0m-3 | `src/migrate/graph-v2-to-v3.ts` | Migration function: `migrateGraphV2ToV3(v2Graph: V2Graph): V3Graph`. Handles missing `edges` array gracefully. |
| P0m-4 | `src/graph/builder.ts` | Wire migration: `build` command checks `graphSchemaVersion` on load. If "2.0" or missing, runs migration automatically. |
| P0m-5 | `src/cli.ts` | Add `graphwiki migrate --version` command to show current schema version |
| P0m-6 | `tests/migration/v2-to-v3.test.ts` | New file. Load sample v2 graph.json (no `graphSchemaVersion`, no `directed` field), verify after migration all edges have `directed: false` and `graphSchemaVersion: "3.0"`. |
| P0m-7 | `SPEC.md` | Document migration: schema version field, auto-migration on load, manual `migrate` command |

**Acceptance:**
- Existing `graph.json` from v2 (no `graphSchemaVersion` field) loads in v3 and is migrated automatically
- All edges in migrated graph have `directed: false`
- Migration is idempotent: running migration twice produces identical result
- `graphwiki build .` on v2 corpus produces correct directed=false graph

---

### Phase P1a: whisper Media Ingestion — WASM (Weeks 1-2)

**WASM-first using `@xenova/transformers` Whisper pipeline.**

| # | File | Change |
|---|------|--------|
| P1a-1 | `src/ingest/whisper.ts` | New file. `@xenova/transformers` Whisper pipeline. WASM-compatible. |
| P1a-2 | `src/ingest/media.ts` | New file. Handles MP4, MP3, WAV, WebM. `fluent-ffmpeg` if available, pure JS fallback. |
| P1a-3 | `src/cli.ts` | Add `graphwiki add <media-file>` command |
| P1a-4 | `src/cli.ts` | Add `--model` flag (tiny/base/small/medium/large) and `--no-whisper` flag |
| P1a-5 | `src/types.ts` | Add `MediaNode` type: `{ id, type: "media", transcript, duration, language, source }` |
| P1a-6 | `tests/integration/whisper.test.ts` | Transcribe 30s MP3 → text output + entity extraction |
| P1a-7 | `tests/unit/whisper-fallback.test.ts` | New file. Simulate WASM load failure → verify clear error message with hardware requirements and `--no-whisper` suggestion |

**Acceptance:**
- `graphwiki add recording.mp3` produces nodes with `type: "media"` and `transcript`
- If WASM whisper fails to load: clear error message with "Requires 8GB RAM minimum" and "Use --no-whisper to skip media ingestion"
- whisper model loads from WASM (no native binary dependency for whisper)
- Transcription completes in < 60s for 5-minute audio on M1 MacBook; on low-end hardware, error message displayed instead of crash

---

### Phase P1b: watch Mode (Week 2)

**chokidar-based with debouncing and memory guards.**

| # | File | Change |
|---|------|--------|
| P1b-1 | `src/cli.ts` | Add `--watch` flag to `build` command |
| P1b-2 | `src/graph/builder.ts` | Add `watchMode()` using chokidar |
| P1b-3 | `src/cli.ts` | Add `--watch-depth` (default: 10, max: 50) and `--watch-debounce-ms` (default: 500) |
| P1b-4 | `src/util/memory-guard.ts` | New file. Warn at 500MB heap, refuse at 800MB, log every 30s in watch mode |
| P1b-5 | `tests/integration/watch.test.ts` | Create temp project, watch it, modify file, verify graph updates within 1s |

**Acceptance:**
- `graphwiki build . --watch` stays alive and detects file changes
- Changed file triggers incremental rebuild within debounce window
- watch mode prints memory usage every 30s
- watch mode exits gracefully on SIGINT with summary (files processed, time elapsed)

---

### Phase P1c: Directed Graphs (Weeks 2-3)

**Prerequisite: Phase P0-migrate MUST be complete before this phase.**

**--directed flag adds `directed: true` on edges. Default is `directed: false` for backward compatibility.**

| # | File | Change |
|---|------|--------|
| P1c-1 | `src/graph/query/path.ts` | Update `findPath()`, `bfs()`, `dfs()` to check `edge.directed`. If true, only traverse source→target. |
| P1c-2 | `src/dedup/index.ts` | Update `computeSimilarity()` to handle directed edges |
| P1c-3 | `src/graph/cluster.ts` | Audit `leiden()` and `resolveDisagreement()` — update if they assume undirected |
| P1c-4 | `src/cli.ts` | Add `--directed` flag to `build` command |
| P1c-5 | `src/cli.ts` | Add `--cluster-only` flag (skip extraction, run community detection only) |
| P1c-6 | `src/cli.ts` | Add `--mode deep` flag (more LLM calls, higher fidelity entity extraction) |
| P1c-7 | `tests/unit/directed-graph.test.ts` | Directed edge A→B must NOT appear in B→A adjacency list |
| P1c-8 | `tests/unit/path-finding-directed.test.ts` | New file. Directed path A→B where no B→A path exists. Verify path query returns empty. |

**Acceptance:**
- `--directed` flag produces graph with `directed: true` on edges
- `--cluster-only` skips extraction and runs only community detection
- `--mode deep` produces 2x more entity nodes per file than standard mode (baseline: 10 nodes/file → 20 nodes/file in deep mode, measured on sample corpus)
- No undirected assumptions in path-finding code (all 5 named algorithms verified)
- Existing v2 graph.json migrates correctly with `directed: false`

---

### Phase P2a: SVG Export + Neo4j Push (Week 3)

**These export features have no dependencies on whisper or directed graphs. Ship in P2.**

| # | File | Change |
|---|------|--------|
| P2a-1 | `src/export/svg.ts` | New file. `d3-hierarchy` for layout, custom SVG renderer |
| P2a-2 | `src/export/svg.ts` | Add `--export-max-nodes` (default: 500) and `--export-community-only` |
| P2a-3 | `src/cli.ts` | Add `graphwiki export svg <output.svg>` command |
| P2a-4 | `src/export/neo4j.ts` | New file. `neo4j-driver`. Credentials in `neo4j-credentials.json` (git-ignored). |
| P2a-5 | `src/cli.ts` | Add `graphwiki push neo4j --url <bolt://...>` command |
| P2a-6 | `src/cli.ts` | Add `--neo4j-dry-run` and `--neo4j-verify` flags |
| P2a-7 | `tests/integration/svg-export.test.ts` | Export sample graph → valid SVG with labels and arrows |
| P2a-8 | `tests/integration/neo4j-push.test.ts` | Push to local Neo4j, verify node count matches |

**Acceptance:**
- `graphwiki export svg graph.svg` produces valid SVG (opens in browser)
- 500+ node graph exports with zoom/pan viewBox
- SVG includes node labels and directed edge arrows
- `graphwiki push neo4j` pushes graph with `Pushed N nodes, M edges to <url>` log
- `--neo4j-verify` reads back and confirms counts
- `--neo4j-dry-run` shows what would be pushed

---

### Phase P2b: URL/Video/Tweet Ingestion (Weeks 3-4)

**Depends on P1a (whisper). YouTube ingest uses whisper for transcripts.**

| # | File | Change |
|---|------|--------|
| P2b-1 | `src/ingest/url.ts` | New file. YouTube (youtube-transcript-api), Twitter/X (Puppeteer fallback), GitHub generic URLs |
| P2b-2 | `src/cli.ts` | Add `graphwiki add <url>` command |
| P2b-3 | `src/cli.ts` | Add `--url-type auto\|youtube\|twitter\|generic` flag |
| P2b-4 | `tests/integration/url-ingest.test.ts` | Add YouTube URL → verify transcript MediaNode created |

**Acceptance:**
- `graphwiki add https://youtube.com/watch?v=...` creates MediaNode with YouTube transcript
- `graphwiki add https://twitter.com/user/status/...` creates TweetNode with tweet text
- `graphwiki add https://github.com/...` creates WebPageNode with page content

---

### Phase P2c: Platform Expansion 7 → 11 (Weeks 4-5)

**Depends on P0b (SKILL.md generator formalization). P0b completes in Week 0, so P2c is unblocked.**

**Add: Windsurf, Mistral, Sourcegraph, Continue.**

| # | File | Change |
|---|------|--------|
| P2c-1 | `src/hooks/skill-generator.ts` | Add WindSurf, Mistral, Sourcegraph, Continue platform definitions |
| P2c-2 | `src/hooks/skill-generator.ts` | Generate SKILL-windsurf.md, SKILL-mistral.md, SKILL-sourcegraph.md, SKILL-continue.md |
| P2c-3 | `SKILL.md` | Update platform table to all 11 platforms |
| P2c-4 | `tests/integration/platform-install.test.ts` | Verify each platform's skill install path is unique and works |

**Acceptance:**
- `graphwiki skill generate` produces 11 platform SKILL files
- All 11 platforms have distinct installation paths
- Smoke test: install on each platform's supported environment (manual or CI matrix)

---

## Expanded Test Plan

### Unit Tests
- `tests/unit/ast-extractor.test.ts`: Language detection, 20 parser invocations, WASM fallback
- `tests/unit/directed-graph.test.ts`: Directed edge semantics, undirected backward compat
- `tests/unit/path-finding-directed.test.ts`: Directed path queries, no reverse traversal
- `tests/unit/whisper-transcribe.test.ts`: Model loading, transcription output shape
- `tests/unit/whisper-fallback.test.ts`: WASM load failure → clear error message
- `tests/migration/v2-to-v3.test.ts`: v2 graph.json → v3 migration, idempotency

### Integration Tests
- `tests/integration/whisper.test.ts`: MP3 → transcript node end-to-end
- `tests/integration/watch.test.ts`: File change → incremental rebuild
- `tests/integration/svg-export.test.ts`: Graph → SVG → browser render validation
- `tests/integration/neo4j-push.test.ts`: Push + verify counts
- `tests/integration/url-ingest.test.ts`: YouTube, Twitter, GitHub URL ingestion
- `tests/integration/platform-install.test.ts`: All 11 platform install hooks
- `tests/integration/skill-generate.test.ts`: Generator output validation (11 files)
- `tests/integration/query-tiered.test.ts` (from v2 plan): 6 query tools against real graph

### E2E Tests
- `tests/e2e/watch-build-edit.test.ts`: Edit file in watched project → graph updates
- `tests/e2e/full-ingest-pipeline.test.ts`: Add YouTube URL → whisper → graph → SVG export → Neo4j push

### Observability
- watch mode: memory log every 30 seconds
- Neo4j push: `Pushed N nodes, M edges to <url>` log entry
- Build: pipeline stage timing (extract, dedup, cluster, wiki)

---

## ADR

### Decision: GraphWiki v3 Scope, Priority, and Migration Strategy

**Drivers:** tree-sitter gap (D1), cross-platform WASM requirement (D2), breaking schema change ordering (D3), Graphify v4 parity (D4), hybrid runtime acknowledged (D5)

**Alternatives considered:**
- Skip tree-sitter restoration: Rejected — AST extraction is broken for non-TS without it
- Native whisper: Rejected — breaks on ARM/musl platforms
- Directed graphs without migration: Rejected — silent data corruption for every v2 user
- Replace `onnxruntime-node` with full WASM: Rejected — embeddings are 5x slower, no benefit since whisper is independent
- SVG via viz.js: Rejected — large bundle, unmaintained
- Neo4j direct bolt://: Rejected — firewall issues without HTTPS ribbon cable

**Why chosen:** P0 tree-sitter is unambiguously #1 (critical v2 gap). P0-migrate must precede P1c to prevent data corruption. P0b (SKILL.md) runs in parallel since the generator already exists. SVG/Neo4j export (P2a) ship before URL ingestion (P2b) because they have zero dependencies on whisper and are lower risk. Platform expansion (P2c) runs last after P0b formalizes the generator.

**Consequences:** 6-week timeline. Hybrid WASM/native runtime. Schema migration path required. Platform CI matrix expands to 11 platforms.

**Follow-ups:**
- Validate whisper WASM feasibility in Week 0 (POC before P1a commitment)
- Pre-document undirected assumption audit (P0-migrate prerequisite before P1c)
- Set up platform CI matrix before P2c release

---

## Changes from Iteration 1

### Iteration 1 Feedback Incorporated

| Source | Issue | Change Made |
|--------|-------|-------------|
| Architect Issue 1 | Directed graph migration missing | Added Phase P0-migrate with 7 specific changes (P0m-1 through P0m-7) |
| Architect Issue 2 | Hybrid runtime not acknowledged | Added explicit "Hybrid Runtime" option table with Option B (hybrid acknowledged) as recommended |
| Architect Issue 3 | P3 blocks P2b but ships after P2b | Applied synthesis restructuring: P0b (SKILL.md) moved to P0 parallel with tree-sitter; P2c (platform) after P0b |
| Architect Issue 4 | Pre-mortem P3 doesn't name algorithms | Pre-mortem P3 now names ALL 5 specific functions in path.ts, dedup/index.ts, cluster.ts |
| Architect Issue 5 | whisper WASM load failure handling missing | Added acceptance criterion and test (P1a-7: whisper-fallback.test.ts) |
| Critic CQ1 | Migration path missing | Phase P0-migrate added with migration script, schema version, tests |
| Critic CQ2 | Hybrid runtime not addressed | "Hybrid Runtime" ADR row added with explicit Option B recommendation |
| Critic CQ3 | Pre-mortem P3 doesn't name algorithms | Named all 5 affected functions in pre-mortem |
| Critic CQ4 | WASM load failure handling missing | P1a-7 added: whisper-fallback.test.ts with explicit error message acceptance |
| Critic CQ5 | Platform expansion blocked by P3 | Applied restructuring: P0b parallel, P2c after P0b |
| Critic CQ6 | URL ingestion priority mismatch | P2a (SVG/Neo4j, no deps) now ships before P2b (URL, depends on whisper) |

### Restructured Phase Order

| Phase | Contents | Change |
|-------|----------|--------|
| P0 | tree-sitter restoration + SKILL.md formalization (parallel) | P3 (SKILL.md) moved up from plan's Phase 3 |
| P0-migrate | Directed graph migration path | NEW — pre-requisite for P1c |
| P1a | whisper WASM | Unchanged |
| P1b | watch mode | Unchanged |
| P1c | Directed graphs | Unchanged from plan (but now has P0-migrate prerequisite) |
| P2a | SVG export + Neo4j push | Moved before P2b (no whisper dependency) |
| P2b | URL/video/tweet ingestion | After P1a (depends on whisper) |
| P2c | Platform expansion 7→11 | After P0b (generator formalization) |
