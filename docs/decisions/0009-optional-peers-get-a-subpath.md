# 0009. An optional heavy peer gets its own subpath entry

**Status:** decided, 2026-09-29.

## Context

`@vt-labs/form` has fields that need `@mui/x-date-pickers`, `mui-tel-input` or the Google
Places library, and a consumer who renders only text fields should need none of them.
Marking those peers optional is not enough on its own. If the root `index.js` re-exports a
module that imports an optional peer, the peer is in every consumer's import graph: Vite's
dependency pre-bundling, an unbundled test or SSR run, and `tsc` without `skipLibCheck` all
fail when it is not installed, and one eager import pulls it into the main chunk.

Splitting into separate packages fixes the graph but not much else. Bundles get no smaller,
there are more versions to keep in step, and each extension package peers on the core only
to share its React context, which is how a mismatched install ends up with two contexts.

## Decision

A package whose optional peers are heavy exposes one subpath entry per peer
(`@vt-labs/form/pickers`, `/phone`, `/maps`). The root entry reaches no optional peer. All
entries come from one Vite build with `preserveModules`, so shared internals exist once.

## What follows

- Each such package has a test that walks its built `dist/` and fails if an entry reaches
  a peer that belongs to another entry.
- The same shape applies to admin-shell and session when they have optional peers.
- `@vt-labs/datatable` predates this. Its optional `write-excel-file` peer is loaded
  dynamically rather than through a subpath; moving it is a datatable backlog question,
  not a change this decision makes.
