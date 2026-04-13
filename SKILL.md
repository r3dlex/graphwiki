---
name: graphwiki
version: 2.0.0
trigger: /graphwiki
description: LLM knowledge graph with persistent wiki compilation
platforms: [claude, codex, auggie, gemini, cursor, openclaw, copilot, windsurf, cody, codewhisperer, opencode, aider, droid, trae, trae-cn, antigravity, hermes]
---

# GraphWiki Skill

You have access to the GraphWiki knowledge graph for persistent, token-efficient context loading.

## What To Do When Invoked

When `/graphwiki` is triggered, follow this sequence:

1. **Check if a graph exists** — look for `graphwiki-out/graph.json` (or `.graphwiki/graph.json`).
2. **If the graph exists** — load it and answer the user's question based on graph nodes and edges. Do not rebuild unless the user explicitly asks.
3. **If no graph exists** — inform the user and offer to run `graphwiki build . --update` to create one.
4. **Run queries against the loaded graph** — use `graphwiki query` for semantic questions, `graphwiki path` for structural relationships (0 LLM tokens).
5. **Return structured context** — summarize relevant nodes, edges, and wiki content relevant to the user's question.

## Context Loading Protocol

```
graph exists?
  YES → load graphwiki-out/graph.json → query or path → return structured context
  NO  → warn user → offer: graphwiki build . --update
```

When loading graph context manually (hook unavailable):
1. Load graph overview from `graphwiki-out/graph.json` (nodes + edges summary)
2. Run `graphwiki path <nodeA> <nodeB>` to find structural relationships
3. Check wiki index at `graphwiki-out/wiki/`
4. Load up to 3 wiki pages maximum per query (token budget)
5. Fall back to raw source files only if graph data is insufficient

## Key Commands

| Command | Purpose | Notes |
|---------|---------|-------|
| `graphwiki build . --update` | Incremental rebuild (changed files only) | Preferred over full rebuild |
| `graphwiki build .` | Full graph rebuild from scratch | Use only when graph is stale or missing |
| `graphwiki build . --watch` | Watch mode — auto-rebuild on file changes | For active development sessions |
| `graphwiki build . --directed` | Build directed graph (preserves edge direction) | Use for dependency/flow analysis |
| `graphwiki build . --mode deep` | Deep extraction mode via LLM | More thorough, higher token cost |
| `graphwiki query "question"` | Semantic query against knowledge base | Returns relevant wiki content |
| `graphwiki ask "question"` | LLM-augmented question answering | Uses graph + LLM reasoning |
| `graphwiki add <url>` | Add URL source to the graph | Fetches and indexes remote content |
| `graphwiki explain <node>` | Explain a node's role and connections | Useful for onboarding |
| `graphwiki path <nodeA> <nodeB>` | Find structural path between two nodes | Zero LLM tokens |
| `graphwiki save-result <file>` | Persist a query result to disk | For caching expensive queries |
| `graphwiki hook install` | Install PreToolUse/PostToolUse hooks | Enables automatic context injection |
| `graphwiki hook uninstall` | Remove hooks | |
| `graphwiki hook status` | Check hook registration status | |
| `graphwiki skill uninstall --all` | Remove all platform skill installations | |
| `graphwiki lint` | Validate graph integrity | Run before committing graph changes |
| `graphwiki status` | Show graph stats and token budget usage | |

## Pending Extraction Prompts

GraphWiki generates extraction prompts for non-code files (PDFs, images, binary assets). Check `.graphwiki/pending/` for any `.prompt.md` files before answering.

Protocol:
1. Check `.graphwiki/pending/` for `*.prompt.md` files
2. Read each prompt — it describes what knowledge to extract and the expected output schema
3. Extract the requested knowledge
4. Write the result JSON to the path specified in the prompt
5. Run `graphwiki build . --update` to merge the extracted knowledge into the graph

If `.graphwiki/pending/` is empty or does not exist, skip this step.

## Hard Constraints

- **NEVER modify source files** — treat all files in `raw/` and source directories as immutable
- **NEVER manually edit** `graphwiki-out/` — all output is auto-generated; changes will be overwritten
- **Always check the existing graph first** before suggesting a rebuild — incremental `--update` is almost always sufficient
- **Use `--update` for incremental builds** — full rebuilds are expensive and rarely needed
- **Cap wiki page loads at 3 per query** — respect the 150K session token budget (hook warns at 80%)
- **Zero-token path queries** — always prefer `graphwiki path` over LLM reasoning for structural questions

## Agent Role Matrix

| Agent Role | Recommended GraphWiki Usage |
|------------|-----------------------------|
| codebase-search | `graphwiki path <term1> <term2>` — 0 tokens |
| requirements | `graphwiki query` to load relevant wiki pages |
| planning | `graphwiki status` and `graphwiki lint` |
| implementation | `graphwiki build . --update` after file changes |
| verification | `graphwiki lint` and `graphwiki status` |

## References

- **[references/commands.md](references/commands.md)** — Full command table with all flags and examples
- **[references/platform-install.md](references/platform-install.md)** — Platform-specific installation and configuration

## Generator

`skill-generator.ts` parses this file and generates platform-specific skills:
SKILL-claude.md, SKILL-codex.md, SKILL-copilot.md, SKILL-auggie.md, SKILL-gemini.md, SKILL-cursor.md, SKILL-openclaw.md, SKILL-windsurf.md, SKILL-cody.md, SKILL-codewhisperer.md, and others.
