---
'@vt-labs/nestjs-notification-preview': minor
---

First release, and the new name of `@vt-labs/notification-preview`, which is deprecated: a NestJS module, `NotificationPreviewModule.forRoot` and `forRootAsync`, that serves a page at a path you choose where your team previews every email and push notification as its recipient sees it, edits the values it is built from, and sends a test to themselves. Your app supplies a registry of notifications and a render and send for each channel, with the locales it supports. Test mode lets a reviewer tick notifications off, and the catalog carries a fingerprint of each notification's sample render per locale, so every notification whose template changed since its tick is flagged, opened or not. `enabled` is required, and `false` registers nothing for production. `decorators` puts your own guards and rate limits on the routes, and `strings` replaces any of the page's words. The Nest peers, `reflect-metadata` and `rxjs` are optional: the root entry needs them, the framework-neutral core at `@vt-labs/nestjs-notification-preview/core` needs none. React is bundled into the prebuilt page with its licence notice, so your API installs none.

Moving from `@vt-labs/notification-preview`:

- The `languages` option is removed; each provider lists its own with `locales()`, which is now required.
- `lang` is now `locale`, in requests and in the provider's `render` and `send` arguments.
- `Catalog.languages` is now `Catalog.locales`, one list per configured channel; the catalog gains `fingerprints`, and `preview.catalog()` returns a promise.
- The React entry (`./react`, `NotificationPreviewPage`, `createFetchClient`) and `./style.css` are gone: the module serves the page itself.
- `enabled` has no default.
