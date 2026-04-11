# GraphWiki v3 — Implementation Plan (Ralplan Iteration 1)

**Generated:** 2026-04-11
**Mode:** Ralplan Deliberate (high-risk: 8+ major new features)
**Scope:** GraphWiki v3 over v2 gap analysis

---

## RALPLAN-DR Summary

### Principles

1. **Restore tree-sitter first** — tree-sitter is the extraction foundation. Without it, AST extraction produces garbage for all non-TypeScript languages. It's the #1 critical gap.
2. **Platform parity before feature expansion** — adding whisper/watch/neo4j/svg while still missing 4 platforms creates maintenance debt that compounds. Fix platforms first.
3. **WASM-first for cross-platform** — native binaries break on ARM, musl, older glibc. Use WASM for whisper and any new native dependencies.
4. **CLI flags are cheap, plan them upfront** — `--watch`, `--directed`, `--cluster-only`, `--mode deep` need spec before implementation to avoid flag sprawl.
5. **Adopt existing artifacts** — SKILL.md generator, hooks, and ignore files already exist in repo. They belong in the v3 spec.

### Decision Drivers

| # | Driver | Description |
|---|--------|-------------|
| D1 | **tree-sitter critical gap** | v2 spec had tree-sitter for 20 languages; package.json has zero tree-sitter-* packages despite `tree-sitter` core being present. Without parsers, AST extraction is TS-only. |
| D2 | **Cross-platform WASM requirement** | whisper.cpp, tree-sitter parsers, and ONNX runtime all have platform-specific binaries. GraphWiki targets 11 platforms. WASM fallback is non-negotiable. |
| D3 | **Feature priority ordering** | whisper (media ingestion), watch mode (chokidar), directed graphs, SVG/Neo4j export, and platform expansion (7→11) all compete for Phase 1. Need clear ordering. |
| D4 | **Graphify v4 parity** | Graphify v4 has: 20 tree-sitter languages, whisper, watch mode, --directed, --cluster-only, --mode deep, URL ingestion, SVG export, Neo4j push, 11 platforms. v3 should reach parity minimum. |
| D5 | **SKILL.md canonical adoption** | The skill-generator.ts already exists and generates 7 platform SKILL files. This must be formally adopted into v3 spec. |

### Viable Options

| Phase | Option A (recommended) | Option B | Option C |
|-------|------------------------|----------|----------|
| **P0** | Restore tree-sitter-* packages to package.json (9 packages already in devDeps per package.json) | Leave as-is (AST extraction limited to TS only) | — |
| **P1** | WASM-first whisper: `@hbase/transformers` or `whisper.cpp` WASM build | Native whisper.cpp binary (platform-specific, breaks on ARM/musl) | Skip whisper, defer to v3.1 |
| **P1** | chokidar-based watch mode (Node.js native, stable) | Native filesystem events (platform-specific) | Polling fallback (high CPU) |
| **P1** | Directed graph storage (add `directed: boolean` to Edge type) | Keep undirected-only (limits expressiveness) | — |
| **P1** | SVG export via `d3-hierarchy` + custom renderer | SVG export via `viz.js` (large bundle, unmaintained) | Skip SVG, HTML only |
| **P1** | Neo4j push via official `neo4j-driver` (HTTPS ribbon cable) | Direct bolt:// connection (firewall issues) | Skip Neo4j, GraphML only |
| **P2** | Platform expansion: add Windsurf, Mistral, Sourcegraph, Continue (4 new) | Defer to v3.1 | — |
| **P2** | URL/video/tweet ingestion via `graphwiki add` command | Ingest via separate CLI (`graphwiki ingest --url`) | Skip, defer to v3.1 |
| **P3** | Adopt SKILL.md generator formally into spec | Generator exists but not documented in spec | — |

---

## Pre-Mortem (6 Failure Scenarios)

### P1: whisper WASM Port Fails (BLOCKING)
**Scenario:** Attempting to port whisper.cpp to WASM fails or produces a >100MB bundle. whisper WASM is complex and poorly documented.

**Impact:** Video/audio ingestion blocked. Core v3 feature undeliverable.

**Mitigation:**
- Pre-mortem P1 mitigation: Validate whisper WASM feasibility in Week 0 before committing to Phase P1
- Alternative: Use `@xenova/transformers` with Whisper pipeline (slower but works in WASM/browser)
- Fallback: Offer `graphwiki add <file>` for local files only, defer URL-based ingestion to v3.1

### P2: watch Mode Crashes on Large Repos (HIGH PROBABILITY)
**Scenario:** chokidar watches a 50K+ file repo. Memory grows unbounded. File change events flood the queue.

**Impact:** watch mode unusable on real codebases. Core UX feature fails.

**Mitigation:**
- Add debouncing (500ms) and batch coalescing of change events
- Add `--watch-depth` flag to limit recursion depth
- Add memory guard: warn at 500MB heap, refuse at 800MB

### P3: Directed Graph Breaks Undirected Assumptions (DATA CORRUPTION)
**Scenario:** Edge type gains `directed: boolean` but existing graph queries assume undirected semantics. Path finding, community detection, and dedup all assume symmetric adjacency.

**Impact:** Silent wrong answers in path queries. Graph algorithms produce incorrect results.

**Mitigation:**
- Audit all graph algorithms for undirected assumptions before implementing directed
- Add integration test: directed edge A→B should NOT appear in B→A neighbors
- Mark directed mode as experimental in v3 with a warning

### P4: Platform Expansion Increases Maintenance Burden (QUALITY ROT)
**Scenario:** 11 platforms each have subtle installation differences. Platform-specific bugs accumulate faster than they're fixed.

**Impact:** GraphWiki appears broken on half the platforms. Reputation damage.

**Mitigation:**
- Platform test matrix: automated smoke tests for each platform's install hook
- Adopt `.graphwikiignore` and `.graphifyignore` (already in repo, not yet in spec)
- Platform-specific code isolated to `src/hooks/skill-generator.ts` output, not inline

### P5: SVG Export Produces Unreadable Hairball on Large Graphs (LOWER PRIORITY)
**Scenario:** `d3-hierarchy` SVG export renders a 5K-node graph as overlapping text. Graph is unreadable.

**Impact:** SVG export feature appears broken. Users revert to GraphML.

**Mitigation:**
- Add `--export-max-nodes` flag defaulting to 500
- Add `--export-community-only` flag to export one community at a time
- Add zoom/pan via SVG `<viewBox>` and `<g>` transforms

### P6: Neo4j Push Auth Failure Silent (INTEGRATION RISK)
**Scenario:** Neo4j credentials wrong or network partitioned. `neo4j-driver` write fails silently. User doesn't realize graph hasn't pushed.

**Impact:** Two sources of truth (local graph, Neo4j) diverge without warning.

**Mitigation:**
- Add `--neo4j-verify` flag that reads back the pushed graph and compares node count
- Add `--neo4j-dry-run` flag that shows what would be pushed without pushing
- Log every push: `Pushed 142 nodes, 380 edges to Neo4j (neo4j://...)`

---

## Implementation Phases

### Phase P0: tree-sitter Restoration (Week 0, 1 day)

**Critical path. Do before any other phase.**

**Scope:**
- Verify all 9 tree-sitter-* packages are in `devDependencies` (they ARE, per package.json lines 75-83)
- Wire tree-sitter language parsers into `src/extract/ast-extractor.ts`
- Implement lazy-loader stubs for 17 languages in `ast-extractor.ts`
- Add tree-sitter WASM builds for cross-platform (musl, ARM) via `@tree-sitter/html` WASM loader
- Verify AST extraction works for Python, Go, Rust, Java, C, C++, C#, Bash

**Changes:**

| # | File | Change |
|---|------|--------|
| P0-1 | `src/extract/ast-extractor.ts` | Implement `_loadLanguage()` lazy-loader for all 20 languages. Replace stub loaders with real tree-sitter parsers. |
| P0-2 | `src/extract/ast-extractor.ts` | Add language detection by file extension before calling parser |
| P0-3 | `src/extract/ast-extractor.ts` | Add WASM fallback path: `tsc parser.createWasm()` on non-x64 platforms |
| P0-4 | `tests/unit/ast-extractor.test.ts` | Add test: extract Python file → verify AST has function def nodes; extract Go file → verify has import nodes |

**Acceptance:**
- `graphwiki build . --permissive` on a Python/Go/Rust project produces graph with nodes from those files
- `graphwiki build .` on a mixed-lang project (TS + Python + Go) extracts from all three
- tree-sitter lazy-loaders do NOT block on startup (first parse is < 2s)

---

### Phase P1: Core New Features — whisper, watch, directed, SVG, Neo4j (Weeks 1-4)

#### P1a: whisper Media Ingestion (Week 1-2)

**WASM-first strategy using `@xenova/transformers` Whisper pipeline.**

| # | File | Change |
|---|------|--------|
| P1a-1 | `src/ingest/whisper.ts` | New file. `@xenova/transformers` Whisper pipeline. WASM-compatible. |
| P1a-2 | `src/ingest/media.ts` | New file. Handles MP4, MP3, WAV, WebM. Uses `fluent-ffmpeg` if available, pure JS fallback. |
| P1a-3 | `src/cli.ts` | Add `graphwiki add <media-file>` command. Transcribes + extracts entities. |
| P1a-4 | `src/cli.ts` | Add `--model` flag for whisper model selection (tiny/base/small/medium/large) |
| P1a-5 | `src/types.ts` | Add `MediaNode` type with `transcript`, `duration`, `language` fields |
| P1a-6 | `tests/integration/whisper.test.ts` | New file. Test transcription of 30s MP3 → text output, entity extraction |

**Acceptance:**
- `graphwiki add recording.mp3` produces nodes with `type: "media"` and `transcript` field
- whisper model loads from WASM (no native binary dependency)
- Transcription completes in < 60s for 5-minute audio on M1 MacBook

#### P1b: watch Mode (Week 2)

**chokidar-based with debouncing and memory guards.**

| # | File | Change |
|---|------|--------|
| P1b-1 | `src/cli.ts` | Add `--watch` flag to `build` command. Uses `chokidar`. |
| P1b-2 | `src/graph/builder.ts` | Add `watchMode(chokidar)` that runs incremental build on change events |
| P1b-3 | `src/cli.ts` | Add `--watch-depth` flag (default: 10, max: 50) |
| P1b-4 | `src/cli.ts` | Add `--watch-debounce-ms` flag (default: 500ms) |
| P1b-5 | `src/util/memory-guard.ts` | New file. Warns at 500MB heap, refuses at 800MB. |
| P1b-6 | `tests/integration/watch.test.ts` | New file. Create temp project, watch it, modify file, verify graph updates |

**Acceptance:**
- `graphwiki build . --watch` stays alive and detects file changes
- Changed file triggers incremental rebuild within 1 second (debounce respected)
- watch mode prints memory usage every 30 seconds
- watch mode exits gracefully on SIGINT with summary

#### P1c: Directed Graphs (Week 2-3)

| # | File | Change |
|---|------|--------|
| P1c-1 | `src/types.ts` | Add `directed: boolean` to `Edge` interface |
| P1c-2 | `src/graph/builder.ts` | Add `--directed` flag and `buildDirected()` path |
| P1c-3 | `src/graph/query/path.ts` | Audit all path-finding algorithms. Fix undirected-only assumptions. |
| P1c-4 | `src/graph/cluster.ts` | Verify Leiden community detection works for directed graphs |
| P1c-5 | `src/cli.ts` | Add `--cluster-only` flag: only run community detection, skip extraction |
| P1c-6 | `src/cli.ts` | Add `--mode deep` flag: enable deep entity extraction (more LLM calls, higher fidelity) |
| P1c-7 | `tests/unit/directed-graph.test.ts` | New file. Directed edge A→B should NOT appear in B→A adjacency |

**Acceptance:**
- `--directed` flag produces graph with `directed: true` on edges
- `--cluster-only` skips extraction and only runs community detection
- `--mode deep` produces 2x more entity nodes per file (verified against baseline)
- No undirected assumptions remain in path-finding code

#### P1d: SVG Export (Week 3)

| # | File | Change |
|---|------|--------|
| P1d-1 | `src/export/svg.ts` | New file. `d3-hierarchy` for layout, custom SVG renderer. |
| P1d-2 | `src/export/svg.ts` | Add `--export-max-nodes` (default: 500) and `--export-community-only` |
| P1d-3 | `src/cli.ts` | Add `graphwiki export svg <output.svg>` command |
| P1d-4 | `tests/integration/svg-export.test.ts` | New file. Export sample graph → valid SVG, open in browser |

**Acceptance:**
- `graphwiki export svg graph.svg` produces valid SVG with nodes and edges
- 500+ node graph exports with cluster/zoom viewBox (readable)
- SVG includes node labels and edge arrows for directed graphs

#### P1e: Neo4j Live Push (Week 3-4)

| # | File | Change |
|---|------|--------|
| P1e-1 | `src/export/neo4j.ts` | New file. `neo4j-driver` for connection, `graphwiki-out/neo4j-credentials.json` for credentials |
| P1e-2 | `src/cli.ts` | Add `graphwiki push neo4j --url <bolt://...>` command |
| P1e-3 | `src/cli.ts` | Add `--neo4j-dry-run` and `--neo4j-verify` flags |
| P1e-4 | `tests/integration/neo4j-push.test.ts` | New file. Push to local Neo4j, verify node count matches |

**Acceptance:**
- `graphwiki push neo4j --url bolt://localhost:7687` pushes graph to Neo4j
- `--neo4j-verify` reads back and confirms node/edge counts match
- `--neo4j-dry-run` prints what would be pushed without pushing
- Credentials stored in `neo4j-credentials.json` (git-ignored), never in args

---

### Phase P2: URL/Video/Tweet Ingestion + Platform Expansion (Weeks 4-6)

#### P2a: URL Ingestion via `graphwiki add`

| # | File | Change |
|---|------|--------|
| P2a-1 | `src/ingest/url.ts` | New file. Handles YouTube, Twitter/X, generic URLs. |
| P2a-2 | `src/ingest/url.ts` | YouTube: extract transcript via `youtube-transcript-api`. Twitter: extract tweet text via `@twitter-api/tweet` or Puppeteer fallback. |
| P2a-3 | `src/cli.ts` | Add `graphwiki add <url>` command |
| P2a-4 | `src/cli.ts` | Add `--url-type auto|youtube|twitter|generic` flag |
| P2a-5 | `tests/integration/url-ingest.test.ts` | New file. Add YouTube URL → verify transcript node created |

**Acceptance:**
- `graphwiki add https://youtube.com/watch?v=...` creates `MediaNode` with YouTube transcript
- `graphwiki add https://twitter.com/user/status/...` creates `TweetNode` with tweet text
- `graphwiki add https://github.com/...` creates `WebPageNode` with page content

#### P2b: Platform Expansion 7 → 11 (Week 5)

**Add: Windsurf, Mistral, Sourcegraph, Continue.**

| # | File | Change |
|---|------|--------|
| P2b-1 | `src/hooks/skill-generator.ts` | Add WindSurf, Mistral, Sourcegraph, Continue platform definitions |
| P2b-2 | `src/hooks/skill-generator.ts` | Generate `SKILL-windsurf.md`, `SKILL-mistral.md`, `SKILL-sourcegraph.md`, `SKILL-continue.md` |
| P2b-3 | `SKILL.md` | Update platform table to show all 11 platforms |
| P2b-4 | `tests/integration/platform-install.test.ts` | New file. For each platform, verify skill installs without error |

**Acceptance:**
- `graphwiki skill generate` produces 11 platform SKILL files
- Each platform's install path is unique (Windsurf, Mistral, Sourcegraph, Continue all have different hook APIs)
- Smoke test: install on each platform's supported environment

---

### Phase P3: SKILL.md Generator Formal Adoption (Week 6)

| # | File | Change |
|---|------|--------|
| P3-1 | `SPEC.md` | Add `Generator` section formally specifying `skill-generator.ts` output contract |
| P3-2 | `SPEC.md` | Add `Hook Events` section: SessionStart, PostToolUse (already implemented, not in original spec) |
| P3-3 | `SPEC.md` | Add `.graphwikiignore` and `.graphifyignore` to file conventions |
| P3-4 | `src/hooks/skill-generator.ts` | Verify generates all 11 platforms correctly |
| P3-5 | `tests/integration/skill-generate.test.ts` | New file. Run generator, verify all 11 files created with correct frontmatter |

**Acceptance:**
- `graphwiki skill generate` produces all 11 SKILL files
- Each SKILL file has correct `platforms:` frontmatter matching its platform
- SKILL.md and SPEC.md are consistent on generator output contract

---

## Expanded Test Plan

### Unit Tests
- `tests/unit/ast-extractor.test.ts`: Language detection, parser invocation, WASM fallback path
- `tests/unit/directed-graph.test.ts`: Directed edge semantics, undirected compatibility
- `tests/unit/whisper-transcribe.test.ts`: Model loading, transcription output shape
- `tests/unit/path-finding.test.ts`: Path algorithms on directed vs undirected graphs

### Integration Tests
- `tests/integration/whisper.test.ts`: End-to-end media ingestion
- `tests/integration/watch.test.ts`: File change → incremental rebuild cycle
- `tests/integration/svg-export.test.ts`: Graph → SVG → browser render
- `tests/integration/neo4j-push.test.ts`: Local Neo4j push + verify
- `tests/integration/url-ingest.test.ts`: YouTube, Twitter, GitHub URL ingestion
- `tests/integration/platform-install.test.ts`: All 11 platform install hooks
- `tests/integration/skill-generate.test.ts`: Generator output validation
- `tests/integration/query-tiered.test.ts` (from v2 plan): 6 query tools against real graph

### E2E Tests
- `tests/e2e/watch-build-edit.test.ts`: Edit file in watched project → graph updates
- `tests/e2e/full-ingest-pipeline.test.ts`: Add YouTube URL → whisper → graph → SVG export → Neo4j push

### Observability
- `--watch` memory logging every 30 seconds
- Neo4j push logs: `Pushed N nodes, M edges to <url>`
- Build logs: pipeline stage timing for each phase

---

## ADR

### Decision: GraphWiki v3 Scope and Priority Order

**Drivers:** tree-sitter gap (D1), cross-platform WASM requirement (D2), Graphify v4 parity (D4), SKILL.md adoption (D5)

**Alternatives considered:**
- Option B (skip tree-sitter, defer to v3.1): Rejected — AST extraction is broken for non-TS without it
- Option C (native whisper): Rejected — breaks on ARM/musl platforms, GraphWiki targets 11 platforms
- Option C (skip SVG/Neo4j, defer to v3.1): Rejected — export parity with Graphify v4 is a competitive requirement

**Why chosen:** P0 (tree-sitter) is unambiguously #1 since it's a critical gap from v2. P1 features are all Graphify v4 parity. P2 and P3 are additive.

**Consequences:** 6-week timeline. Multiple new dependencies (whisper WASM, chokidar, d3-hierarchy, neo4j-driver). Platform expansion increases CI matrix.

**Follow-ups:**
- Validate whisper WASM feasibility in Week 0 before committing to P1a
- Audit graph algorithms for undirected assumptions before implementing P1c
- Platform test matrix CI must be set up before P2b release
