# ADR 0002: init-ai-repo v3 governance upgrade

## Status
Accepted.

## Context
`graphwiki` adopted the v3 AI-SDLC scaffold (ADR-0001) with a minimal `.ai/`
layer (rules, skills, system-prompts, drift, matrix) and a `.memory/`/`docs/`
tree, plus four legacy product ADRs under the separate `docs/adr/` namespace.
The current init-ai-repo v3 standard adds governance layers that were missing:
workflow manifests, traceability graph, eval-coverage scaffold, MCP/A2A surface,
provider-neutral model-routing policy, observability conventions, an
AI-failure-mode review checklist, command surfaces, and phased status files.

## Decision
Additively generate the missing v3 governance layers, adapted to a standalone
node/TypeScript CLI tool (`topology_type: standalone`, depth 0, package manager
`pnpm`). Refresh `AGENTS.md` as the single source of truth (with a Harness Map
and workflow links) and make `CLAUDE.md` and `GEMINI.md` thin pointers to
`AGENTS.md` (ADR-0003).

Skills-catalog-specific artifacts are intentionally excluded — this repo is a
node CLI tool, not a skills catalog. (GraphWiki generates `SKILL-*.md` platform
files from `SKILL.md`, but it is not a multi-skill catalog in the init-ai-repo
sense.) Cascade is a no-op for standalone topology. No example evalsets are
shipped; the eval-coverage gate remains offline-structural.

ADR numbering: `0001-init.md` already exists in `docs/architecture/adr/`, and the
legacy `ADR-001..004` product records live in the distinct `docs/adr/` directory.
The new governance ADRs therefore take the next free 4-digit numbers in
`docs/architecture/adr/` — 0002 (this), 0003, and 0004 — so every `ADR-000N`
citation resolves unambiguously.

## Consequences
- The repo now exposes the full v3 surface map: `Instructions`, `Knowledge`,
  `Memory`, `Examples`, `Tools`, and `Guardrails`.
- Existing governance content (`.ai/rules/`, `.ai/skills/`, `.ai/system-prompts/`,
  `.ai/drift/`, `.memory/`, prior ADRs in both ADR directories) is preserved
  unchanged.
- The upgrade is documentation/governance only: no application source code,
  package version, or runtime behavior changed.
