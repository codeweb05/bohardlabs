# Extraction survey

**Date:** 2026-08-28. **Scope surveyed:** every JS/TS frontend under `~/saurabh`.

DataTable was the first thing pulled out of skipwash-admin. This document is the answer to
"what else", written once so the reasoning does not have to be rediscovered each time.

Every plan in [`../superpowers/plans/`](../superpowers/plans/) names this file as its spec.
What is written here is the argument; a plan assumes the argument is settled.

## The finding

Four admin apps are near-identical forks of each other, not four apps that happen to look
alike:

| Component                             | skipwash-latest | smart/admin-v2 | smarthip-admin | skipwash/admin |
| ------------------------------------- | :-------------: | :------------: | :------------: | :------------: |
| `DataTable/`                          |        ✓        |       ✓        |       ✓        |       ✓        |
| `form/`                               |        ✓        |       ✓        |       ✓        |       ✓        |
| `ImageEditor/`                        |        ✓        |       ✓        |       ✓        |       ✓        |
| `layouts/`                            |        ✓        |       ✓        |       ✓        |       ✓        |
| `PageHeader/`, `Loader`, five dialogs |        ✓        |       ✓        |       ✓        |       ✓        |
| `lib/axios`, `lib/react-query`        |        ✓        |       ✓        |       ✓        |       ✓        |
| `lib/permissions`, `lib/zod`, `toast` |        ✓        |       ✓        |       ✓        |       ✓        |
| `lib/auth`                            |        ✓        |       ·        |       ·        |       ✓        |
| `lib/excel`, `lib/sse`, `lib/pwa`     |        ✓        |       ·        |       ·        |       ·        |

`ImageEditor/useImageEditor.ts` differs between skipwash-latest and admin-v2 only in
semicolons. These are copies drifting in parallel, which is the whole case for extraction:
a fix landed in one fork does not reach the other three, and nobody can tell from inside a
fork which of the four is currently correct.

The other frontends contribute nothing. `tree-select` is a vendored clone of the open
source `rc-tree-select`. `sqlbuilder-tool` is a React 17 CRA one-off. `teb` is a Playwright
CLI. `AI/site` is Docusaurus. `skipwash-latest/skipwash-apps` is static HTML.
`bsh-automatized/admin-console` is Next.js with a separate design language and no overlap.

## Ranked candidates

Ranked by value, which here means duplicated volume divided by extraction cost, with a
tiebreak for anything that unblocks another item.

| # | Package                | Source                                            |   LOC | Apps | Plan                                                                                |
| - | ---------------------- | ------------------------------------------------- | ----: | :--: | ----------------------------------------------------------------------------------- |
| 1 | `@bohar/image-editor`  | `components/ImageEditor/`                         |   817 |  4   | [plan](../superpowers/plans/open/2026-08-28-image-editor-package.md)                  |
| 2 | `@bohar/admin-ui`      | dialogs, `PageHeader`, `Loader`, truncation, pager | ~1000 |  4   | [plan](../superpowers/plans/open/2026-08-28-admin-ui-kit-package.md)                  |
| 3 | `@bohar/form`          | `components/form/` + `hooks/form.tsx`             |  2640 |  4   | [plan](../superpowers/plans/open/2026-08-28-form-kit-package.md)                      |
| 4 | `@bohar/api-client`    | `lib/axios`, `lib/auth`, `lib/react-query`, perms |  1200 | 2-4  | [plan](../superpowers/plans/open/2026-08-28-api-client-package.md)                    |
| 5 | `@bohar/admin-shell`   | `components/layouts/` + sidebar context           |  1120 |  4   | [plan](../superpowers/plans/open/2026-08-28-admin-shell-package.md)                   |

Order matters in one place only: `@bohar/admin-ui` before `@bohar/form`, because
`CancelButton` renders `UnsavedChangesDialog`. Everything else is independent.

### 1. `@bohar/image-editor`

Crop, zoom, rotate, flip over `react-easy-crop`, in a MUI dialog. Four files, one
app-level import in the whole directory (`useTranslation`), no domain types, no API calls.
`types.ts` already accepts `title`, `applyLabel`, `cancelLabel` and `changeImageLabel` as
props, so half the decoupling is done.

This goes first because it is the cheapest thing that exercises the whole pipeline a second
time: new package directory, Vite lib build, Storybook pickup, changeset, README. Whatever
is wrong with the pipeline shows up here for 817 lines instead of for 2,640.

### 2. `@bohar/admin-ui`

`ConfirmDialog`, `UnsavedChangesDialog`, `DeletionErrorDialog`, `SignOutDialog`,
`WelcomeDialog`, `PageHeader`, `TruncatedTextWithTooltip`, `ListPagination`, and a
de-branded `Loader`. Individually trivial, collectively a thousand duplicated lines, and
five separate packages for five dialogs would be worse than one.

Two things change on the way in. `Loader` currently imports two Skipwash SVGs and renders
the word "Skipwash", so it becomes a `BrandedLoader` that takes a logo node and a label.
`TruncatedTextWithTooltip` reads a `NAME_TOOLTIP_TRUNCATE_LENGTH` constant from the app,
which becomes a defaulted prop.

### 3. `@bohar/form`

The largest duplicated block after the table. TanStack Form plus MUI: `TextField`,
`TextArea`, `Select`, `Checkbox`, `PasswordField`, `PhoneField`, `DateField`, `TimeField`,
`TimePickerField`, `FormError`, `ErrorMessages`, `InfoTooltip`, `CancelButton`,
`SubscribeButton`, and the `createFormHook` wiring.

The reason to publish rather than copy a fifth time is `lazyField`: it wraps the heavy
fields in `lazy()` + `Suspense` so registering every field in one shared `useAppForm` does
not pull `@mui/x-date-pickers`, `mui-tel-input` and Google Maps into a login screen that
renders two text inputs. That is a library-shaped idea, and it is currently a file in an
app.

Four fields stay behind: `AddressField`, `LocationSearchField`, `BuildingSelectField` and
`ScheduleField` carry `@/types/vendor`, `@/types/location`, `@/utils/scheduleTime` and
`@/hooks/useLocationApi` between them. `AddressField` and `LocationSearchField` could
return later behind a `@bohar/form/maps` subpath; `BuildingSelectField` is domain and never
will.

### 4. `@bohar/api-client`

`lib/axios` (414), `lib/auth/token-service` (461), `lib/react-query` (158) and the pure
permission predicates (164). The token service is the part worth publishing: a cross-tab
Web Lock, a session generation counter so a refresh that lands after logout cannot
resurrect a dead session, a transient-failure backoff so an outage produces one refresh
POST instead of one per request, and a two-attempt 401 replay budget. That is a year of
bugs encoded, sitting in an app directory in two of the four forks.

This one carries the only real precondition in the set. The package encodes a backend
contract: the `{success, data, message}` envelope, the flat-body fallback in
`unwrapResponse`, the `x-tenant-id` header, the `ErrorCode` mapping, and the shape of the
refresh endpoint. Confirm skipwash-api and smarthip-backend agree on that envelope before
starting. If they do not, the useful package is smaller: the token service and the
permission predicates, without `api`.

`error.ts` also reaches for `i18next` directly and hardcodes a `HOLIDAY_` prefix to
namespace backend error keys. Both leave with it: a message resolver goes in the config.

### 5. `@bohar/admin-shell`

`AuthLayout`, `ProtectedLayout`, `MainLayout`, `Header`, `Sidebar`, `MenuContent`, and the
sidebar open/collapsed context that persists to localStorage. Duplicated in all four apps
and the piece that makes a new admin app look like the others on day one.

Also the most inverted. `ProtectedLayout` alone reaches for `@tanstack/react-router`,
`useAuth`, `useNotificationStream`, `usePushNotification`, `NotificationBanner`, `ROUTES`
and `resolveLoginRedirect`. The publishable thing is a slot-based shell that knows about
widths, breakpoints, the mini-drawer transition and scroll restoration, and knows nothing
about routing or auth. It is last because it is design work, not a port, and because
`@bohar/admin-ui` supplies pieces it renders.

## Deferred, with reasons

Each has a proposal next to this file saying what would change the answer.

| Candidate                                | LOC   | Apps | Why not now                                                     |
| ---------------------------------------- | ----- | :--: | ---------------------------------------------------------------- |
| [`sse-client`](sse-client.md)            | 143   |  1   | Good code, one consumer. No reuse proof yet                      |
| [`excel-export`](excel-export.md)        | 67    |  1   | Belongs inside the table's export feature, not beside it         |
| [`directions-map`](directions-map.md)    | 1099  |  1   | Shaped around stop/schedule domain types                         |
| [`notifications`](notifications.md)      | ~1800 |  4   | Duplicated, but fused to domain types. Large generic redesign    |

`lib/pwa` (64 loc), `lib/zod` (53), `lib/toast` and `lib/firebase` (99) are below the size
where a package pays for its own README, versioning and peer matrix. If several of them are
wanted at once, one `@bohar/web-utils` is the shape to consider, not four packages.

## Rules every extraction follows

These come from [`../../CLAUDE.md`](../../CLAUDE.md) and are repeated in each plan's global
constraints, because the plans are read one at a time.

- No `@/…` imports survive. Whatever an app supplied becomes a prop, an option or an
  adapter.
- No hardcoded user-facing string. The house pattern is the one `@bohar/datatable` uses: a
  `Labels` interface, a `DEFAULT_LABELS` constant in English, a `labels?: Partial<Labels>`
  prop, and a context whose default value is `DEFAULT_LABELS` so a leaf rendered outside a
  provider still reads real strings.
- No hardcoded colour. Theme tokens only.
- Anything the consumer also holds an instance of is a peer dependency, listed again in
  `devDependencies` as `catalog:`.
- No barrel imports of icon packs.
- Never `any`, `@ts-ignore`, `@ts-expect-error`, or `as unknown as`.
- `"private": true` until the package is genuinely ready. See
  [`../decisions/open-questions.md`](../decisions/open-questions.md).
