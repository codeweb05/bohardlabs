# Plans

One plan per unit of work, written so someone with no context for this repo can execute it
task by task. A plan lives in `open/` until its last task is checked off, then moves to
`done/` with its filename unchanged.

## Open

Take them in this order. The only hard dependency is admin-ui before form.

| Order | Plan                                                                       | Package               | Size   | Blocked on                                          |
| :---: | -------------------------------------------------------------------------- | --------------------- | ------ | ---------------------------------------------------- |
|   1   | [image-editor](open/2026-08-28-image-editor-package.md)                     | `@bohar/image-editor` | 817 loc, 7 tasks   | nothing                                  |
|   2   | [admin-ui-kit](open/2026-08-28-admin-ui-kit-package.md)                     | `@bohar/admin-ui`     | ~1000 loc, 9 tasks | nothing                                  |
|   3   | [form-kit](open/2026-08-28-form-kit-package.md)                             | `@bohar/form`         | 2640 loc, 12 tasks | plan 2 (CancelButton renders its dialog) |
|   4   | [api-client](open/2026-08-28-api-client-package.md)                         | `@bohar/api-client`   | 1200 loc, 9 tasks  | confirming the backend envelope is shared |
|   5   | [admin-shell](open/2026-08-28-admin-shell-package.md)                       | `@bohar/admin-shell`  | 1120 loc, 8 tasks  | plan 2                                   |

## In progress

Nothing yet. When you start a plan, move its row here and say who has it.

| Plan | Owner | Started | At task |
| ---- | ----- | ------- | ------- |

## Done

| Plan | Package | Finished |
| ---- | ------- | -------- |

The DataTable port predates this board and has no plan document. Its history is in
[`../../packages/datatable/port.md`](../../packages/datatable/port.md).

## Deferred

Four candidates were surveyed and deliberately not planned. They have proposals rather than
plans, in [`../../extraction/`](../../extraction/): `sse-client`, `excel-export`,
`directions-map`, `notifications`. Each says what would change the answer.

## Executing one

Each plan opens with the sub-skill to use. Two options, both fine:

- **superpowers:subagent-driven-development**. A fresh subagent per task, review between
  tasks. Recommended for the larger plans.
- **superpowers:executing-plans**. Inline, batched, with checkpoints.

Check off each `- [ ]` as you go. The plans are written to be executed out of order within
a task's steps only if the step numbering allows it, which it usually does not: they are
red-green-refactor cycles and the order is the point.

## Git

Every plan ends its tasks with a handoff step rather than a commit command. This repo's
rule is that Claude never runs git ([`../../../CLAUDE.md`](../../../CLAUDE.md)); the plan
supplies the message, a person runs the commit.
