---
name: testing-and-validation
description: Use when writing a test, debugging a failing one, or getting a change ready to hand over. Covers the single-Vitest-run layout and why the config is at the root, which command narrows a run, what each lint pass holds, and the exact gate to clear before a PR.
---

# Testing and validation

## One run, several projects

`vitest.config.ts` at the **root** declares one Vitest run with a project per package
(`packages/*`, jsdom) plus one for the stories (`storybook`, real Chromium via Playwright).
`pnpm test` is therefore a single process, not a Turborepo fan-out like `build` and
`typecheck`.

The config is at the root for one reason: coverage. Vitest scopes collection to the project
root, so with the story run rooted at `apps/storybook` the only file in scope was
`.storybook/preview.tsx`. Rooting the run here puts `packages/*/src` in scope and merges the
story run with each package's unit run into one number. The comment in the file has the full
version, including why `allowExternal` and an absolute `include` glob are both needed. Do not
move it into the app.

The two projects are also in separate sequence groups on purpose. One Chromium competing with
26 jsdom forks is how the story timeouts start.

## Narrowing

| Command                                                | Runs                        |
| ------------------------------------------------------ | --------------------------- |
| `pnpm test`                                            | everything, once            |
| `pnpm test:cov`                                        | everything, merged coverage |
| `pnpm exec vitest run --project @bohardlabs/datatable` | that package's unit tests   |
| `pnpm exec vitest run --project storybook`             | every story, in Chromium    |
| `pnpm exec vitest run src/filters`                     | files matching a path       |

Reach for the narrow one while iterating; run the whole thing before you call it done.

## Writing a test

- Test the public behaviour. Import the component or hook and drive it the way a consumer
  would; reaching into an internal module to make a test easier bakes the internal into the
  contract.
- Query by role and accessible name, same as a `play` function. See `storybook-stories`.
- A bug fix starts with a test that fails for the stated reason. If you cannot make it fail
  first, you do not yet know what you are fixing.
- Cover the boundary shapes: `undefined`, `null`, `[]`, a partial object, a number as a string.
  Consumers pass all five, and the compiler does not stop them.
- `packages/datatable/src/index.test.ts` asserts the public export list. When it fails,
  something changed in the contract; decide the semver bump rather than updating the snapshot
  reflexively.

## The two lint passes

Split on purpose. oxlint is the day-to-day pass and what the editor runs on every keystroke;
ESLint holds only what oxlint has no equivalent for.

| Command            | Holds                                                         |
| ------------------ | ------------------------------------------------------------- |
| `pnpm lint`        | oxlint. Half a second. The default                            |
| `pnpm lint:types`  | oxlint's type-aware rules (floating promises, and friends)    |
| `pnpm lint:eslint` | sonarjs, storybook, react-hooks v7. Commit/push boundary only |

`react-hooks` lives in the ESLint pass, so `pnpm lint` will not catch a dependency array
mistake. Run `pnpm lint:eslint` before handing over anything with hooks in it.

Do not add a rule to ESLint that oxlint already covers, and do not turn `eslint.enable` back
on in the editor. [`docs/repo/tooling.md`](../../../docs/repo/tooling.md) has the reasoning.

Never `// eslint-disable` or `// oxlint-disable` a finding you have not understood. If a rule
is wrong for this repo, turn it off in the config with a comment saying why, so the decision
sits in one place instead of scattered through the source.

## The gate

```
pnpm validate      # lint + format:check + typecheck + test + build
pnpm validate:ci   # the same, plus the ESLint pass
```

`validate:ci` is what CI runs and what a change should clear before it is handed over. It is
also the honest answer to "does this work": a claim that something passes, without the output,
is a claim.

`pnpm format` is oxfmt. It formats the whole workspace, including markdown tables, so check
`git status` after running it and mention anything it touched outside your change.

## When a story test fails

- **"lost suite" / page reloaded mid-run**: Vite discovered a dependency mid-run. Add it to
  `optimizeDeps.include` in the storybook project, next to `storybook/viewport`.
- **Element not found after a click**: it is portalled. Use `screen`, not `within(canvasElement)`.
- **axe violation**: fix the component. Disabling the rule needs a comment saying why it does
  not apply to that story.
- **Timeout**: prefer `findBy*` and `waitFor` over a bare `getBy*` after an action.
