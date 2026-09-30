# lib

Publishable npm packages: Node, NestJS, React, and other JS/TS libraries.

pnpm workspaces + Turborepo + Changesets. Node 20.19+, pnpm 11.

```bash
pnpm install
pnpm storybook   # showcase on http://localhost:6006
pnpm validate    # lint + typecheck + test + build
```

## Packages

| Package              | What it is                                                         | Status                           |
| -------------------- | ------------------------------------------------------------------ | -------------------------------- |
| `packages/datatable` | Server-driven React data table (TanStack Table + MUI)              | 0.1.0, first release pending     |
| `packages/form`      | MUI fields for TanStack Form, with pickers, phone and maps entries | 0.1.0-next.0, prerelease pending |

Packages are scoped `@vt-labs/*`. See the [roadmap](docs/roadmap.md#1-publishing).

## Showcase

`apps/storybook` aggregates stories from every package. Stories live next to the source
they document, and they double as the test suite: `@storybook/addon-vitest` runs each one
in a real browser, `play` functions are the interaction tests, and an axe violation fails
the run.

## License

[MIT](LICENSE).

## Working here

Read [`CLAUDE.md`](CLAUDE.md). The short version: this is library code, so it runs inside
somebody else's build, under their React, their bundler, their theme, their locale. Nothing
app-specific gets imported; it gets injected.
