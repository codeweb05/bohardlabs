# Roadmap

Where everything stands, in one place. Every other document holds detail; this one holds
status and points at the detail. A reader who wants to know what is done, what is being
worked on, what is next and what is blocked reads this and follows a link, instead of
opening five files and reconciling them.

**Reviewed:** 2026-08-29.

## The rule

This file changes in the same commit as the thing it tracks. A plan moving from `open/` to
`done/`, a decision landing, a package publishing, a deferred upgrade clearing: each one
edits its row here. Progress inside a plan is not tracked here. A plan's own checkboxes are
the source of truth for that, and this file says only which plan is open, who has it, and
roughly where they are.

Status words, used the same way in every table below:

| Word          | Meaning                                                          |
| ------------- | ---------------------------------------------------------------- |
| `done`        | Shipped, with the date                                           |
| `in progress` | Someone has it; the row says who and where they are              |
| `ready`       | Nothing blocks it; it is waiting for someone to pick it up       |
| `blocked`     | Cannot start; the row says on what                               |
| `deferred`    | Deliberately not now; the linked document says what changes that |
| `open`        | A decision nobody has made; see the open questions               |

## Where things stand

| Workstream                                       | Status                                      | Next step                                       |
| ------------------------------------------------ | ------------------------------------------- | ----------------------------------------------- |
| [1. Publishing](#1-publishing)                   | first package publishing                    | `@bohardlabs/datatable`                         |
| [2. `@bohardlabs/datatable`](#2-bohardlabsdatatable)       | ported, hardened, on MUI 9; 3 features done | `noUncheckedIndexedAccess`, then feature item 1 |
| [3. New packages](#3-new-packages)               | 5 plans written, 0 started                  | start plan 1, image-editor                      |
| [4. Deferred candidates](#4-deferred-candidates) | 4 deferred                                  | nothing until a trigger fires                   |
| [5. Repo and tooling](#5-repo-and-tooling)       | 3 upgrades deferred                         | the monthly `pnpm outdated -r`                  |
| [6. Decisions](#6-decisions)                     | 8 made, 2 open                              | answer B before plan 4 starts                   |

## 1. Publishing

`@bohardlabs/datatable` is the first package with `"private"` removed. Other packages stay
private until they are genuinely ready; flipping that flag is the decision to support the
thing forever.

| Step                                                      | Status               | Detail                                       |
| --------------------------------------------------------- | -------------------- | -------------------------------------------- |
| Pick the npm scope                                        | done (2026-08-29)    | [decision 0008](decisions/0008-npm-scope.md) |
| Create the `bohardlabs` org on npm, add the publishing account | done (2026-08-29) | decision 0008                                |
| Remove `"private": true` from `@bohardlabs/datatable`          | done (2026-08-29) |                                              |
| First `pnpm release`                                      | in progress          | [`repo/ci.md`](repo/ci.md)                   |

Each new package from section 3 joins this queue once its plan closes: the last task of
every plan writes the README and the changeset, and the package stays private until the
org exists and `@bohardlabs/datatable` is on the first-release path.

## 2. `@bohardlabs/datatable`

The first package. The port is complete: 47 source files, 53 test files, 22 stories, each
one a demo, an interaction test and an axe check.

| Item                                                                | Status                                     | Detail                                                                                       |
| ------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Port out of skipwash-admin, in one pass                             | done (2026-08-28)                          | [`packages/datatable/port.md`](packages/datatable/port.md)                                   |
| Hardening pass: 805 tests, 27 written red against defects           | done (2026-08-28)                          | [`packages/datatable/roadmap.md`](packages/datatable/roadmap.md#hardening-pass-2026-08-28)   |
| Stories with `play` functions and the a11y gate                     | done (2026-08-28)                          | port.md                                                                                      |
| MUI 9 and pickers 9 support, peer ranges widened                    | done (2026-08-29), changeset pending       | [decision 0006](decisions/0006-mui-version.md)                                               |
| `ConfirmDialog` exported, out of `src/internal/`                    | done (2026-08-29), changeset pending       | [`packages/datatable/port.md`](packages/datatable/port.md#what-is-public)                    |
| Turn on `noUncheckedIndexedAccess`                                  | ready, in its own change                   | [decision 0004](decisions/0004-no-unchecked-indexed-access.md)                               |
| Default palette contrast                                            | open                                       | [open question A](decisions/open-questions.md#a-the-default-palettes-contrast)               |
| Lint findings left in the ported code (refs read in render, others) | deferred, reported as warnings             | port.md, "Left alone"                                                                        |
| skipwash-admin switches to the package and deletes its copy         | blocked on publishing                      | port.md, "What is left"                                                                      |
| `@tanstack/react-table` 9                                           | deferred: semver-major, needs its own plan | [`repo/dependency-upgrades.md`](repo/dependency-upgrades.md#tanstackreact-table-923-on-8213) |

### Feature backlog

[`packages/datatable/roadmap.md`](packages/datatable/roadmap.md) ranks 39 candidate
features across seven tracks (state foundations, UX, data out, editing, analytics, library
packaging, performance) and carries its own status table, which is the source of truth.
Its suggested sequence starts with item 1, preferences-only persistence, because items 2,
3, 6 and 26 sit on it.

| Where it stands | Items                                                                     |
| --------------- | ------------------------------------------------------------------------- |
| done            | 0a column reordering, 0b header casing, 4 column pinning from the popover |
| partial         | 18 inline edit, 29 accessibility conformance                              |
| wired, unused   | 14 virtualization (a port exists in `admin-v2`)                           |
| proposed        | the other 35                                                              |

## 3. New packages

Five packages, each with a plan written to be executed task by task. The argument for each
is in [`extraction/README.md`](extraction/README.md); a plan assumes the argument is
settled. Take them in this order. The only hard dependency is admin-ui before form.

| Order | Plan                                                                      | Package               | Size      | Tasks | Status  | Blocked on                                                                                                                              |
| :---: | ------------------------------------------------------------------------- | --------------------- | --------- | :---: | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
|   1   | [image-editor](superpowers/plans/open/2026-08-28-image-editor-package.md) | `@bohardlabs/image-editor` | 817 loc   |  0/7  | ready   | nothing                                                                                                                                 |
|   2   | [admin-ui-kit](superpowers/plans/open/2026-08-28-admin-ui-kit-package.md) | `@bohardlabs/admin-ui`     | ~1000 loc |  0/9  | ready   | nothing                                                                                                                                 |
|   3   | [form-kit](superpowers/plans/open/2026-08-28-form-kit-package.md)         | `@bohardlabs/form`         | 2640 loc  | 0/12  | blocked | plan 2 (`CancelButton` renders its dialog)                                                                                              |
|   4   | [api-client](superpowers/plans/open/2026-08-28-api-client-package.md)     | `@bohardlabs/api-client`   | 1200 loc  |  0/9  | blocked | [open question B](decisions/open-questions.md#b-do-skipwash-api-and-smarthip-backend-share-the-response-envelope), a check, not a build |
|   5   | [admin-shell](superpowers/plans/open/2026-08-28-admin-shell-package.md)   | `@bohardlabs/admin-shell`  | 1120 loc  |  0/8  | blocked | plan 2                                                                                                                                  |

When a plan starts, its status becomes `in progress (owner, task N)`. When its last task
is checked off, the file moves to `superpowers/plans/done/`, the link here follows it, and
the status becomes `done (date)`.
[`superpowers/plans/README.md`](superpowers/plans/README.md) says how to execute one.

## 4. Deferred candidates

Four candidates were surveyed and deliberately not planned: `sse-client`, `excel-export`,
`directions-map` and `notifications`. The reasons, and what would change each answer, are
in [`extraction/README.md`](extraction/README.md), "Deferred, with reasons", with a
proposal per candidate beside it. `excel-export` in particular is not a package at all but
datatable items 15 and 16.

A handful of `lib/` modules (`pwa`, `zod`, `toast`, `firebase`) are each too small to pay
for a package. If several are wanted at once, one `@bohardlabs/web-utils` is the shape to
consider. Nobody has asked for that yet.

## 5. Repo and tooling

The monthly routine and the ledger of upgrades deliberately not taken are in
[`repo/dependency-upgrades.md`](repo/dependency-upgrades.md). Last reviewed 2026-08-29.

| Upgrade                                | Status   | Clears when                                                     |
| -------------------------------------- | -------- | --------------------------------------------------------------- |
| TypeScript 7 (on 6.0.3)                | deferred | typescript-eslint supports TS 7.1; then a one-line catalog bump |
| `@tanstack/react-table` 9 (on 8.21.3)  | deferred | someone writes the plan; semver-major for `@bohardlabs/datatable`    |
| `oxc-transform-react` 0.147 (on 0.145) | deferred | `@vitejs/plugin-react` widens its peer; bump the two together   |

Nothing else is open on the tooling side. [`repo/tooling.md`](repo/tooling.md) and
[`repo/ci.md`](repo/ci.md) describe what exists and why.

## 6. Decisions

Eight made, two open. The log is [`decisions/README.md`](decisions/README.md); the open ones
are in [`decisions/open-questions.md`](decisions/open-questions.md).

| Question                                            | Status | Blocks                                             |
| --------------------------------------------------- | ------ | -------------------------------------------------- |
| A. The default palette's contrast                   | open   | nothing today; the first publish raises the stakes |
| B. Shared response envelope across the two backends | open   | plan 4, api-client                                 |

Work that a decision created and that is still pending appears in the sections above (the
npm org in 1, `noUncheckedIndexedAccess` in 2) rather than here.
