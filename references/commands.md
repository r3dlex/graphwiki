# GraphWiki Commands Reference

## Build

| Command | Flags | Description | Output |
|---------|-------|-------------|--------|
| `graphwiki build <path>` | | Full graph + wiki build from source path | `graphwiki-out/graph.json`, `graphwiki-out/wiki/` |
| `graphwiki build <path>` | `--update` | Incremental rebuild (only changed files) | Updated `graphwiki-out/`, `wiki/` |
| `graphwiki build <path>` | `--resume` | Resume a crashed or interrupted build | Completes previous build state |
| `graphwiki build <path>` | `--force` | Force full rebuild (clear cache) | Fresh graph from all files |
| `graphwiki build <path>` | `--graph-only` | Build graph only (skip wiki compilation) | Graph JSON only |
| `graphwiki build <path>` | `--wiki-only` | Recompile wiki only (skip extraction, use existing graph) | Updated `wiki/` pages |
| `graphwiki build <path>` | `--watch` | Watch mode with auto-rebuild on file changes | Watches files and rebuilds incrementally |
| `graphwiki build <path>` | `--directed` | Build directed graphs (edges have direction) | Directed graph in `graphwiki-out/` |
| `graphwiki build <path>` | `--mode <mode>` | Compilation mode: `standard` (default) or `deep` | Deep mode generates prompts for all files |
| `graphwiki build <path>` | `--cluster-only` | Run clustering only (skip extraction) | Clustered graph |
| `graphwiki build <path>` | `--full-cluster` | Build full cluster | Full cluster output |
| `graphwiki build <path>` | `--permissive` | Allow coerced extraction results (less strict) | Graph with relaxed validation |
| `graphwiki build <path>` | `--svg [path]` | Export graph to SVG after build | SVG file |
| `graphwiki build <path>` | `--neo4j-push <uri>` | Push graph to Neo4j after build (requires `NEO4J_USER` and `NEO4J_PASSWORD` env vars) | Graph pushed to Neo4j |
| `graphwiki build <path>` | `--neo4j-verify` | After pushing to Neo4j, verify node/edge counts match | Verification result |
| `graphwiki build <path>` | `--auto-docs` | Route doc file changes to onUpdate in watch mode | Auto-processes doc changes |
| `graphwiki build <path>` | `--no-onnx` | Use rough similarity fallback (skip ONNX model download) | Graph without ONNX embeddings |

## Query and Navigation

| Command | Flags | Description | Output |
|---------|-------|-------------|--------|
| `graphwiki query "<question>"` | | Search knowledge graph by keyword | Matching nodes |
| `graphwiki query "<question>"` | `--dfs` | Use depth-first search traversal instead of BFS | DFS traversal from first matching node |
| `graphwiki query "<question>"` | `--graph` | Return subgraph JSON instead of text answer | Subgraph JSON |
| `graphwiki ask "<question>"` | | Ask a detailed question using full graph context + BFS | Structured context for LLM to answer |
| `graphwiki ask "<question>"` | `--max-tier <n>` | Maximum context tier (default: 3) | Context limited to tier depth |
| `graphwiki explain <node>` | | Explain a node using BFS depth-2 traversal and community context | Node summary with neighbors and community |
| `graphwiki path <nodeA> <nodeB>` | | Find shortest path between two graph nodes | Path with intermediate nodes |

## Graph Management

| Command | Flags | Description | Output |
|---------|-------|-------------|--------|
| `graphwiki add <url>` | | Fetch and ingest a URL into the knowledge graph | Node added to graph |
| `graphwiki add <url>` | `--author <author>` | Author attribution for ingested content | Stored in node properties |
| `graphwiki add <url>` | `--contributor <contributor>` | Contributor attribution for ingested content | Stored in node properties |
| `graphwiki save-result <promptFile> <resultFile>` | | Merge an LLM result JSON into the graph and archive the prompt file | Graph updated, prompt moved to `.graphwiki/processed/` |
| `graphwiki rollback [delta-file]` | | Restore previous graph from delta backups | Restored graph |
| `graphwiki rollback` | `--list` | List available delta files without restoring | List of delta snapshots |
| `graphwiki lint` | | Health check for orphan nodes, duplicate edges, missing labels | List of issues found |
| `graphwiki lint` | `--fix` | Auto-fix issues where possible | Fixed graph |
| `graphwiki lint` | `--spec-drift` | Check for exported functions not covered in spec files | Drift report |
| `graphwiki status` | | Show graph statistics (nodes, edges, communities, density) | Stats printed to stdout |
| `graphwiki status` | `--report` | Write report to `GRAPH_REPORT.md` | Markdown report at `config.paths.report` |

## Ingest

| Command | Flags | Description | Output |
|---------|-------|-------------|--------|
| `graphwiki ingest <source>` | | Ingest a source file, URL, or video into the graph | Updated graph with new node |
| `graphwiki ingest <source>` | `--transcribe` | Transcribe audio/video content using Whisper | Transcript stored in node properties |
| `graphwiki ingest <source>` | `--title <title>` | Title for the ingested content | Node labeled with given title |

## Server

| Command | Flags | Description | Output |
|---------|-------|-------------|--------|
| `graphwiki serve` | | Start the MCP server (stdio transport by default) | MCP server running |
| `graphwiki serve` | `--http` | Use HTTP transport instead of stdio | HTTP server on port 8080 |
| `graphwiki serve` | `--port <n>` | HTTP port (default: 8080) | Server on specified port |
| `graphwiki push neo4j` | | Push graph to Neo4j | Nodes and edges pushed |
| `graphwiki push neo4j` | `--uri <uri>` | Neo4j URI (e.g., `neo4j://localhost:7687`) or `NEO4J_URI` env var | |
| `graphwiki push neo4j` | `--user <user>` | Neo4j username (default: `neo4j`) or `NEO4J_USER` env var | |
| `graphwiki push neo4j` | `--password <password>` | Neo4j password or `NEO4J_PASSWORD` env var | |
| `graphwiki push neo4j` | `--database <db>` | Neo4j database (default: `neo4j`) | |
| `graphwiki export <format>` | | Export graph to a format: `html`, `obsidian`, `neo4j`, `graphml`, `svg` | Exported files in `--output` dir |
| `graphwiki export <format>` | `--output <dir>` | Output directory (default: `graphwiki-out/exports`) | |

## Hooks

| Command | Flags | Description | Output |
|---------|-------|-------------|--------|
| `graphwiki hook install` | | Install GraphWiki PreToolUse hook | Hook registered in Claude hooks config |
| `graphwiki hook uninstall` | | Remove GraphWiki PreToolUse hook | Hook removed |
| `graphwiki hook status` | | Check whether hook is installed | Status: installed or not |

## Skill Management

| Command | Flags | Description | Output |
|---------|-------|-------------|--------|
| `graphwiki skill install` | `--platform <name>` | Install skill for platform: `claude`, `codex`, `auggie`, `gemini`, `cursor`, `openclaw`, `copilot` | Platform skill files installed |
| `graphwiki skill install` | `--hooks` | Also install PreToolUse hooks | Hooks installed alongside skill |
| `graphwiki skill generate` | | Generate platform-specific skill files from `SKILL.md` | Generates `SKILL-*.md` files |
| `graphwiki skill generate` | `--check` | Verify generated files match (exit non-zero if mismatched) | Diff check result |
| `graphwiki skill uninstall` | `--platform <name>` | Remove skill for a specific platform | Platform skill files removed |
| `graphwiki skill uninstall` | `--all` | Remove all skill installations across all detected platforms | All skill files removed |
| `graphwiki skill uninstall` | `--hooks` | Also remove PreToolUse hooks | Hooks removed |

### Platform Shortcut Commands

Each platform has install and uninstall subcommands as a shortcut for `skill install/uninstall --platform <name>`:

| Command | Description |
|---------|-------------|
| `graphwiki claude install` | Install skill for Claude Code |
| `graphwiki claude uninstall` | Uninstall skill for Claude Code |
| `graphwiki codex install` | Install skill for Codex CLI |
| `graphwiki codex uninstall` | Uninstall skill for Codex CLI |
| `graphwiki cursor install` | Install skill for Cursor |
| `graphwiki cursor uninstall` | Uninstall skill for Cursor |
| `graphwiki copilot install` | Install skill for GitHub Copilot |
| `graphwiki copilot uninstall` | Uninstall skill for GitHub Copilot |
| `graphwiki antigravity install` | Install skill for Antigravity |
| `graphwiki antigravity uninstall` | Uninstall skill for Antigravity |
| `graphwiki hermes install` | Install skill for Hermes |
| `graphwiki hermes uninstall` | Uninstall skill for Hermes |
| `graphwiki opencode install` | Install skill for OpenCode |
| `graphwiki opencode uninstall` | Uninstall skill for OpenCode |
| `graphwiki aider install` | Install skill for Aider |
| `graphwiki aider uninstall` | Uninstall skill for Aider |
| `graphwiki droid install` | Install skill for Factory Droid |
| `graphwiki droid uninstall` | Uninstall skill for Factory Droid |
| `graphwiki trae install` | Install skill for Trae |
| `graphwiki trae uninstall` | Uninstall skill for Trae |
| `graphwiki trae-cn install` | Install skill for Trae CN |
| `graphwiki trae-cn uninstall` | Uninstall skill for Trae CN |

## Diagnostics

| Command | Flags | Description | Output |
|---------|-------|-------------|--------|
| `graphwiki benchmark [query]` | | Measure token usage for a query against the graph | Token counts: prompt, completion, total |
| `graphwiki benchmark` | `--reset` | Overwrite the saved baseline | New baseline saved |
| `graphwiki refine` | | Run auto-improvement pass on extraction prompts | Refinement output |
| `graphwiki refine` | `--review` | Show refinement audit trail without applying | Audit log |
| `graphwiki refine` | `--rollback` | Revert to previous prompt version | Previous prompts restored |
| `graphwiki refine` | `--force` | Force refinement even if validation fails | Refinement applied |
| `graphwiki refine` | `--validate` | Validate refinement scores against held-out queries (exits non-zero on regression) | Pass/fail result |

## Extraction Prompt Workflow

After `graphwiki build`, check `.graphwiki/pending/` for extraction prompts.

For each `.prompt.md` file:
1. Read the prompt instructions
2. Read the referenced source file
3. Extract nodes and edges as JSON
4. Write the result to the `.result.json` path specified in the prompt
5. Run `graphwiki save-result <promptFile> <resultFile>` to merge results into the graph

`--mode deep` generates prompts for ALL files (including code) to find
speculative relationships the AST parser cannot detect.
