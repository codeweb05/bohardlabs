# 0002. Packages ship ESM only

**Status:** provisional, 2026-08-28. Revisit on the first consumer complaint.

## Context

Dual-publishing ESM and CJS doubles the output surface and invites the dual-package
hazard. React 19 and MUI already require a modern toolchain, so the overlap between "can
use this table" and "needs CJS" is thin.

## Decision

Packages ship ESM only: `formats: ['es']` in every package's `vite.config.ts`, no `require`
condition in `exports`.

## What changes it

A consumer on a CJS test runner turning up. Adding a second `build.lib` format in
`packages/datatable/vite.config.ts` plus a `require` condition in `exports` is a small
change. Don't do it speculatively.
