# 0004. `noUncheckedIndexedAccess` goes on, in its own change

**Status:** decided, 2026-08-28. Not done yet; tracked on the
[roadmap](../roadmap.md#2-bohardlabsdatatable).

## Context

It is the right flag for library code: a consumer's data is never as complete as the types
say, and `sorting[0].id`-shaped access is exactly where that shows up. Turning it on during
the port would have buried the port in several hundred new errors of that shape.

## Decision

Deliberately off during the port. The port has landed, so the flag now goes on in its own
change, so the diff is readable.
