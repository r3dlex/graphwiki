# SDLC Path: Brownfield Adoption

## Repository
`graphwiki` (remote `r3dlex/graphwiki-skill`) — standalone node/TypeScript CLI
tool (depth 0) that builds LLM knowledge graphs and compiles a persistent wiki.

## Path chosen
**Brownfield adoption** — the repo already carries a minimal v3 scaffold
(`.ai/rules/`, `.ai/skills/`, `.ai/system-prompts/`, `.ai/drift/`, `.ai/matrix.json`,
`.memory/`, `docs/architecture/`, `docs/specifications/`, `docs/learning/`,
ADR-0001) from an earlier `ai-sdlc-init` run, plus four legacy product ADRs under
`docs/adr/`. The v3 upgrade adds the missing governance layers additively without
modifying or deleting any existing content.

## Rationale
- Existing `.ai/matrix.json` already declares `topology_type: standalone`,
  `current_depth: 0`, `sync_strategy: physical-copy` — correct for this repo.
- `.memory/human-override/` is populated; terminal priority is maintained.
- CI (GitHub Actions: `ci.yml`, `skill-check.yml`) is already configured; no
  hosted branch-policy mutation is needed (`protected main`, PR-only delivery).
- The repo is a node CLI tool, not a skills catalog — the skill-modernization
  branch is inapplicable.
- Cascade is inapplicable (standalone topology has no managed child repos).
- Package manager is `pnpm@9.0.0` (declared in `package.json`, `pnpm-lock.yaml`
  present); a stray `package-lock.json` is also present but pnpm is canonical.

## Key decisions
| Decision | Choice | Reason |
| --- | --- | --- |
| Topology | standalone, depth 0 | Single-repo node CLI tool; no umbrella. |
| Sync strategy | physical-copy | Canonical per `modules/sync.md`; symlinks/submodules rejected. |
| Package manager | pnpm | `packageManager: pnpm@9.0.0`; `pnpm-lock.yaml` is the source of truth. |
| Tracker | GitHub Issues (hosted) | `r3dlex/graphwiki-skill` is on GitHub; PR-only delivery on protected `main`. |
| ADR numbering | 0002/0003/0004 in `docs/architecture/adr/` | `0001-init.md` already exists there; legacy `ADR-00N` live in the distinct `docs/adr/` namespace, so 4-digit `ADR-000N` citations stay unambiguous. |
| Cascade | no-op | Standalone topology; no managed child repos. |
| Skill catalog | excluded | This repo is a node CLI tool, not a skill catalog. |
| Example evalsets | not shipped | No shippable AI surface requiring graded evaluation at upgrade time. |
