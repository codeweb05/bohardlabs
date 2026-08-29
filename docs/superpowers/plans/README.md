# Plans

One plan per unit of work, written so someone with no context for this repo can execute it
task by task. A plan lives in `open/` until its last task is checked off, then moves to
`done/` with its filename unchanged.

Which plans exist, the order to take them in, what each is blocked on, who has one in
progress and which are done: all of that is on the [roadmap](../../roadmap.md), section
"New packages", and nowhere else. This file says how to execute one.

## Executing one

Each plan opens with the sub-skill to use. Two options, both fine:

- **superpowers:subagent-driven-development**. A fresh subagent per task, review between
  tasks. Recommended for the larger plans.
- **superpowers:executing-plans**. Inline, batched, with checkpoints.

Check off each `- [ ]` as you go. The plans are written to be executed out of order within
a task's steps only if the step numbering allows it, which it usually does not: they are
red-green-refactor cycles and the order is the point.

## Starting and finishing

When you start a plan, edit its row on the roadmap to `in progress`, with your name and the
task you are on, and keep the task number current as you go.

Every plan's last task closes it: the package README, the changeset, the root package
table, then the file moves to `done/` and the roadmap row changes in the same commit. A
plan that gets superseded is edited in place or deleted, never left to rot next to its
replacement.

The DataTable port predates this board and has no plan document. Its history is in
[`../../packages/datatable/port.md`](../../packages/datatable/port.md).

## Git

Every plan ends its tasks with a handoff step rather than a commit command. This repo's
rule is that Claude never runs git ([`../../../CLAUDE.md`](../../../CLAUDE.md)); the plan
supplies the message, a person runs the commit.
