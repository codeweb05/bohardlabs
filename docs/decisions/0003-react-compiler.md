# 0003. The React Compiler runs here, not in the consumer

**Status:** decided, 2026-08-28.

## Context

The table's source carries `'use no memo'` directives, which exist for the React Compiler.
Two options were on the table:

- **Compile at build time** (add the compiler to the package build). Every consumer gets
  the optimised output whether or not they run the compiler. The directives are consumed
  here and never ship.
- **Ship uncompiled** and let a consumer's compiler handle it. Smaller build, but the
  directives have to survive transpilation, and esbuild does not reliably preserve unknown
  top-of-file directives, so this needs a preserve-directives plugin to be safe.

The lean was toward compiling here: it makes the package's behaviour independent of the
consumer's build config, which is the whole argument for shipping a library at all.

## Decision

Compile here. The port settled it empirically: three tests fail without the compiler,
because several components depend on it for the memoization they are written against. So
the compiler runs in the test config and in the build, and the build moved from tsup to
`vite build` to get a compiler into the pipeline at all.
[`../packages/datatable/port.md`](../packages/datatable/port.md) has the detail.

Since `@vitejs/plugin-react` 6 the compiler runs through oxc rather than Babel
(`react({compiler: true})` in `packages/datatable/vite.config.ts`). The mechanism moved;
the decision did not.
