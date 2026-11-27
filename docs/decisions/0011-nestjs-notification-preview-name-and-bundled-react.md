# 0011. The notification preview is a Nest module, and its React is bundled

**Status:** decided, 2026-11-27.

## Context

`@vt-labs/notification-preview` 0.1.0 shipped a core, a React page and a stylesheet that each app had to mount in its
own web build and wire to its own routes. The apps that use it are Nest APIs with no React of their own: serving the
page meant adding a React install, a bundler step and three hand-written routes to each one.

## Decision

The package is renamed `@vt-labs/nestjs-notification-preview` and ships a Nest module,
`NotificationPreviewModule.forRoot` and `forRootAsync`, that serves a prebuilt page and its three routes. The old name
is deprecated on npm with a pointer to the new one; the core stays at `./core`.

React and React DOM are `devDependencies`, bundled into `dist/ui`, not peers. The consumer is a Nest API with no React;
a peer would force a React install, at a matching version, for a page it never imports. The usual rule that a library
does not bundle React (see `CLAUDE.md`, "Peer, not dependency") holds where the consumer renders the component. Here
the consumer only serves static files, so no second copy of React can meet the consumer's own.

## What follows

- The package has no React in any entry's import graph: `.` and `./core` are server code, and the page is files.
- The server reads `dist/ui` through `import.meta.url`, so bundling the server into one file breaks it unless that
  folder ships beside it. The README says so.
- The package's version restarts at `0.1.0` under the new name.
- A React page for an app's own web build is not offered. If one is wanted, it is a new entry with React as an
  optional peer, under decision 0009.
