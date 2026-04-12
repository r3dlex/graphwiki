# Changelog

All notable changes to this project will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [Unreleased]

## [3.0.2] - 2026-04-13

### Added
- `graphwiki ask` now emits structured context for the calling LLM to use — no direct LLM API calls from graphwiki itself (LLM-agnostic architecture)
- GitHub Releases created automatically on stable publish via `gh release create` in CI

### Fixed
- `--update` now detects **modified** files (not just new) via SHA-256 content-hash manifest at `.graphwiki/manifest.json`
- `serve/executor.ts` `execBuild` and `execIngest` stubs replaced with real glob + ASTExtractor wiring
- `benchmark/report-generator.ts` `formatTable()` stub replaced with delegation to `formatResultsTable()`
- `execIngest` gracefully handles missing/unreadable source files instead of throwing

### Changed
- CI publish job: `contents: read` → `contents: write` to allow GitHub Release creation

## [3.0.1] - 2026-04-12

### Fixed
- Watch mode: `unlink` events now correctly populate `removed[]` in `FileWatcher.flush()` — previously untracked due to `Set<string>` losing event type; fixed by switching to `Map<string, 'add' | 'change' | 'unlink'>` (613098a)

### Docs
- Added reference to sister project [graphify](https://github.com/safishamsi/graphify) in README (c8b8cba)

## [3.0.0] - 2026-04-12

### Added
- v3 complete rewrite: directed graphs, watch mode, SVG export, Neo4j push (669c20b)
- Whisper audio transcription support
- Wiki format config (`wiki.format: obsidian | plain`) with canvas generation (d07d1e8)
- Obsidian wiki defaults with configurable paths via `config.paths.*` (2b04c5c)
- Hook CLI (`graphwiki hook install/uninstall/status`) and `uninstallSkill` API (2b04c5c)
- Spec files and benchmark ratchet tests (2b04c5c, b5acc95)
- Neo4j push verification in CI (b5acc95)
- Watch mode integration tests (b5acc95)
- Ignore resolver with glob-based file discovery (`.graphwikiignore`) from v2 line
- Continuous release pipeline: alpha on every main push; stable requires CHANGELOG section (35e7d75)
- Dual publish: GitHub Packages (`@r3dlex/graphwiki`) via `GITHUB_TOKEN` + npmjs.com via OIDC provenance (9d0da30)
- `paths` section in `.graphwiki/config.json` for discoverability (ed13ee1)

### Changed
- Version bumped from 2.0.0 to 3.0.0
- CLI now respects `config.paths.graph` in all commands — `query`, `explain`, `ask`, `add`, `ingest`, `push`, `export`, `status`, `lint`, `diff`, `rollback` (c0211df)
- `postinstall` prompts before installing skills (opt-in per platform, skipped in CI) (3d17627)
- `SKILL-*.md` in `package.json` `files` array replaced with glob pattern (1cf0a95)
- AGENTS.md updated to write-agent-docs convention (59f1dc4)

### Fixed
- Blocking audit issues: gitignore `SKILL-*.md`, postinstall opt-in, grammar optional deps, `uninstallHook` fix (139918f)
- `uninstallSkill` wired into platform shortcut CLI commands; previously stubs (c0211df)
- Directed traversal in `getNeighbors()` respects `metadata.directed` (c0211df)
- `wiki.format` passed from config to `WikiCompiler` (ec78c84)
- TypeScript intersection type collapse in `FileWatcher` integration test (c610b19)
- CI: dedicated `setup-node` for GitHub Packages auth (2e352fd)

## [2.0.0] - 2026-04-10

### Added
- Initial GraphWiki v2 implementation (f5e3175)
- Archgate CI pipeline with architecture boundary rules (95b1b1d)
- SKILL.md plugin system with multi-platform support: claude, codex, cursor, copilot, auggie, windsurf, gemini, and more (beb27d8)
- Auggie integration with `.graphwikiignore` / `.graphifyignore` ignore files (764ae37)
- Ignore resolver with glob-based file discovery (46f7666, 307061c)
- Skill system formalized with SKILL.md as canonical source of truth (3e6217c)
- Hook entry structure verification in CI simulation (1672b3b)

### Fixed
- `tsx --import` for `skill-generator.ts` dynamic import in CI (32e82b3)
- Chained `cd` commands in ESM validation step (0ec9a58)
- `stdin.mjs` import path resolution for CI ESM validation (8a0fa3c)
