# GraphWiki

![GraphWiki banner](assets/banner.png)

GraphWiki is a TypeScript CLI that extracts code and Markdown into a persistent
knowledge graph, compiles human-readable wiki pages, and exposes graph queries,
health checks, exports, hooks, and skills.

- **Official repository:** [r3dlex/graphwiki](https://github.com/r3dlex/graphwiki)
- **npm package and CLI:** [`graphwiki`](https://www.npmjs.com/package/graphwiki)
- **License:** [MIT](#license)

The package name and command are both `graphwiki`. The version printed by
`graphwiki --version` is the installed package version; it may differ from the
current repository until a release is published.

## Requirements

- Node.js 20 or 22. Repository CI exercises both, with the main build and test
  jobs on Node.js 22.
- npm for the recommended install. Contributors also need pnpm 9, as pinned in
  [`package.json`](package.json).
- No LLM API key for the standard local build. Standard extraction and wiki
  compilation use local AST and Markdown processing. Optional provider-backed
  or transcription features have their own credentials.

## Quick Start

Use the published CLI unless you are contributing to GraphWiki itself:

```bash
npm install -g graphwiki@latest
graphwiki --version

cd /path/to/your/project
graphwiki build .
graphwiki status
```

A successful first build prints `[GraphWiki] Build complete!`. The follow-up
`graphwiki status` command reports observable node, edge, community, and density
values. The current repository source also writes
`graphwiki-out/GRAPH_REPORT.md` and compiled pages under
`graphwiki-out/wiki/`; use the installed command's output as the source of truth
if you are on an older published version.

## What GraphWiki Writes

Run GraphWiki from the root of the project you want to index. A build can create
or refresh:

| Path | Purpose |
| --- | --- |
| `.graphwiki/` | Machine state such as configuration, manifests, locks, batches, and pending extraction prompts |
| `graphwiki-out/graph.json` | The generated graph used by query, path, lint, status, and export commands |
| `graphwiki-out/GRAPH_REPORT.md` | A compact, human-readable graph summary |
| `graphwiki-out/wiki/` | Compiled wiki pages and the Obsidian canvas |
| `.graphwikiignore` | Build exclusions; scaffolded on the first build when missing |

The exact graph and wiki paths can be overridden in
`.graphwiki/config.json`; see the [configuration specification](spec/config-schema.md).
Treat `.graphwiki/` and `graphwiki-out/` as generated state. Review your target
project's ignore policy before committing them, and commit or back up important
work before using recovery options that rebuild generated state.

## Rerun Semantics

Update the installed CLI and verify the active version with:

```bash
npm install -g graphwiki@latest
graphwiki --version
```

The install command is safe to rerun. After updating, rebuild each indexed
project from its current sources:

```bash
graphwiki build .
graphwiki status
```

- `graphwiki build .` rebuilds graph and wiki output from the current source
  files.
- A live build lock prevents concurrent builds in the same project. Stale or
  corrupt lock files are removed automatically by the CLI.
- `raw/` is an input location. GraphWiki reads it when present; do not treat it
  as generated output.

## Common Workflows

### Query and navigate

```bash
graphwiki query "How does the cache work?"
graphwiki path <nodeA> <nodeB>
graphwiki status
graphwiki lint
```

### Ingest additional content

```bash
graphwiki ingest notes.md
graphwiki add https://example.com/reference
```

Direct file ingestion reads UTF-8 text, so do not pass a binary PDF to
`graphwiki ingest`. To generate an extraction prompt for a PDF, place it under
`raw/` and run `graphwiki build .`; build-time discovery writes the prompt under
`.graphwiki/pending/`. URL ingestion validates the URL before fetching it.

### Install an agent skill or hook

```bash
graphwiki skill install --platform codex
graphwiki hook install
graphwiki hook status
```

Platform installation changes user or project tool configuration. Review the
[platform installation guide](references/platform-install.md) before running it,
especially in an existing customized setup. Generated `SKILL-*.md` files come
from [`SKILL.md`](SKILL.md); edit the canonical file rather than generated copies.

### Export the graph

```bash
graphwiki export html --output graphwiki-out/exports
```

Neo4j export and verification require the corresponding URI and credentials;
see the [command reference](references/commands.md).

## Troubleshooting

### `graphwiki: command not found`

Confirm the npm global binary directory is on `PATH`, or verify the published
package without a global install:

```bash
npm exec --yes --package=graphwiki@latest -- graphwiki --version
```

Then reinstall with `npm install -g graphwiki@latest`.

### `Build already in progress`

Do not start two builds in the same project. Wait for the reported process to
finish, then rerun `graphwiki build .`. The CLI removes stale locks when their
process is no longer running.

### Status is empty or the graph looks stale

Make sure you are in the intended project root, inspect `.graphwikiignore` and
`.graphifyignore`, then run:

```bash
graphwiki build .
graphwiki status
```

Use `--force` only after checking those exclusions and preserving any generated
state you need.

### A command or platform option is unclear

Start with the CLI's installed help, which matches the active version:

```bash
graphwiki --help
graphwiki build --help
graphwiki skill --help
```

Then consult the [command reference](references/commands.md),
[context protocol](references/context-protocol.md),
[hook integration guide](references/hook-integration.md), and
[platform installation guide](references/platform-install.md).

## Development

Clone the canonical repository and use its pinned package manager:

```bash
git clone https://github.com/r3dlex/graphwiki.git
cd graphwiki
pnpm install --frozen-lockfile
pnpm run build
pnpm run typecheck
pnpm run lint
pnpm test
```

Additional repository gates include the coverage-threshold unit suite and
Archgate:

```bash
pnpm run test:unit
pnpm exec archgate check --ci
```

The executable ADRs under [`.archgate/adrs/`](.archgate/adrs/) are committed
repository policy. `archgate init` is only for bootstrapping a new project; it
is not part of this repository's validation flow.

Tests use Vitest and live next to source files plus under `tests/`. The coverage
suite enforces at least 80% for lines, branches, functions, and statements.
Contributors should read [`AGENTS.md`](AGENTS.md) and
[`CONTRIBUTING.md`](CONTRIBUTING.md) before changing source.

## Documentation

- [CLI commands](references/commands.md)
- [Configuration schema](spec/config-schema.md)
- [Context loading protocol](references/context-protocol.md)
- [Hook integration](references/hook-integration.md)
- [Platform installation](references/platform-install.md)
- [Architecture decisions](docs/adr/)
- [Module specifications](spec/)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)

## License

GraphWiki is licensed under MIT, as declared in [`package.json`](package.json).

<!-- v3-ai-sdlc-init:start -->
## AI SDLC v3

This repo follows the v3 AI-SDLC layout (`topology_type: standalone`, depth 0). The agent operating contract lives in [`AGENTS.md`](AGENTS.md) (single source of truth; `CLAUDE.md` and `GEMINI.md` are thin pointers).

- Workflow doc: [`.ai/workflows/repo-workflow.md`](.ai/workflows/repo-workflow.md)
- Workflow manifest: [`.ai/workflows/repo-workflow.json`](.ai/workflows/repo-workflow.json)

See `.ai/matrix.json`, `.memory/human-override/`, and `docs/architecture/adr/`. Modules at `r3dlex/skills/init-ai-repo/modules/`.
<!-- v3-ai-sdlc-init:end -->
