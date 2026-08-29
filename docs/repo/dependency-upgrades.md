# Dependency upgrades

Two jobs. The routine for checking what has moved, and the record of what this repo
deliberately did not take, so nobody has to rediscover the reason.

A deferral with no written reason looks identical to neglect. That is what this file exists
to prevent.

## The routine

Run it monthly, or before any release that matters.

```bash
pnpm outdated -r          # what has moved, workspace-wide
pnpm peers check          # what would break if you took it
```

`pnpm outdated -r` reports against the resolved tree, so a package pinned through
`catalog:` shows up once with every dependent listed. That is the signal to edit
`pnpm-workspace.yaml` rather than a package.json.

For each row:

1. If it is a patch or minor and `pnpm peers check` stays clean, take it. Bump the catalog,
   run `pnpm validate:ci`, done.
2. If it is a major, read the upstream migration guide before touching anything. Majors in
   a library repo are not a local concern: a peer range widened here becomes an install
   constraint for every consumer.
3. If you decide against it, add a row to the ledger below with the blocker and the
   condition that clears it. Do not leave it unexplained.

Bumps go through the `catalog:` block in `pnpm-workspace.yaml`. A `peerDependencies` range
is written out in full and updated by hand, because it describes what a consumer may bring,
which is deliberately wider than what this repo builds against.

## Deferred

Reviewed 2026-08-29.

### TypeScript 7.0.2 (on 6.0.3)

**Blocker:** `typescript-eslint@8.68.0` declares `"typescript": ">=4.8.4 <6.1.0"` and
throws outright on TS 7 with "typescript-eslint does not support TS 7.0". That kills
`pnpm lint:eslint`, which is part of `validate:ci` and holds the only sonarjs,
react-hooks v7, and storybook coverage in the repo. oxlint has no equivalent for any of it.

The root cause is upstream of typescript-eslint: TS 7.0 ships without a public compiler
API, so nothing that reads the AST can run against it. That API returns in 7.1.

**What we give up:** TS 7 is a Go port of the same compiler. Microsoft describes the
upgrade from 6.0 as purely a speed improvement with zero semantic changes, matching 6.0
behaviour in all but 74 known cases. The prize is build time, roughly 10x on large
codebases. A cold, uncached `turbo run typecheck` across this workspace takes 5.8 seconds,
so realistically about four seconds, on a task Turborepo caches anyway.

**Why it is cheap to wait:** TS 7.0.2 already typechecks this repo clean. `tsconfig.base.json`
carries none of the options TS 6 deprecated and 7 removes: no `baseUrl`, no `outFile`,
`moduleResolution` is `bundler`, target is ES2022. The code is ready; the linter is not.

**Clears when:** typescript-eslint ships TS >=7.1 support, tracked at
[typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940).
Then it is a one-line catalog bump.

### @tanstack/react-table 9.2.3 (on 8.21.3)

**Blocker:** cost, not compatibility. v9 makes features tree-shakable by requiring an
explicit `features` object, which threads a new `TFeatures` generic through every table
type. 59 files here import from `@tanstack/react-table`, 34 of them source and 25 tests,
pulling in `Table`, `Column`, `ColumnDef`, `Row`, `Header`, `Cell` and nine of the `*State`
types. `DataTableColumnDef` and friends are re-exported from `index.ts`, so the new generic
lands in `@bohardlabs/datatable`'s published contract and consumers' own column definitions have
to change with it.

The API rename is the smaller half: `useReactTable` to `useTable`, row models become
feature slots, `table.getState()` becomes `table.state`, and `ColumnPinningState` moves
from `left`/`right` to `start`/`end`. That last one needs a read-side fallback in
`useTableStatePersistence.ts`, because state already sitting in a consumer's localStorage
uses the old keys.

**Why not yet:** it is a semver-major for this package on its own, and it deserves its own
plan and its own changeset rather than riding along inside a dependency sweep. v8.21.3 is
current on its line and not deprecated.

**Clears when:** someone writes the plan. It gets a file in `docs/superpowers/plans/open/`
and a row on the [roadmap](../roadmap.md#5-repo-and-tooling).

### oxc-transform-react 0.147.0 (pinned ^0.145.0)

**Blocker:** `@vitejs/plugin-react@6.1.1` declares the peer as `^0.145.0`. For a 0.x
version a caret does not cross the minor, so that range means 0.145.x and nothing else.
Installing 0.147.0 satisfies "latest" and violates the peer.

This package is not a direct choice. plugin-react 6 dropped the Babel path for the React
Compiler and runs it through oxc instead, and `oxc-transform-react` is the backing
transform. Its version is plugin-react's to pick.

**Clears when:** `@vitejs/plugin-react` widens the peer. Bump the two together, never
alone.

## Notes on the current majors

Things worth knowing before reading a version number and guessing.

- **There is no Material UI v8.** MUI skipped it to realign its majors with MUI X, so
  `@mui/material` went 7 to 9 in one hop. `@mui/x-date-pickers` 8 to 9 is the matching
  step.
- **MUI 9's deprecation surface is nearly empty.** Its shipped `.d.ts` files carry five
  `@deprecated` markers in total (`darkScrollbar`, the `createSvgIcon` re-export,
  `CssVarsProvider`, `createV4Theme`, `StandardProps`), none of them component props and
  none used here. Pickers 9 has two, both internal. Reading the type declarations is faster
  and more verifiable than `@mui/codemod deprecations/all`, which can run for a long time
  on a workspace.
- **`engines.node` is `>=22.22.2`** because jsdom 30 requires it. Raising it is a breaking
  change for consumers on Node 20, so it moves only when something forces it.
- **`eslint-plugin-react` is gone**, not deferred. Its latest release (7.37.5) peers at
  ESLint `^9.7` and does not support ESLint 10, and the config had zero `react/*` rules
  enabled, so it was contributing nothing but an unmet peer.
