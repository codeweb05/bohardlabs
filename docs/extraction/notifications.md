# Proposal: `@bohar/notifications`

**Status:** deferred, 2026-08-28. **Source:** `skipwash-admin/src/components/NotificationBell/`,
`NotificationToast/`, `NotificationBanner/`, `src/hooks/useNotification*`, `usePushNotification`,
`src/lib/firebase/`, `src/pages/Settings/Notification/`. Roughly 1800 loc with tests.
**Apps using it:** 4 of 4.

## What it is

The whole notification stack, and it is a stack rather than a component:

| Piece | LOC | What it does |
| ----- | --: | ------------ |
| `NotificationBell` + hook | 544 | Bell with unread badge, dropdown list, infinite scroll, mark-read |
| `NotificationToast` | 194 | Stacked transient toasts driven by the unread delta |
| `NotificationBanner` + hook | 295 | Persistent in-app banners with pause on hover, dismiss all |
| `useNotificationAlert` | 141 | Turns an unread count change into toasts and a bell animation |
| `usePushNotification` | 163 | FCM token registration, foreground message handling, permission |
| `lib/firebase` | 97 | App init and messaging, guarded for unsupported browsers |
| `Settings/Notification` | 399 | The per-category, per-channel preferences matrix |
| `useNotificationApi` | 95 | List, unread count, mark read |

Duplicated in all four forks, which by the survey's own ranking rule should put it near the
top.

## Why it is deferred anyway

Duplication is necessary evidence, not sufficient. This one fails on shape.

**It is fused to the API, not just to types.** `useNotificationApi` calls
`API_ENDPOINTS.NOTIFICATIONS.*`, expects `{data, meta: {page, limit, total, totalPages,
hasNextPage, hasPreviousPage}}`, and keys its cache on the app's `QUERY_KEYS`. The
preferences screen is worse: `NotificationPreferencesResponse` is a categories array whose
channels each carry `{isAvailable, isEnabled}` for email, SMS and push, and the update
request is a different shape again. A component that renders that matrix is rendering one
backend's admin API, not a general preferences UI.

**It routes.** `resolveNotificationRoute` maps a notification's `data.action` and
`data.entityId` to a route in that app. Three of the eight pieces call it. Inverting it is a
prop, but it is the seam where the generic thing meets the domain, and it is not obvious
what the generic side of it should look like until a second app has different actions.

**Firebase is a hard dependency with real setup.** A service worker file at a fixed path, a
VAPID key, a manifest, and browsers where the whole thing is unsupported. Publishing this
means publishing an installation procedure, and every consumer's build has to place
`firebase-messaging-sw.js` correctly or push silently does nothing. That is a support burden
disproportionate to the component library the rest of these packages are.

**Four separate presentations of the same event.** A bell dropdown, a toast, a banner and a
sound-and-animation controller are four opinions about how to interrupt someone. Extracting
all four freezes those opinions. Extracting one leaves an app importing three from itself
and one from a package, which is worse than either.

The honest summary: this is the largest duplication in the survey and the one whose
extraction is a redesign rather than a port. That combination is exactly what a deferral is
for.

## What would change the answer

- **The backend contract is settled and shared.** If skipwash-api and smarthip-backend agree
  on the notification list, unread-count and preferences shapes, most of the objection above
  evaporates, and the same precondition that gates `@bohar/api-client` gates this.
- **Someone wants to design it rather than port it.** The publishable shape is a headless
  core plus thin presentational parts: a `NotificationStore` fed by whatever transport the
  app has, a `useNotifications()` hook over it, and `Bell`, `Toast` and `Banner` as
  presentational components taking items and callbacks. That is a real design task, not an
  afternoon.
- **A fifth app starts.** Four forks each fixing their own notification bugs is already the
  cost; a fifth makes it unarguable.

## Order, if it is ever built

After `@bohar/api-client`, which owns the query client, the error handling and the auth the
notification hooks all sit on. And after `@bohar/admin-shell`, which is where the bell and
the banner get rendered: the shell's `actions` and `banner` slots are deliberately shaped to
take them.

## The pieces that could go earlier

Two are separable and neither needs the redesign:

`useNotificationBanner` (166 loc) is a queue with pause-on-hover, auto-dismiss timers and
dismiss-all. Nothing in it is notification-specific; it is a transient message queue and
would work for any of them.

`lib/firebase/messaging.ts` (63 loc) is worth its own tiny package or a slot in a
`@bohar/web-utils`, mostly because of what it gets right: it checks `isSupported()` before
touching the API, so Safari and Firefox private windows degrade instead of throwing.

## Recommendation

Do not extract now. Revisit after `@bohar/api-client` and `@bohar/admin-shell` ship, and
treat it as a design task with its own brainstorming pass rather than a port with a plan.
