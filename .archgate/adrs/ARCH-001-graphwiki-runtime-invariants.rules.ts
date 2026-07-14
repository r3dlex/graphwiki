/// <reference path="../rules.d.ts" />

async function readRequired(ctx: RuleContext, file: string): Promise<string | null> {
  try {
    return await ctx.readFile(file);
  } catch {
    violation(ctx, 'Required policy input is missing', file);
    return null;
  }
}

function violation(ctx: RuleContext, message: string, file: string): void {
  ctx.report.violation({ message, file });
}

const requiredFrontmatter = [
  'graph_nodes',
  'title',
  'type',
  'sources',
  'related',
  'confidence',
  'content_hash',
];

async function wikiFiles(ctx: RuleContext): Promise<string[]> {
  const roots = new Set(['graphwiki-out/wiki']);
  try {
    const config = JSON.parse(await ctx.readFile('.graphwiki/config.json')) as {
      paths?: { wiki?: unknown };
    };
    if (typeof config.paths?.wiki === 'string' && config.paths.wiki.trim()) {
      roots.add(config.paths.wiki.replace(/^\.\//, '').replace(/\/$/, ''));
    }
  } catch {
    // The config is optional; the CLI default remains enforced.
  }

  const files = new Set<string>();
  for (const root of roots) {
    for (const file of await ctx.glob(`${root}/**/*.md`)) files.add(file);
  }
  return [...files];
}

export default {
  rules: {
    'gw-graph-001': {
      description: 'Node IDs use SHA-256 for deterministic graph rebuilds',
      async check(ctx) {
        const file = 'src/graph/builder.ts';
        const source = await readRequired(ctx, file);
        if (source && !/createHash\(\s*['"]sha256['"]\s*\)/i.test(source)) {
          violation(ctx, 'GraphBuilder must derive node IDs with SHA-256', file);
        }
      },
    },
    'gw-graph-002': {
      description: 'Existing nodes are merged with an object spread',
      async check(ctx) {
        const file = 'src/graph/builder.ts';
        const source = await readRequired(ctx, file);
        if (source && !/this\.nodes\[id\]\s*=\s*\{\s*\.\.\.existing\b/.test(source)) {
          violation(ctx, 'Existing graph nodes must be merged immutably with ...existing', file);
        }
      },
    },
    'gw-graph-003': {
      description: 'Duplicate edge weights accumulate instead of replacing data',
      async check(ctx) {
        const file = 'src/graph/builder.ts';
        const source = await readRequired(ctx, file);
        if (source && !/existing\.weight\s*\+=\s*edge\.weight/.test(source)) {
          violation(ctx, 'Duplicate edges must accumulate weight with +=', file);
        }
      },
    },
    'gw-graph-004': {
      description: 'Graph completeness is derived from node provenance',
      async check(ctx) {
        const file = 'src/graph/builder.ts';
        const source = await readRequired(ctx, file);
        if (source && !/provenance\?\.length\s*\?\?\s*0/.test(source)) {
          violation(ctx, 'Completeness must remain derived from provenance length', file);
        }
      },
    },
    'gw-wiki-001': {
      description: 'Generated wiki pages keep the required frontmatter schema',
      async check(ctx) {
        for (const file of await wikiFiles(ctx)) {
          const source = await ctx.readFile(file);
          const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
          if (!frontmatter) {
            violation(ctx, 'Wiki page is missing YAML frontmatter', file);
            continue;
          }
          for (const key of requiredFrontmatter) {
            if (!new RegExp(`^${key}:`, 'm').test(frontmatter[1])) {
              violation(ctx, `Wiki page is missing required frontmatter field: ${key}`, file);
            }
          }
        }
      },
    },
    'gw-wiki-002': {
      description: 'Application code treats raw/ as read-only input',
      async check(ctx) {
        const writeToRaw =
          /(?:writeFile|writeFileSync|copyFile|copyFileSync|mkdir|mkdirSync|rename)\s*\([^;]{0,800}(?:['"`](?:\.\/|\/)?raw(?:\/|['"`])|(?:path\.)?(?:join|resolve)\s*\([^)]*['"`]raw['"`])/m;
        for (const file of await ctx.glob('src/**/*.ts')) {
          const source = await ctx.readFile(file);
          if (writeToRaw.test(source)) {
            violation(ctx, 'Source code must not write to the raw/ input tree', file);
          }
        }
      },
    },
    'gw-wiki-003': {
      description: 'Wiki links resolve to another committed wiki page',
      async check(ctx) {
        const files = await wikiFiles(ctx);
        const targets = new Set(
          files.map((file) => file.replace(/^.*\/wiki\//, '').replace(/\.md$/, ''))
        );
        for (const file of files) {
          const source = await ctx.readFile(file);
          for (const match of source.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
            const target = match[1].trim().replace(/\.md$/, '');
            if (!targets.has(target)) {
              violation(ctx, `Broken wiki link: [[${match[1].trim()}]]`, file);
            }
          }
        }
      },
    },
    'gw-serve-001': {
      description: 'SSE disconnect cleanup clears the timer and client registration',
      async check(ctx) {
        const file = 'src/serve/mcp-http.ts';
        const source = await readRequired(ctx, file);
        if (!source) return;
        const closeHandler = source.match(
          /req\.on\(\s*['"]close['"]\s*,\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\}\s*\)/
        );
        if (
          !closeHandler ||
          !/clearInterval\(pingInterval\)/.test(closeHandler[1]) ||
          !/sseClients\.delete\(clientHandler\)/.test(closeHandler[1])
        ) {
          violation(
            ctx,
            'SSE close handler must clear pingInterval and remove clientHandler',
            file
          );
        }
      },
    },
    'gw-dedup-001': {
      description: 'Embedding batches remain bounded at 32 inputs',
      async check(ctx) {
        const file = 'src/dedup/embedding.ts';
        const source = await readRequired(ctx, file);
        if (source && !/const\s+BATCH_SIZE\s*=\s*32\b/.test(source)) {
          violation(ctx, 'ONNX embedding BATCH_SIZE must remain 32', file);
        }
      },
    },
    'gw-dedup-002': {
      description: 'The MiniLM embedding dimension remains 384',
      async check(ctx) {
        const file = 'src/dedup/embedding.ts';
        const source = await readRequired(ctx, file);
        if (source && !/\bdimension\s*:\s*number\s*=\s*384\b/.test(source)) {
          violation(ctx, 'ONNX embedding dimension must remain 384', file);
        }
      },
    },
    'gw-dedup-003': {
      description: 'Context-boosted similarity is clamped to one',
      async check(ctx) {
        const file = 'src/dedup/deduplicator.ts';
        const source = await readRequired(ctx, file);
        if (
          source &&
          /effectiveSim|context_boost/.test(source) &&
          !/effectiveSim\s*=\s*Math\.min\(\s*1\s*,/.test(source)
        ) {
          violation(ctx, 'Context-boosted similarity must be clamped with Math.min(1, ...)', file);
        }
      },
    },
    'gw-dedup-004': {
      description: 'Cosine similarity handles a zero denominator before division',
      async check(ctx) {
        const file = 'src/util/math.ts';
        const source = await readRequired(ctx, file);
        if (source && !/denominator\s*===\s*0/.test(source)) {
          violation(ctx, 'cosineSimilarity must guard a zero denominator', file);
        }
      },
    },
  },
} satisfies RuleSet;
