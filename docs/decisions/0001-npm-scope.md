# 0001. npm scope is `@bohar/*`

**Status:** superseded by [0007](0007-npm-scope.md), 2026-08-29.

## Context

Every package needed a scope before anything could be named, exported or published, and
the scope was the one thing blocking a first publish. Packages carried an `@repo/*`
placeholder in the meantime.

## Decision

`@bohar/*`. The scope is the company name as well. Packages were renamed from the
placeholder. They stay `"private": true` until a package is genuinely ready to publish.

## Follow-ups

Tracked on the [roadmap](../roadmap.md#1-publishing), not here:

- create the `bohar` org on npm and add the publishing account
- remove `"private": true` on the packages meant to publish
