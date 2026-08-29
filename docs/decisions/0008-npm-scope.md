# 0008. npm scope is `@bohardlabs/*`

**Status:** decided, 2026-08-29. Supersedes [0007](0007-npm-scope.md).

## Context

0007 locked the company spelling as Bohard and the npm scope as `@bohard/*`. The
`bohard` org could not be created: that name is already an npm _user_ (publisher of
`html-pdf-lite`), and org names share that namespace. The org `bohardlabs` was registered
instead. The company name stays Bohard; the published scope is the org that actually exists.

## Decision

`@bohardlabs/*`. Packages were renamed from `@bohard/*`. `@bohardlabs/datatable` is the
first package to leave `"private": true` and publish.

## Follow-ups

Tracked on the [roadmap](../roadmap.md#1-publishing), not here.

Storybook and the workspace root stay private.
