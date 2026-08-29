# CLAUDE.md — lib

Monorepo for publishable npm packages: Node, NestJS, React, and other JS/TS libraries.
This file loads on every message, so it stays lean. Package-specific rules live in that
package's own `CLAUDE.md`; situational rules live in `.claude/skills/`.

## What this repo is

A **library** repo, not an app repo. That distinction drives almost every rule below: code
here runs inside somebody else's build, under their React version, their bundler, their
theme, their locale, and their test runner. Anything you cannot see from inside this repo
is a constraint you have to design for rather than discover later.

Practical consequences:

- **No app imports.** No `@/…` aliases, no framework-specific globals, no reaching for a
  config file that only exists in the consuming app. If a package needs something from its
  host, it takes it as a prop, an option, or an adapter.
- **Peer, not dependency.** Anything the consumer also holds an instance of (React,
  MUI, TanStack, Nest) is a `peerDependency`, listed again in `devDependencies` so this
  repo can build and test against it. Bundling a second copy of React or of a
  `@tanstack/react-table` type is a bug that only shows up in the consumer's install.
- **The public surface is the contract.** Anything exported from a package's `index.ts` is
  something a stranger depends on and a semver-major to change. Export deliberately.
- **Breaking changes cost real money.** Deprecate with a working fallback, ship the
  removal in the next major.

## Layout

```
.
├── packages/          # published libraries, one directory each
│   └── datatable/     # first package: server-driven React data table
├── apps/
│   └── storybook/     # the showcase; aggregates stories from every package
├── docs/              # see docs/README.md for the map
│   ├── roadmap.md     # where everything stands; links to every plan, backlog and decision
│   ├── decisions/     # the decision log, one file each, plus open-questions.md
│   ├── repo/          # how this repo works: tooling, CI
│   ├── packages/      # per-package history and roadmap
│   ├── extraction/    # what else is worth pulling out of the apps, and why
│   └── superpowers/   # implementation plans, one per unit of work
├── pnpm-workspace.yaml        # workspace globs + the shared version catalog
├── turbo.json                 # task graph
├── .oxlintrc.json             # the fast lint pass (editor + `pnpm lint`)
├── eslint.config.js           # the slow pass: sonarjs, storybook, react-hooks v7
└── tsconfig.base.json         # every package extends this
```

## Commands

Run from the root; Turborepo fans out and caches.

| Command            | What it does                                                |
| ------------------ | ----------------------------------------------------------- |
| `pnpm build`       | Build every package (JS via Vite lib mode, types via `tsc`) |
| `pnpm typecheck`   | `tsc --noEmit` everywhere                                   |
| `pnpm test`        | One Vitest run: every package's unit tests plus the stories |
| `pnpm test:cov`    | The same run with a merged coverage report                  |
| `pnpm lint`        | oxlint. Half a second; this is the default                  |
| `pnpm lint:types`  | oxlint's type-aware rules (floating promises, and friends)  |
| `pnpm lint:eslint` | The slow pass: sonarjs, storybook, react-hooks v7           |
| `pnpm format`      | oxfmt                                                       |
| `pnpm validate`    | lint + format:check + typecheck + test + build. Pre-PR gate |
| `pnpm validate:ci` | `validate` plus the ESLint pass. For commit/push and CI     |
| `pnpm storybook`   | Showcase on <http://localhost:6006>                         |
| `pnpm changeset`   | Record a version bump + changelog entry for a change        |
| `pnpm release`     | Build, then `changeset publish`                             |

Tests are the exception to "Turborepo fans out": `vitest.config.ts` at the root declares one
run with a project per package plus one for the stories, so `pnpm test` is a single Vitest
process. `vitest run --project @bohardlabs/datatable` or `--project storybook` narrows it.
Coverage is the reason the config lives at the root rather than in each package; the comment
in the file has the details.

`pnpm --filter @bohardlabs/datatable build` scopes a Turborepo task to one package. Lint is not
one of them: one flat config at the root covers everything, so `pnpm lint` is always the
whole workspace.

Linting is split in two on purpose. oxlint is the day-to-day pass and what the editor runs
on every keystroke; ESLint holds only what oxlint has no equivalent for and runs at the
commit/push boundary. `docs/repo/tooling.md` has the reasoning, including why the repo uses both
pnpm workspaces and Turborepo, and Turborepo rather than Nx. Do not add a rule to ESLint
that oxlint already covers, and do not turn `eslint.enable` back on in the editor.

## Versioning and release

[Changesets](https://github.com/changesets/changesets). Every change that touches a
package's published output needs a changeset: `pnpm changeset`, pick the packages, pick
patch/minor/major, write the line that will appear in the consumer's changelog. Write it
for someone who did not read the diff.

`pnpm version-packages` applies pending changesets to versions and changelogs.
`pnpm release` publishes. Neither runs automatically.

## The version catalog

Shared dependency versions live in the `catalog:` block of `pnpm-workspace.yaml`, and
package.json files say `"react": "catalog:"` instead of a range. Bump in one place. Two
copies of React in a workspace break hooks in ways that look like unrelated render bugs,
and this is what prevents it.

A `peerDependencies` range is written out in full, never `catalog:` — it describes what a
consumer may bring, which is deliberately wider than what this repo builds against.

## Adding a package

1. `packages/<name>/` with `package.json`, `tsconfig.json`, `tsconfig.build.json`,
   `vite.config.ts`, `src/index.ts`. Copy `packages/datatable/` and strip it.
2. `"private": true` until it is genuinely ready to publish. Flipping it is the decision
   to support the thing forever.
3. Extend `tsconfig.base.json`. Do not re-declare compiler options it already sets.
4. Shared deps as `catalog:`. Host-owned deps as peers.
5. A `README.md` that opens with what the package does and who it is for, not with install
   instructions.
6. Stories in `packages/<name>/src/**/*.stories.tsx` for anything with a UI. The showcase
   picks them up with no registration step.

## Showcase: Storybook

`apps/storybook` is the workbench and the demo. Stories live **next to the source** inside
each package, not in the app; the app only aggregates them. A story therefore imports the
component the way a consumer would.

Stories are also the test suite for UI. `@storybook/addon-vitest` runs every story in a
real Chromium through Vitest, so one story file is the demo, the interaction test, and the
a11y check at once:

- the `play` function is the interaction test (`vitest run --project storybook`);
- `parameters.a11y.test = 'error'` in `.storybook/preview.tsx` turns an axe violation into
  a failing test, not a panel warning.

Write the `play` function for anything with behaviour. A story with no `play` asserts
nothing and will drift.

The preview renders under **plain MUI light and dark themes**, switchable from the
toolbar. That is deliberate: a component that only looks right under one app's palette is
not ready to publish, and this is where that shows up first.

## Hard rules

- Never `any`, `@ts-ignore`, `@ts-expect-error`, or `as unknown as` to get past a type
  mismatch. Fix the type.
- Never hardcode a user-facing string inside a component. Take it as a prop with an
  English default, so a consumer can translate it. There is no i18n framework here; that
  is the consumer's job.
- Never hardcode a colour. Read theme tokens (`primary.main`, `divider`,
  `text.secondary`), so the component follows the consumer's theme.
- Never import from another package's `src/`. Import from its package name; the workspace
  link resolves it.
- Defensive types at the boundary: a consumer will pass partial data, and the compiler will
  not stop them. Keep `| null` / `?` and null-check.
- No barrel imports of icon packs (`@mui/icons-material/X`, never the barrel). A library
  that pulls in the whole pack costs every consumer the same.
- Never `// eslint-disable` or `// oxlint-disable` a finding you have not understood. If a
  rule is wrong for this repo, turn it off in the config with a comment saying why, so the
  decision is in one place instead of scattered through the source.

## Git (hands off)

**Never run any git command** — no `add`, `commit`, `push`, `checkout`, `stash`, `reset`,
`rebase`. The user manages all version control.

## Text

For human-readable text (README, changelog, story docs, comments):

- No em-dashes; use commas, periods, or parentheses.
- Cut filler and hedging ("basically", "essentially", "it's worth noting").
- Vary sentence length; don't pad a short correct statement.
- Avoid LLM tells ("it's not just X, it's Y", "delve", overwrought openers).
- Reread before finishing; delete anything that doesn't earn its place.

## Decisions and status

`docs/decisions/` is the decision log, one numbered file per decision, and
`docs/decisions/open-questions.md` holds the ones not made yet. Read both before assuming
an answer. Do not invent an answer to a question parked there; either use the placeholder
or ask.

`docs/roadmap.md` is where everything stands. It changes in the same commit as the thing it
tracks: a plan starting or finishing, a decision landing, a package publishing.
