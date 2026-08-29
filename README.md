# lib

Publishable npm packages: Node, NestJS, React, and other JS/TS libraries.

pnpm workspaces + Turborepo + Changesets. Node 20.19+, pnpm 11.

```bash
pnpm install
pnpm storybook   # showcase on http://localhost:6006
pnpm validate    # lint + typecheck + test + build
```

## Packages

| Package              | What it is                                            | Status                |
| -------------------- | ----------------------------------------------------- | --------------------- |
| `packages/datatable` | Server-driven React data table (TanStack Table + MUI) | first release |

Packages are scoped `@bohardlabs/*`. `@bohardlabs/datatable` is the first to publish; see
the [roadmap](docs/roadmap.md#1-publishing).

## Showcase

`apps/storybook` aggregates stories from every package. Stories live next to the source
they document, and they double as the test suite: `@storybook/addon-vitest` runs each one
in a real browser, `play` functions are the interaction tests, and an axe violation fails
the run.

## Working here

Read [`CLAUDE.md`](CLAUDE.md). The short version: this is library code, so it runs inside
somebody else's build, under their React, their bundler, their theme, their locale. Nothing
app-specific gets imported; it gets injected.
