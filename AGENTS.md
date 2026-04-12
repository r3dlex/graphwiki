<!-- Parent: CLAUDE.md -->
<!-- Generated: 2026-04-12 | Updated: 2026-04-12 -->

# GraphWiki Agents

## Purpose

This document is the primary context reference for AI agents working in the GraphWiki project. It defines the context-loading protocol, available CLI commands, hook integration details, project conventions, and hard constraints. Read this before any other file to understand how to navigate the codebase efficiently.

## Key Files

| File | Purpose |
|------|---------|
| `AGENTS.md` | This file — agent context protocol, commands, conventions |
| `CLAUDE.md` | Project-level Claude Code instructions |
| `SKILL.md` | Canonical skill definition (source for all SKILL-*.md) |
| `src/cli.ts` | Commander-based CLI entry point |
| `src/graph/traversal.ts` | BFS/DFS/shortestPath with directed graph support |
| `src/wiki/compiler.ts` | Wiki compilation — wikilinks, YAML frontmatter, Obsidian canvas |
| `src/hooks/skill-installer.ts` | Platform skill install/uninstall, hook registration |
| `src/util/ignore-resolver.ts` | `resolveIgnores()` / `resolveIgnoresSplit()` — extraction vs. output ignores |
| `src/extract/llm-extractor.ts` | LLM extraction with standard and deep mode |
| `src/export/neo4j-push.ts` | Neo4j export with `verifyNeo4jPush()` |
| `scripts/graphwiki-pretool.mjs` | PreToolUse hook — auto context injection |
| `scripts/graphwiki-session-start.mjs` | SessionStart hook |
| `scripts/graphwiki-posttool.mjs` | PostToolUse hook — git commit trigger |

## What is GraphWiki?

This project uses GraphWiki for persistent knowledge management.
The graph (`graphwiki-out/`) routes you to the right context.
The wiki (`wiki/`) contains compiled, human-readable knowledge.
Both stay in sync automatically.

## Context Loading Protocol

Follow this order. Do not skip steps. Do not read raw/ unless Step 5 applies.

Step 1: Read `graphwiki-out/GRAPH_REPORT.md` (~1-2K tokens)
Step 2: Use `graphwiki CLI` for structural queries (0 LLM tokens)
        Example: `graphwiki path AuthService DatabasePool`
Step 3: Read `wiki/index.md` to find relevant pages (~1-3K tokens)
Step 4: Read targeted wiki pages (~2-5K tokens each, max 3 pages)
Step 5: Read `raw/` files ONLY IF:
        - You need to verify a LOW-CONFIDENCE claim
        - The wiki page does not exist for this topic
        - The user explicitly asks you to read the source

## Commands

```bash
graphwiki build . --update          # Incremental rebuild after file changes
graphwiki build . --resume          # Resume a crashed/interrupted build
graphwiki build . --permissive      # Allow coerced extraction results
graphwiki build . --watch           # Watch mode with auto-rebuild
graphwiki build . --directed        # Build directed graphs
graphwiki build . --mode deep       # Deep mode extraction
graphwiki query "question"          # Ask the knowledge base
graphwiki path <nodeA> <nodeB>      # Find shortest path between graph nodes
graphwiki add <url>                 # Add a URL source to the graph
graphwiki lint                      # Health check for contradictions
graphwiki lint --spec-drift         # Check exported functions against spec/
graphwiki status                    # Stats and drift score
graphwiki ingest <file>             # Process a new source file (PDF, code, doc)
graphwiki benchmark "question"      # Measure token usage for this query
graphwiki refine                    # Auto-improve extraction prompts
graphwiki refine --review           # Show suggestions without applying
graphwiki refine --rollback         # Revert to previous prompts
graphwiki hook install              # Install hooks for Claude Code integration
graphwiki hook uninstall            # Uninstall hooks
graphwiki hook status               # Check hook installation status
graphwiki skill install [--platform <name>]  # Install skill for current platform
graphwiki skill generate [--check]           # Generate platform-specific skill files
graphwiki skill uninstall --all              # Remove all skill installations
```

## Wiki Page Format

Every page in wiki/ has YAML frontmatter:
- title: Page title
- type: concept | entity | source-summary | comparison
- graph_nodes: list of graph node IDs mapped to this page
- graph_community: community ID number
- sources: list of raw/ files referenced
- related: list of [[wiki-links]] to other pages
- confidence: high | medium | low
- content_hash: for diff-based updates

## Agent Role Matrix

GraphWiki is platform-agnostic. The host tool (Claude Code, Codex, Auggie, etc.) maps GraphWiki capabilities to its own agent system. Use the Context Loading Protocol and Commands to integrate GraphWiki into any agent workflow.

| Role | GraphWiki Integration |
|------|---------------------|
| codebase-search | Use `graphwiki path <term1> <term2>` to find structural relationships before reading files |
| requirements | Use `graphwiki query "<question>"` to load relevant wiki pages before analysis |
| planning | Use `graphwiki status` to check drift and `graphwiki lint` for consistency |
| implementation | Use `graphwiki build . --update` after file changes to keep graph current |
| verification | Use `graphwiki lint` and `graphwiki status` to validate changes |

## Tool Access Levels

| Tool | Access Level | Notes |
|------|-------------|-------|
| bash | full | All shell commands |
| read | full | All file reading |
| write | full | File creation and editing |
| edit | full | In-place file modifications |
| glob | full | File pattern matching |
| grep | full | Content search |
| TaskCreate | full | Task management |
| TaskUpdate | full | Task status updates |
| TaskGet | full | Task retrieval |
| TaskList | full | Task listing |

## PreToolUse Hook Integration

GraphWiki uses the PreToolUse hook (managed by oh-my-claude) to provide automatic context loading before every tool use.

**Hook scripts:** `scripts/graphwiki-pretool.mjs`, `scripts/graphwiki-session-start.mjs`, `scripts/graphwiki-posttool.mjs`
**Hook registration:** `~/.claude/plugins/marketplaces/omc/hooks/hooks.json` (via skill installer)
**Timeout:** 3 seconds
**Hook events:** `PreToolUse`, `SessionStart`, `PostToolUse`

### Hook Behavior

Before every tool use, the PreToolUse hook automatically:

1. Extracts entities from tool input (file paths, CamelCase identifiers, query terms)
2. Routes to the appropriate graph query:
   - **Read / Grep / Glob** → `graphwiki path <term1> <term2>` (0 LLM tokens)
   - **Ask / Query** → `graphwiki query "<question>"` (loads wiki pages)
3. Writes context to session state for the agent to consume
4. Tracks token budget (warns at 80% of 150K tokens)
5. Gracefully degrades if graphwiki CLI is unavailable

The hook never blocks tool execution. Tool calls always proceed regardless of hook outcome.

### Event Format

Hook scripts receive snake_case events from OMC:
```json
{ "tool_name": "Read", "tool_input": { "file_path": "/src/Auth.ts" }, "cwd": "/project", "session_id": "abc123" }
```

Hook scripts write JSON responses to stdout:
```json
{ "continue": true, "suppressOutput": true }
```

## For AI Agents

### Test Patterns

- Unit tests in `*.test.ts` files co-located with source
- Integration tests in `tests/integration/` and `src/**/*.integration.test.ts`
- Benchmark tests in `tests/benchmark/`
- Use Vitest for test execution (`pnpm test`)

### Coverage Thresholds

All four metrics must stay at **80%+** (lines, branches, functions, statements).

### File Organization

```
src/
  benchmark/    - Benchmark and performance testing
  cli.ts        - Commander-based CLI
  detect/       - Drift detection
  dedup/        - Deduplication logic
  export/       - Export formats (GraphML, HTML, Neo4j, Obsidian)
  extract/      - LLM extraction and AST extraction
  graph/        - Graph building, clustering, delta detection, traversal
  hooks/        - PreToolUse, git-hooks, skill installer
  providers/    - LLM provider integrations (Anthropic, OpenAI, Google)
  query/        - Query routing and caching
  refine/       - Prompt refinement system
  report/       - Community summary and reporting
  serve/        - MCP server (HTTP and stdio)
  types.ts      - Shared type definitions
  util/         - Utilities (frontmatter, hash, math, token estimation, ignore-resolver)
  wiki/         - Wiki compilation and linting
  watch/        - File watcher with debounce and chokidar integration

scripts/
  graphwiki-pretool.mjs        - PreToolUse hook
  graphwiki-session-start.mjs  - SessionStart hook
  graphwiki-posttool.mjs       - PostToolUse hook (git commit trigger)

spec/            - Spec files for all major modules (17 specs)
references/      - Supplementary docs for SKILL.md (commands, hooks, platforms, protocol)
graphwiki-out/   - Auto-generated graph output
wiki/            - Compiled wiki pages
raw/             - Immutable source files (NEVER modify)
```

### Hard Constraints

- **NEVER modify** `raw/` — immutable source files
- **NEVER modify** `graphwiki-out/` — auto-generated output
- **Maximum 3 wiki pages** per query (token budget)
- **Protocol order** — Steps 1-5 required for manual context loading
- **SKILL-*.md files are generated** — edit `SKILL.md`, not the generated files

### Platform Support

- **Claude Code:** `graphwiki skill install --platform claude`
- **Codex:** `graphwiki skill install --platform codex`
- **Gemini:** `graphwiki skill install --platform gemini`
- **Cursor:** `graphwiki skill install --platform cursor`
- **OpenClaw:** `graphwiki skill install --platform openclaw`
- **OpenCode:** `graphwiki skill install --platform opencode`
- **Aider:** `graphwiki skill install --platform aider`
- **Droid:** `graphwiki skill install --platform droid`
- **Trae / Trae-CN:** `graphwiki skill install --platform trae` / `trae-cn`
- **GitHub Copilot:** copy SKILL-copilot.md to `.github/copilot/`
- **Auggie:** `graphwiki skill install --platform auggie`
