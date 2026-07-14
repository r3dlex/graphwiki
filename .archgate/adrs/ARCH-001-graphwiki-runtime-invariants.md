---
id: ARCH-001
title: GraphWiki runtime invariants
domain: architecture
rules: true
files:
  - "src/**/*.ts"
  - "wiki/**/*.md"
---

## Context

GraphWiki rebuilds persistent graph and wiki artifacts. Small implementation
changes can silently make node identifiers unstable, corrupt merge semantics,
leave streaming clients registered, or change embedding compatibility.

## Decision

The repository commits executable Archgate rules for the invariants that are
cheap and deterministic to verify from source:

- graph node IDs continue to use SHA-256;
- graph merges remain immutable and duplicate edge weights accumulate;
- completeness continues to derive from provenance;
- wiki pages, when present, keep their required frontmatter and valid links;
- source code does not write into the `raw/` input tree;
- SSE disconnect handlers clear their timer and client registration; and
- embedding dimensions, batch size, similarity clamping, and zero-vector
  handling remain stable.

The companion rule file is the enforcement surface. CI runs both the normal
check and a behavioral fixture that injects a known violation and requires a
non-zero exit status.
