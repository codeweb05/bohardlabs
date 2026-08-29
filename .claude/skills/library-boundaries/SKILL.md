---
name: library-boundaries
description: Use when touching anything a consumer installs or imports in this monorepo — a package.json dependency, a peer range, the version catalog in pnpm-workspace.yaml, a package's public index.ts, an exported type, or any change that could break somebody else's build. Covers peer-vs-dependency, the catalog, what "public" costs, deprecation with a fallback, and the app imports that must never appear here.
---

# Library boundaries

Code in `packages/*` runs inside somebody else's build, under their React version, their
bundler, their theme, their locale and their test runner. Nothing you can see from inside
this repo tells you what that host looks like, so every constraint has to be designed for
rather than discovered from a bug report.

Four failure modes cause almost all the damage, and none of them fails here. They fail in
the consumer's install.

## 1. Peer, not dependency

Anything the consumer also holds an instance of goes in `peerDependencies`, and is repeated
in `devDependencies` so this repo can build and test against it.

| The consumer holds an instance of it                      | Where it goes                               |
| --------------------------------------------------------- | ------------------------------------------- |
| React, React DOM                                          | peer + dev                                  |
| `@mui/material`, `@emotion/react`, `@emotion/styled`      | peer + dev                                  |
| `@tanstack/react-table`, `@tanstack/react-query`          | peer + dev                                  |
| Nest, RxJS, `reflect-metadata`                            | peer + dev                                  |
| A format writer nothing else touches (`write-excel-file`) | optional peer, loaded with `await import()` |
| A leaf utility with no shared state or types              | `dependencies`                              |

The test is not "is it big". It is: **if the consumer ends up with two copies, does anything
break?** Two Reacts break hooks. Two `@tanstack/react-table` copies produce a `ColumnDef`
that is not assignable to a `ColumnDef`, with an error message that names the same type
twice. Both look like unrelated render bugs in an app you cannot see.

A `peerDependencies` range is written out in full, never `catalog:`. It describes what a
consumer may bring, which is deliberately wider than what this repo builds against. Widening
one is a minor; narrowing one is a **major**, because it breaks installs that work today.

An optional peer needs three things together: `peerDependenciesMeta.<name>.optional: true`,
a runtime `await import()` at the point of use, and a story or a test that proves the error
when it is missing is legible. Listing the format and not installing the peer fails at click
time, not at build time. Say so in the prop's JSDoc.

## 2. The catalog

Shared versions live in the `catalog:` block of `pnpm-workspace.yaml`. A package.json says
`"react": "catalog:"`, never a range. Bump in one place.

Two copies of React in a workspace break hooks in ways that read as unrelated render bugs,
and the catalog is what prevents it. Adding a package that pins its own React version is the
one change most likely to waste a day.

## 3. The public surface is the contract

Anything exported from a package's `index.ts` is something a stranger depends on, and
removing or renaming it is a semver-major. Export deliberately.

- Export the component, its props type, and the types those props reference. Nothing else.
- Do **not** export internals so a test can reach them. A test imports from the source file
  directly; only `index.ts` is the contract.
- Do **not** export a part of a composite ("just the toolbar") because it seems handy. Every
  part exported is a part that has to keep working. `DataTable` deliberately does not export
  its header, body or toolbar; everything a consumer influences is a prop or a `slots` entry.
- `packages/datatable/src/index.test.ts` asserts the export list. A change there is the
  signal to think about the bump, not an inconvenience to update.

`server.ts` and other subpath entries are surface too, and each needs an `exports` map entry
in package.json. ESM only, per [decision 0002](../../../docs/decisions/0002-esm-only.md); do
not add a CJS build without reopening that decision.

## 4. Breaking changes cost real money

Deprecate with a working fallback, ship the removal in the next major:

```ts
/** @deprecated Use `serverState` instead. Removed in 2.0. */
readonly page?: number;
```

Keep the old path working and make the new one the documented one. A prop that throws when
it is passed is a break wearing a deprecation notice.

## What must never appear in `packages/*`

- `@/…` aliases, or any path that resolves through a consumer's tsconfig.
- `import.meta.env`, `process.env`, or a config file that only exists in an app.
- A hardcoded route, endpoint, storage key or query key.
- A user-facing string inside a component. Take it as a prop with an English default; the
  labels pattern (`i18n/labels.ts` plus `LabelsContext`) is how the table does it.
- A hardcoded colour, radius or font. Read theme tokens. See `component-authoring`.
- A barrel import of an icon pack. `@mui/icons-material/Check`, never `@mui/icons-material`.
  The barrel costs every consumer the whole pack.
- An import from another package's `src/`. Import the package name; the workspace link
  resolves it.
- `any`, `@ts-ignore`, `@ts-expect-error`, or `as unknown as` used to get past a type
  mismatch. A library's types are its contract, so silencing a mismatch ships it to everyone.

## Defensive at the boundary

A consumer will pass partial data and the compiler will not stop them, because their types
came from an API client you did not write. Keep `| null` and `?` on anything that crosses in,
and null-check it. `response?.data ?? []` and `response?.meta?.total ?? 0` are the shape.

Tightening a type against what the backend "actually" returns is how a runtime crash gets
introduced by a change that typechecks.

## Checklist

- [ ] Every host-owned dependency is a peer, and is in `devDependencies` too.
- [ ] Shared versions read `catalog:`; peer ranges are written out in full.
- [ ] A widened peer range is a minor; a narrowed one is a major and says so in the changeset.
- [ ] An optional peer has `peerDependenciesMeta`, a lazy `await import()`, and a documented
      failure mode.
- [ ] `index.ts` exports only what a consumer needs; `index.test.ts` updated deliberately.
- [ ] No app imports, hardcoded strings, colours, routes or icon barrels.
- [ ] Removed or renamed public API has a deprecation with a working fallback, or a major.
- [ ] Types crossing the boundary keep their `| null` / `?` and are null-checked.
