# docs

Each folder holds one kind of document, and which folder a file sits in says what kind it is.

Start with [`roadmap.md`](roadmap.md). It says where everything stands and links to the
document that holds the detail, so it is the one file to read before asking what is done,
what is next, or what is blocked.

| Folder / file             | What it holds                                                         | Read it when                                                  |
| ------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------- |
| `roadmap.md`              | Status of every workstream, linking to plans, backlogs and decisions  | Wondering what is done, in progress, next or blocked          |
| `decisions/`              | The decision log, one file per decision, and the questions still open | Before assuming an answer to anything unsettled               |
| `repo/`                   | How this repo works: tooling, CI, publishing, dependency upgrades     | Setting up, wondering why two linters, or why a dep is pinned |
| `packages/`               | Per-package history and feature backlog, one folder per package       | Working inside a package                                      |
| `extraction/`             | What else in the app repos is worth pulling out, and what is not      | Deciding what to build next                                   |
| `superpowers/plans/open/` | Plans not started, or in progress                                     | Picking up the next piece of work                             |
| `superpowers/plans/done/` | Plans whose work has shipped                                          | Wondering how or why something was built                      |

## Index

**Roadmap**

- [`roadmap.md`](roadmap.md): publishing, the datatable, the five new packages, deferred
  candidates, tooling, open decisions. One status table per workstream, every row linking
  out.

**Decisions**

- [`decisions/README.md`](decisions/README.md): the log. Eight so far: npm scope, ESM-only,
  the React Compiler, `noUncheckedIndexedAccess`, where the DataTable backlog lives, MUI
  versioning.
- [`decisions/open-questions.md`](decisions/open-questions.md): the ones not made yet. Do
  not guess an answer to something parked here.

**Repo**

- [`repo/tooling.md`](repo/tooling.md): why oxlint and ESLint both exist, why pnpm
  workspaces and Turborepo, why not Nx.
- [`repo/ci.md`](repo/ci.md): what runs on a PR, how Storybook gets published, what
  Chromatic does when it has no token.
- [`repo/dependency-upgrades.md`](repo/dependency-upgrades.md): the monthly check routine,
  and the record of which upgrades were deliberately not taken and what unblocks each.

**Packages**

- [`packages/datatable/port.md`](packages/datatable/port.md): how the table got here from
  skipwash-admin and what it left behind.
- [`packages/datatable/roadmap.md`](packages/datatable/roadmap.md): the feature backlog, 39
  candidates ranked across seven tracks, with what already exists for each.

**Extraction**

- [`extraction/README.md`](extraction/README.md): every component across the four admin
  apps worth its own package, ranked, with the ones deliberately left out. This is the
  document the plans argue from.
- Per-candidate proposals for the deferred ones: [sse-client](extraction/sse-client.md),
  [excel-export](extraction/excel-export.md),
  [directions-map](extraction/directions-map.md),
  [notifications](extraction/notifications.md).

**Plans**

- [`superpowers/plans/README.md`](superpowers/plans/README.md): how to execute a plan, and
  the rules every plan follows. Which plans are open, in progress or done is on the
  roadmap, not here.

## Conventions

A plan is dated on the day it was written, not the day it is executed, and the date never
changes. A plan lives in `superpowers/plans/open/` until its last task is checked off, then
moves to `done/` with the filename unchanged. Moving it is the last step of the plan, and
`roadmap.md` gets the matching row edit in the same commit. A plan that gets superseded is
edited in place or deleted, never left to rot next to its replacement.

A decision is one numbered file in `decisions/`, written once and never moved; the log in
`decisions/README.md` gets a row in the same commit. A question sits in
`decisions/open-questions.md` only while it is open. The day it is answered it becomes the
next numbered decision, and any work the answer creates goes on `roadmap.md`, not in the
decision file.

A document in `extraction/` describes a candidate and argues for or against it. A document
in `superpowers/plans/` assumes the argument is settled and says how to build it. When a
deferred candidate is picked up, it graduates: write the plan, add its row to `roadmap.md`,
and leave the proposal in place as the reasoning the plan skips.

Status lives in one place per level. `roadmap.md` holds it for workstreams and plans; a
plan's checkboxes hold it per task; a package backlog holds it per feature; the root
`README.md` says only whether a package is published. Nothing else carries a status, so
there is nothing to reconcile.
