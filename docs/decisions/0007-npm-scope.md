# 0007. npm scope is `@bohard/*`

**Status:** superseded by [0008](0008-npm-scope.md), 2026-08-29.

## Context

0001 locked the scope as `@bohar/*`. That spelling had three problems worth a rename
before anything is published: English speakers collapse it to "boar" or "bore"; another
software shop already uses Bohar; and the Punjabi ੜ wants a harder ending than a trailing
r. The Hinglish reading "bohot hard" is accepted as a feature for an Indian audience.

## Decision

`@bohard/*`. Same company name, different spelling. Packages were renamed from `@bohar/*`.
They stay `"private": true` until a package is genuinely ready to publish.

## Follow-ups

Tracked on the [roadmap](../roadmap.md#1-publishing), not here:

- create the `bohard` org on npm and add the publishing account
- remove `"private": true` on the packages meant to publish
