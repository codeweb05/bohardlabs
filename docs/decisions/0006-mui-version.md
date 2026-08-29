# 0006. MUI: pinned to the app first, then upgraded

**Status:** decided, 2026-08-28. The follow-up upgrade landed 2026-08-29.

## Context

`skipwash-admin` runs `@mui/material` and `@mui/icons-material` at `^7.3.7`. While code
was still moving between the two repos, a component that compiled here and not there would
have been noise, not signal.

## Decision

Pin the catalog to the app's version during the port, as a starting point rather than a
target, and upgrade to the latest MUI once the base setup is done.

Two numbers move separately when that happens, and stay separate: the catalog entry is what
this repo builds against; the `peerDependencies` range in each package is what a consumer
may bring, and is deliberately wider.

## Outcome

Done 2026-08-29. The catalog is on `@mui/material` 9 and `@mui/x-date-pickers` 9 (there is
no MUI 8; see [`../repo/dependency-upgrades.md`](../repo/dependency-upgrades.md)). The peer
ranges widened to `^7 || ^9` and `^8 || ^9` rather than moving, so an app still on MUI 7
keeps working. The changeset for it is written and waits on the first release.
