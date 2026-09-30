---
name: shipping-a-change
description: Use when finishing a unit of work in this repo, or when asked whether something needs a changeset. Covers what a changeset is for and how to pick the bump, which documents change in the same commit as the code, the decision log, the plan lifecycle, and how agents commit their own work.
---

# Shipping a change

## Commit it yourself

Agents commit their own work without asking; the rules are in the Git section of
`CLAUDE.md`. In short: a `<type>/<slug>` branch, never `main`; a conventional-commit message
that commitlint accepts; files staged by name; `git mv` for moves; never `--no-verify`.
Push, rebase, reset, clean, merges into `main` and PRs still wait for the user.

So "done" means: the code is written, the gate is green, the documents below are updated, and
the unit of work is committed on its branch.

## Does it need a changeset?

Yes, if it changes a package's **published output**. That means anything in
`packages/<name>/src`, its package.json, or its build config.

No, if it only touches `apps/storybook`, `docs/`, root config, or a test. The storybook app is
private and the tarball ships `dist` only.

```
pnpm changeset      # pick the packages, pick the bump, write the line
```

Picking the bump:

| Bump      | For                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **patch** | A fix that changes no signature and no documented behaviour                                                                                 |
| **minor** | New prop, new export, new optional peer, a **widened** peer range                                                                           |
| **major** | Anything removed or renamed on the public surface, a **narrowed** peer range, a changed default, a behaviour a consumer could be relying on |

A widened range is a minor and a narrowed one is a major, because narrowing breaks installs
that work today. `library-boundaries` has the rest of the semver rules.

Write the changeset line for **someone who did not read the diff**. It appears in a stranger's
changelog, next to twenty other lines, months later.

```
Bad:   Fixed the bug in TableHeader
Good:  Column resize no longer resets the sort when the table is server-driven
Good:  `maxHeight` now caps the scroll container. Without it the page scrolls, as before
```

Neither `pnpm version-packages` nor `pnpm release` runs automatically, and neither is yours
to run unless asked.

## What changes in the same commit

`docs/roadmap.md` is where everything stands, and **it changes in the same commit as the
thing it tracks**. A plan starting or finishing, a decision landing, a package publishing, a
deferred upgrade clearing: each one edits its row. Progress inside a plan is not tracked
there; a plan's own checkboxes are the source of truth for that.

Status lives in exactly one place per level, so there is nothing to reconcile:

| Level              | Where its status lives            |
| ------------------ | --------------------------------- |
| Workstream, plan   | `docs/roadmap.md`                 |
| Task within a plan | that plan's checkboxes            |
| Feature            | `docs/packages/<name>/roadmap.md` |
| Published or not   | the root `README.md`              |

Beyond the roadmap row, ask which of these the change makes untrue:

- The package `README.md`, if the public surface or the setup changed.
- `packages/<name>/src/docs/*.mdx`, if what a consumer can reach changed. The theming guide
  is a promise about what `createTheme` moves; an `sx` rule can silently break it.
- `apps/storybook/src/Introduction.mdx`, if the showcase itself changed.
- `docs/repo/dependency-upgrades.md`, if an upgrade was taken or deliberately not taken.

## Decisions

`docs/decisions/` is one numbered file per decision, written once and never moved;
`decisions/README.md` gets a row in the same commit. `decisions/open-questions.md` holds the
ones nobody has answered.

**Read both before assuming an answer.** Do not invent an answer to a question parked in
open-questions; use the placeholder or ask. The day one is answered it becomes the next
numbered decision, and any work the answer creates goes on the roadmap, not in the decision
file.

## Plans

A plan lives in `docs/superpowers/plans/open/` until its last task is checked off, then moves
to `done/` with the filename unchanged. Moving it is the last step of the plan, and the
roadmap row is edited in the same commit. A plan is dated the day it was written, not the day
it is executed, and that date never changes.

## Before you say it is done

```
pnpm validate:ci
```

lint + format:check + jscpd + typecheck + test + build + the ESLint pass. Report the result honestly:
if something fails, say so and paste the output; if you skipped a step, say which. A claim
that it passes, without having run it, is a claim.

Then check `git status` and say what you touched. `pnpm format` runs oxfmt over the whole
workspace, markdown included, so it can quietly reformat files that had nothing to do with
the change. Mention those rather than letting them ride along unannounced.

## Checklist

- [ ] Changeset written, at the right bump, in a line a stranger can read. Or: no published
      output changed, and you said so.
- [ ] `docs/roadmap.md` row edited, if this change moves anything it tracks.
- [ ] README, MDX guides and the decision log still true.
- [ ] `pnpm validate:ci` green, output reported.
- [ ] `git status` reviewed; incidental changes named.
- [ ] Committed on a `<type>/<slug>` branch, files staged by name, hooks passed without
      `--no-verify`. Nothing pushed, rebased or reset without the user.
