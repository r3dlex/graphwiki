# Plan: ignore-resolver + package.json files field

## RALPLAN-DR Summary

**Mode: SHORT** (two targeted, low-risk tasks)

### Principles (5)
1. **Single source of truth for ignores**: All ignore sources (files + config) are additive; no conflict resolution needed.
2. **Zero breaking changes**: Existing extraction ignores and graph builder behavior must not change.
3. **Simple, testable interface**: Return a tuple so callers get patterns today and source breakdown for future logging.
4. **Graceful degradation**: Missing ignore files are not errors; treat as empty pattern sets.
5. **npm-safe publish**: `scripts/` is already in `files` field -- verified by `pnpm pack`; all 6 hook scripts (3 OMC + 3 Auggie) are included. No change needed.

### Decision Drivers (Top 3)
1. **Minimal coupling**: `ignore-resolver.ts` should not know about graph or extraction internals.
2. **Auggie users need the scripts**: The three `graphwiki-auggie-*.mjs` files exist and are already included in npm packages (verified via `pnpm pack` tarball inspection).
3. **Existing config.json pattern format**: `glob` package already handles the pattern strings; no new matching logic needed.

### Viable Options

**Option A -- Tuple return: `[patterns: string[], sources: Readonly<IgnoreSources>]`**
- Pros: Callers destructure `patterns` today; `sources` available for future verbose/diagnostic logging without API change.
- Cons: Slightly more verbose return type than a plain array.
- Status: **Recommended.**

**Option B -- Plain string array: `resolveIgnores(root): Promise<string[]>`**
- Pros: Dead simple, passes directly to `glob()`.
- Cons: Callers lose source attribution if debugging is needed later.
- Status: Accepted but not preferred.

---

## Implementation Plan

### Step 1: `src/util/ignore-resolver.ts`

**Create** `src/util/ignore-resolver.ts` with:

```typescript
export interface IgnoreSources {
  configJson: string[];
  graphwikiignore: string[];
  graphifyignore: string[];
}

export function resolveIgnores(projectRoot: string): Promise<[patterns: string[], sources: Readonly<IgnoreSources>]>
```

Implementation details:
- `readIgnoreFile(path: string): Promise<string[]>` -- reads a file, splits on newlines, strips comments (`#`) and empty/whitespace-only lines. Returns `[]` on error (missing file).
- Reads three sources in parallel using `Promise.all`:
  - `.graphwiki/config.json` -- extracts `extraction.ignore_patterns` (array of glob strings)
  - `.graphwikiignore` in project root -- parsed as newline-separated patterns
  - `.graphifyignore` in project root -- parsed as newline-separated patterns
- Deduplicates the merged patterns using string equality (`Set` / `===`). Semantically equivalent patterns written with different glob syntax (e.g., `foo/` vs `foo`) are **not** deduped -- only exact string matches are removed.
- Graceful degradation: if `.graphwiki/config.json` exists but cannot be parsed as JSON, treat it as an empty pattern set (same as if it were missing). This applies equally to all three sources.
- Returns `[patterns, sources]` tuple. Patterns is a string[] for passing to glob. Sources is the structured breakdown for future diagnostics.

### Step 2: `src/util/ignore-resolver.test.ts`

**Create** `src/util/ignore-resolver.test.ts` with unit tests using Vitest and a filesystem mock.

- Test: all three sources present, patterns merged with dedup.
- Test: missing `.graphwikiignore` returns patterns from config.json + `.graphifyignore`.
- Test: missing `.graphifyignore` returns patterns from config.json + `.graphwikiignore`.
- Test: `config.json` exists but is malformed JSON -- returns patterns from both ignore files (graceful degradation).
- Test: missing `config.json` (or missing `extraction.ignore_patterns` key) returns patterns from both ignore files.
- Test: comments (`# ...`) and blank lines are stripped from file-based ignores.
- Test: deduplication -- identical patterns from multiple sources appear only once.

### Step 3: `src/cli.ts` -- wire resolver into `build` action

**Modify** the `build` command action in `src/cli.ts` (around line 119):

Replace the `readdir()` stub (lines 133-139):
```typescript
// OLD (stub):
const files = await readdir(path);
fileCount = files.length;
```

With:
```typescript
// NEW: Resolve ignore patterns and use glob for proper file discovery
const [ignorePatterns, _sources] = await resolveIgnores(path);
const discovered = await glob("**/*", {
  cwd: path,
  ignore: ignorePatterns,
  absolute: false,
});
fileCount = discovered.length;
```

Actions:
1. Add `import { glob } from "glob"` near the top of `src/cli.ts` (with the other imports).
2. Add `import { resolveIgnores } from "./util/ignore-resolver.js";` near the top of `src/cli.ts` (adjust relative path as needed).
3. Replace the `readdir()` stub (lines 133-139) with the glob-based discovery block shown above.

Notes:
- Keep the rest of the stub output (`Found ${fileCount} files`, `Graph has ${graph.nodes.length} nodes...`) -- only the file-count source changes.
- This is a **new integration point**, not a modification of existing discovery logic, since the old code was a stub.

### Step 4: `package.json` -- VERIFIED-DONE

**No change needed.** `pnpm pack` dry-run confirms that `scripts/` is already in the `files` array (line 24), so all six hook scripts including the three `graphwiki-auggie-*.mjs` files are included in the npm package. Verified by packing and inspecting the tarball contents.

---

## Files to Create/Modify

| Step | File | Action | Description |
|------|------|--------|-------------|
| 1 | `src/util/ignore-resolver.ts` | Create | Core resolver returning `[patterns, sources]` tuple |
| 2 | `src/util/ignore-resolver.test.ts` | Create | Unit tests with fs mock for all edge cases |
| 3 | `src/cli.ts` | Modify | Replace `readdir()` stub with `glob()` + `resolveIgnores()` in `build` action |
| 4 | `package.json` | None | **Verified done** -- `scripts/` already in `files` field |

## Acceptance Criteria

1. `resolveIgnores(projectRoot)` returns `[patterns, sources]` where `patterns` is a deduplicated `string[]` of glob patterns from all three sources.
2. `sources.configJson`, `sources.graphwikiignore`, `sources.graphifyignore` reflect which patterns came from which source.
3. Missing `.graphwikiignore` or `.graphifyignore` does not throw; returns patterns from remaining sources.
4. Missing `.graphwiki/config.json` (or missing `extraction.ignore_patterns` key) does not throw; returns patterns from file-based ignores.
5. `src/cli.ts` `build` action uses `glob()` with resolved ignore patterns instead of the `readdir()` stub.
6. `pnpm run build` succeeds without errors.
7. `pnpm test` passes (new + existing tests).

## Open Questions

- **None.** All questions resolved by Architect review and empirical verification.
