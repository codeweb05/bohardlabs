# docs

Each folder holds one kind of document, and which folder a file sits in says what kind it is.

| Folder        | What it holds                                                     | Read it when                                                |
| ------------- | ----------------------------------------------------------------- | ----------------------------------------------------------- |
| `decisions/`  | Choices not yet made, and the reasoning behind ones that were      | Before assuming an answer to anything unsettled              |
| `repo/`       | How this repo works: tooling, CI, publishing                       | Setting up, or wondering why two linters                     |
| `packages/`   | Per-package history and roadmap, one folder per package            | Working inside a package                                     |
| `extraction/` | What else in the app repos is worth pulling out, and what is not   | Deciding what to build next                                  |
| `superpowers/plans/open/` | Plans not started, or in progress                     | Picking up the next piece of work                            |
| `superpowers/plans/done/` | Plans whose work has shipped                          | Wondering how or why something was built                     |

## Index

**Decisions**

- [`decisions/open-questions.md`](decisions/open-questions.md): the npm scope, module
  format, React Compiler, and everything else still open. Do not guess an answer to
  something parked here.

**Repo**

- [`repo/tooling.md`](repo/tooling.md): why oxlint and ESLint both exist, why pnpm
  workspaces and Turborepo, why not Nx.
- [`repo/ci.md`](repo/ci.md): what runs on a PR, how Storybook gets published, what
  Chromatic does when it has no token.

**Packages**

- [`packages/datatable/port.md`](packages/datatable/port.md): how the table got here from
  skipwash-admin and what it left behind.
- [`packages/datatable/roadmap.md`](packages/datatable/roadmap.md): 30 candidate features,
  ranked, with what already exists for each.

**Extraction**

- [`extraction/README.md`](extraction/README.md): every component across the
  four admin apps worth its own package, ranked, with the ones deliberately left out. This
  is the document the plans argue from.
- Per-candidate proposals for the deferred ones: [sse-client](extraction/sse-client.md),
  [excel-export](extraction/excel-export.md),
  [directions-map](extraction/directions-map.md),
  [notifications](extraction/notifications.md).

**Plans**

[`superpowers/plans/README.md`](superpowers/plans/README.md) is the board: what is open,
what is in progress, what is done, and the order the open ones should be taken in.

## Conventions

A plan is dated on the day it was written, not the day it is executed, and the date never
changes. A plan lives in `superpowers/plans/open/` until its last task is checked off, then
moves to `done/` with the filename unchanged. Moving it is the last step of the plan, and
`plans/README.md` gets the same edit in the same commit. A plan that gets superseded is
edited in place or deleted, never left to rot next to its replacement.

A document in `extraction/` describes a candidate and argues for or against it. A document
in `superpowers/plans/` assumes the argument is settled and says how to build it. When a
deferred candidate is picked up, it graduates: write the plan, and leave the proposal in
place as the reasoning the plan skips.
