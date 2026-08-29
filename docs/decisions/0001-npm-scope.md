# 0001. npm scope is `@vt-labs/*`

**Status:** decided, 2026-08-28.

## Context

Every package needed a scope before anything could be named, exported or published, and
the scope was the one thing blocking a first publish. Packages carried an `@repo/*`
placeholder in the meantime.

## Decision

`@vt-labs/*`. Packages were renamed from the placeholder. They stay `"private": true` until
a package is genuinely ready to publish; `@vt-labs/datatable` is the first to leave it.

Storybook and the workspace root stay private.

## Follow-ups

Tracked on the [roadmap](../roadmap.md#1-publishing), not here:

- create the `vt-labs` org on npm and add the publishing account
- remove `"private": true` on the packages meant to publish
