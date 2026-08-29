# Decisions

The decision log. One file per decision, numbered in the order they were made, and a file
never moves once written. A decision that gets reversed gets a new entry that says so and
links back; the old one keeps its number and gains a "superseded by" line.

Questions that have not been answered yet live in [`open-questions.md`](open-questions.md)
and nowhere else. Nothing there should be answered by guessing; if work is blocked on one,
ask. The day one is answered, it leaves that file and becomes the next numbered entry here.

## Log

| #    | Decision                                                                                     | Status      | Date       |
| ---- | -------------------------------------------------------------------------------------------- | ----------- | ---------- |
| 0001 | [npm scope is `@bohar/*`](0001-npm-scope.md)                                                 | superseded  | 2026-08-28 |
| 0002 | [Packages ship ESM only](0002-esm-only.md)                                                   | provisional | 2026-08-28 |
| 0003 | [The React Compiler runs here, not in the consumer](0003-react-compiler.md)                  | decided     | 2026-08-28 |
| 0004 | [`noUncheckedIndexedAccess` goes on, in its own change](0004-no-unchecked-indexed-access.md) | decided     | 2026-08-28 |
| 0005 | [The DataTable feature backlog lives in this repo](0005-datatable-roadmap-location.md)       | decided     | 2026-08-28 |
| 0006 | [MUI: pinned to the app first, then upgraded](0006-mui-version.md)                           | decided     | 2026-08-28 |
| 0007 | [npm scope is `@bohard/*`](0007-npm-scope.md)                                                | superseded  | 2026-08-29 |
| 0008 | [npm scope is `@bohardlabs/*`](0008-npm-scope.md)                                            | decided     | 2026-08-29 |
| 0009 | [Public terms are PolyForm Noncommercial](0009-noncommercial-license.md)                     | decided     | 2026-08-29 |

**Status** means: `decided` is settled and the reasoning is in the file; `provisional` is
settled until a named trigger fires, and the file says what the trigger is; `superseded`
points at the entry that replaced it.

Work that a decision creates (an org to create, a flag to turn on) is not tracked here. It
goes on the [roadmap](../roadmap.md), which links back to the decision.

## Adding one

Copy the shape of any entry: a status line, the context that forced the choice, the
decision, and what follows from it. Keep the reasoning as it stood when the call was made;
if it turns out wrong, that is what the next entry is for. Add the row above in the same
commit.
