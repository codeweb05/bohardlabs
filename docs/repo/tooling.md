# Tooling

Two lint passes, one formatter, one task runner. This explains what runs where and why
there are two of anything.

## The short version

| Command            | Tool                | Wall clock, whole repo | Runs                                |
| ------------------ | ------------------- | ---------------------- | ----------------------------------- |
| `pnpm lint`        | oxlint              | 0.5s                   | editor (on type), every local check |
| `pnpm lint:types`  | oxlint --type-aware | 1.3s                   | on demand                           |
| `pnpm format`      | oxfmt               | 0.5s                   | editor (on save)                    |
| `pnpm lint:eslint` | eslint              | 6.1s                   | before a commit or a push, and CI   |

`pnpm validate` runs the fast set plus typecheck, test, and build. `pnpm validate:ci`
adds the ESLint pass.

## Why oxlint is the default

It is the same class of tool as ESLint (a Rust rewrite from the oxc project), reading the
same source and reporting most of the same rules, at roughly 12x the speed here and far
more than that on a cold cache. At half a second for the whole workspace it can run on
every keystroke, which is where a linter is actually useful: a rule you see while typing
prevents the code, a rule you see in CI only proves it.

It covers, from a single config with no plugin installs: `correctness` and `suspicious`
categories, `react/rules-of-hooks`, `react/exhaustive-deps`, jsx-a11y, import, unicorn,
promise, vitest, and the typescript rules. `--type-aware` adds the ones that need the type
checker (`no-floating-promises`, `no-misused-promises`, `no-unnecessary-condition`), through
`oxlint-tsgolint`, and still finishes in under two seconds because tsgolint is the Go port
of tsc rather than the JS one.

`--type-aware` is deliberately not in `validate:ci`. It currently reports three findings
that came in with the DataTable port and are real (see `docs/packages/datatable/port.md`); wiring it
into CI before they are fixed would mean starting with a red build or with the rule turned
off, and neither is honest.

## Why ESLint is still here

Because oxlint does not implement everything, and the gaps are worth more than the six
seconds. Checked empirically, not assumed:

- **sonarjs.** No oxlint equivalent, not even partially. It is the only thing in the repo
  that finds cognitive-complexity, duplicated branches, and the assertion-quality rules.
- **eslint-plugin-storybook.** No equivalent. `apps/storybook` is unlinted without it.
- **react-hooks v7's deeper analysis.** oxlint has `rules-of-hooks` and `exhaustive-deps`,
  but not `refs` (a ref read during render), `set-state-in-effect`, `use-memo`, or
  `incompatible-library`. Those are the four that matter most in a codebase built on the
  React Compiler, and they found eight real sites in the ported table.

So `eslint.config.js` holds **only** those three things. No typescript-eslint recommended
set, no import plugin, no jsx-a11y, no prettier config: every one of those would repeat
what oxlint already did half a second earlier, and a rule reported twice is a rule you stop
reading. The first version of that config did include `recommendedTypeChecked` and produced
174 errors in code the source app had been shipping for a year, which is the failure mode
being avoided.

Their findings are warnings, not errors. They point at real things, and they came in with
ported code that was not rewritten during the move, so failing on them would block a push
over debt that predates the repo.

## Why oxfmt instead of prettier

Same argument, plus one thing prettier could not do alone: `sortImports` is built in, so
`prettier-plugin-organize-imports` (which loaded a full TypeScript language service to sort
lines) is gone. `.oxfmtrc.json` was produced with `oxfmt --migrate=prettier`, so the output
matches what prettier was producing: single quotes, no bracket spacing, 120 columns,
trailing commas.

`oxfmt` is pre-1.0, hence `"oxc.fmt.experimental": true` in the editor settings. If it
misformats something, that is the flag to turn off; the prettier config is recoverable from
git history.

## The editor

`.vscode/settings.json` sets `oxc.oxc-vscode` as the default formatter, formats on save,
fixes on save, and lints on type. It explicitly sets `"eslint.enable": false` and
`"prettier.enable": false`: leaving either on means every file gets linted twice and
formatted by two tools that disagree about at least one thing. `.vscode/extensions.json`
recommends the oxc extension and un-recommends the other two, so a new clone gets the right
setup without being told.

If you want the ESLint findings in the editor for a moment, run `pnpm lint:eslint` in a
terminal rather than flipping `eslint.enable`, which would turn the on-type pass back into
a six-second one.

## Commit and push

There is no husky config and no CI workflow yet. When they land, they run `pnpm validate:ci`
(the ESLint pass included). That is the whole point of the split: the slow, thorough pass
happens once, at the boundary where slowness is invisible, and the fast one happens
continuously, where it is not.

## Why tests are one Vitest run and not a Turbo task

`build`, `typecheck` and `build-storybook` fan out through Turborepo. Tests do not: the root
`vitest.config.ts` declares one run with a project per package plus one for the stories, and
`pnpm test` is `vitest run`.

The reason is coverage. Vitest scopes coverage to the run's root, so a story run rooted at
`apps/storybook` can only report on `apps/storybook`: the test panel spent a while reporting
29% coverage of `.storybook/preview.tsx` and nothing at all about the library. One run rooted
here puts `packages/*/src` in scope, so `pnpm test:cov` reports the stories and the unit tests
as one number instead of two that cannot be added together.

### The Storybook panel's percentage is not that number

`pnpm test:cov` is the repo's coverage. The percentage in Storybook's test panel is a
different and much lower figure, and the difference is structural rather than a
misconfiguration.

`@storybook/addon-vitest` creates its Vitest instance with `project: ['storybook:<configDir>']`
(`dist/node/vitest.js`). That filter is hard-coded, so the run behind the panel contains the
stories and nothing else. The package's unit tests never enter the process and never
contribute a line. What the panel measures is how much of `packages/*/src` the story `play`
functions reach on their own: about 62% of statements, against about 98% for the full run.

The gap is mostly deliberate. Inline editing, the column filter panel and the React Query
hooks behind `/server` have no story at all, because a unit test covers them more precisely
and a browser test of the same behaviour costs a Chromium render for no extra signal. Read
the panel as story coverage and nothing more. Chasing 100% there means writing stories whose
only job is to re-cover what the unit tests already assert.

Running them together also settles what `--concurrency=1` used to settle. Two Vitest runs at
once are two process pools each sizing itself to the machine: the datatable project forks
jsdom workers, the story project drives a real Chromium. Together they oversubscribe the CPU
and the datatable suite starts failing on timing while it passes on its own. Inside one run
the story project sits in its own `sequence.groupOrder`, so the two never overlap.

`vitest run --project @bohardlabs/datatable` or `--project storybook` narrows the run when only
one half matters.

## Why both pnpm workspaces and Turborepo

They do different jobs and neither replaces the other.

**pnpm workspaces** is the package manager's half. It decides what a workspace _is_: which
directories are packages (`pnpm-workspace.yaml`), how their `node_modules` are linked, that
`"@bohardlabs/datatable": "workspace:*"` in `apps/storybook` resolves to the local folder rather
than the registry, and that `catalog:` pins one React version across everything so hooks
never break on a duplicate copy. It has no idea what a build is.

**Turborepo** is the task runner's half. It knows `build` in one package must wait for
`^build` in its dependencies, that `typecheck` needs the dependency builds too, and that a
task whose inputs have not changed does not need to run again. It has no idea how
packages are installed; it reads the graph pnpm already established.

Run `turbo run build` with no pnpm workspace and there is no graph to order. Run pnpm alone
and you are writing `pnpm --filter A build && pnpm --filter B build` by hand, in the right
order, every time, with no caching. Two packages hides this; twenty does not.

## Why Turborepo and not Nx

Nx would work. It is the stronger tool at scale, with a real project graph, distributed task
execution and computation caching that Turbo's is a simpler version of.

The reasons against it here are all about surface area:

- **Turbo's config is one file, twenty lines.** `turbo.json` above is the entire task
  configuration, and it is readable by someone who has never used Turbo. Nx brings
  `nx.json`, per-project targets, executors, and inferred plugins, and its inference is
  exactly the part that is hard to debug when it guesses wrong.
- **Nx wants to own more than tasks.** Generators, module-boundary lint rules, and its own
  release/versioning tooling, which overlaps Changesets, already chosen here because it is
  the standard for publishing to npm and produces changelogs a consumer can read. Running
  both means picking which one owns versions.
- **This repo is small and stays small.** It publishes a handful of React packages. Turbo's
  ceiling (task orchestration and local/remote caching) is above anything on the roadmap.
  Nx's advantages start mattering at dozens of projects with cross-cutting refactors.
- **Turbo is not a one-way door.** The task config is small enough that moving to Nx later
  is a day, and `nx init` largely does it. Starting on Nx and finding it heavier than needed
  is the more expensive mistake.
