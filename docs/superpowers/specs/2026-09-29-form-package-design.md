# `@vt-labs/form` design

**Date:** 2026-09-29. **Status:** approved; amended while planning (see
[Amendments while planning](#amendments-while-planning)). **Plan:**
[2026-09-29 form package](../plans/open/2026-09-29-form-package.md). **Replaces:** the form
section of [`../../extraction/README.md`](../../extraction/README.md) as the argument for
this package, and the 2026-08-28 form-kit plan (deleted) as the way to build it.

## Who it is for

Promptiva's admin web app (`apps/admin-web` and `packages/ui-web` in promptiva-backend) and
projects after it. The skipwash admin apps are in production and stay on their own copies;
their form code is reference material, not a consumer this package has to stay compatible
with. [Decision 0008](../../decisions/0008-target-consumers.md) records that.

Success looks like this: promptiva replaces `packages/ui-web/src/forms` with this package
and no screen changes, and a sign-in page that uses two text fields ships no date picker,
phone library or maps code.

## What both sources already agree on

Promptiva (`feature/GPAP-66-admin-sign-in`) and skipwash both build forms on TanStack Form
1 with `createFormHook`, MUI, and Zod through Standard Schema. This package keeps that
stack. What it changes is everything that tied either copy to one app: hardcoded English,
a single validation catalogue, a dayjs dependency, a dialog from another package, field
names used as DOM ids.

## Scope

Fields, grouped by entry point:

| Entry                   | Fields and helpers                                                                                                                                                                                                                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@vt-labs/form`         | `TextField` (with `multiline`), `TextArea`, `PasswordField`, `NumberField`, `SelectField`, `SearchableSelectField`, `MultiSelectField`, `AsyncAutocompleteField`, `CheckboxField`, `SwitchField`, `RadioGroupField`, `DurationField`; `SubmitButton`, `CancelButton`, `FormError`; `FieldShell` for custom fields |
| `@vt-labs/form/pickers` | `DateField`, `TimePickerField`, `DateRangeField`                                                                                                                                                                                                                                                                  |
| `@vt-labs/form/phone`   | `PhoneField`                                                                                                                                                                                                                                                                                                      |
| `@vt-labs/form/maps`    | `LocationSearchField`, `AddressField`, `createGooglePlacesProvider`                                                                                                                                                                                                                                               |

`TextArea` is `TextField` with `multiline` on and `minRows` defaulted to 3, kept as its own
name because skipwash forms read better with it.

That is parity with skipwash's generic fields (`BuildingSelectField` and `ScheduleField`
are skipwash domain and stay behind) plus radio, switch, multi-select, async autocomplete,
number, date range, and maps rebuilt on Places API (New).

Out of scope for the first version: a timezone-aware `DateTimeField`, a map view with a pin,
file upload, and any parsing of a backend's error response.

## Package structure

One package, four entry points. Each optional peer is reachable from exactly one entry.
[Decision 0009](../../decisions/0009-optional-peers-get-a-subpath.md) makes this the rule
for every package here.

| Entry      | Peers                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| `.`        | `react`, `react-dom` `^19`, `@mui/material` `^9`, `@mui/icons-material` `^9`, `@emotion/*`, `@tanstack/react-form` |
| `/pickers` | adds `@mui/x-date-pickers` `^9` (optional)                                                                         |
| `/phone`   | adds `mui-tel-input` `^11` (optional)                                                                              |
| `/maps`    | nothing; the consumer loads Google's Places library                                                                |

Why not one entry: a root `index.js` that re-exports `DateField` puts
`@mui/x-date-pickers` in the import graph of every consumer. Vite's dependency
pre-bundling, an unbundled Vitest or SSR run, and `tsc` without `skipLibCheck` all fail
when that optional peer is not installed, and a single eager import quietly pulls it into
the main chunk. Why not four packages: no bundle gets smaller, and the extension packages
would peer on the core only to share its context, which is the setup where a mismatched
install produces two contexts.

Build rules that keep it lean:

- One Vite build, one entry per subpath, `preserveModules: true`, so shared internals exist
  once across entries.
- `"sideEffects": false`, and no module does work at import time.
- Deep MUI imports (`@mui/material/TextField`), never the barrel.
- Icons are deep imports (`@mui/icons-material/Visibility`), never the barrel. `@mui/icons-material` `^9` is a peer.
- No date library is imported anywhere. The consumer's `LocalizationProvider` supplies the
  adapter.
- No Google script loader. The consumer loads the Places library.

## Public API

### Composition

The consumer builds their form hook once:

```ts
import {
  createAppForm,
  lazyField,
  TextField,
  PasswordField,
  SelectField,
  SubmitButton,
  CancelButton,
  FormError,
} from '@vt-labs/form';
import {RolePicker} from './role-picker';

const DateField = lazyField(() => import('@vt-labs/form/pickers').then((m) => m.DateField));
const PhoneField = lazyField(() => import('@vt-labs/form/phone').then((m) => m.PhoneField));

export const {useAppForm, withForm, withFieldGroup} = createAppForm({
  fieldComponents: {TextField, PasswordField, SelectField, DateField, PhoneField, RolePicker},
  formComponents: {SubmitButton, CancelButton, FormError},
});
```

- `createAppForm` wraps `createFormHook` and supplies the package's single
  `createFormHookContexts()` pair. A consumer never calls `createFormHookContexts`, and a
  custom field imports `useFieldContext` from `@vt-labs/form`. A test asserts the package
  calls `createFormHookContexts` exactly once.
- `createAppForm` sets a default `onSubmitInvalid` that focuses the first invalid field. A
  form can override it.
- No prebuilt `useAppForm` is exported. One with every field registered is the bloat this
  design removes; one with some fields invites a second hook beside it.
- `lazyField(load)` returns a component that renders `load()` through `lazy` and
  `Suspense`, so registering a heavy field costs a stub until the field renders.
- Every field also renders as a plain child of `<form.AppField>`, without
  `createAppForm`, which is how the tests and stories use them.

### Configuration

```tsx
<FormConfigProvider labels={{cancel: 'Abbrechen'}} formatError={sentenceFor}>
```

- `labels?: Partial<FormLabels>` merges over `DEFAULT_FORM_LABELS` (English). It holds only
  chrome the consumer never passes per field: show and hide password, the tooltip button's
  name, `DurationField`'s hours and minutes captions, `DateRangeField`'s start and end
  captions, cancel, Autocomplete's no options, loading, clear, open and close, the
  options-failed-to-load message, the phone field's country button, and the address
  search box and part labels. Outside a provider the defaults apply, same as
  `@vt-labs/datatable`.
- `formatError?: (issue: StandardSchemaV1Issue) => string` turns a validation issue into
  the sentence shown. Default: `issue.message`. A plain string error is wrapped as an issue
  first. Promptiva passes its existing `sentenceFor`, which keeps its error-code catalogue.

### Field props

`CommonFieldProps`: `label`, `description?`, `required?`, `tooltip?`, `disabled?`,
`autoFocus?`. Labels, placeholders and descriptions are always props. Each field adds its
own on top.

### Server errors

```ts
applyServerErrors(form, {fields: {email: 'Already invited'}, form: 'Could not save'});
```

- Field messages go into TanStack's `onServer` error slot and display like schema errors.
- Keys use TanStack's path syntax (`items[0].name`).
- A field's server error clears on the next edit of that field. TanStack does not do this
  for `onServer` on its own; the shared binding clears it on every `setValue`.
- `form` renders in `<FormError>`.
- Mapping a backend's 422 body to this shape is the consumer's adapter. The package knows
  no response format.

## The field contract

Every field is built on one internal hook, `useFieldBinding`, and one layout, `FieldShell`.

- **Label above the input,** a real `<label htmlFor>`. No floating label.
- **Ids from `useId()`,** not the field name. Two forms on one page with the same field
  name, or an array path, must not produce duplicate or invalid ids.
- **Required:** a visual `*` with `aria-hidden`, and `aria-required` on the input.
- **Tooltip:** a focusable icon button with an accessible name.
- **One helper row** under the input, always reserved so layout does not jump. It shows the
  description or the error. `aria-describedby` points at it; `aria-invalid` is set while an
  error shows.
- **Error visibility:** touched and has errors. `handleSubmit` touches every field, so
  submit reveals all of them. Only the first error shows, through `formatError`.
- **Validation timing** is the form's choice. The README recommends `onBlur` plus
  `onSubmit`.
- **`SubmitButton`** is never disabled for invalidity. It is disabled while submitting,
  with `aria-busy` and an optional `submittingLabel`.
- **`CancelButton`** takes `confirm?: () => Promise<boolean>` and calls it only when the
  form is dirty. The package renders no dialog.
- **Radio groups** render as `fieldset` with a `legend`.
- Colours from theme tokens only. Field size follows the theme's MUI defaults.

## Value types

| Field                                                     | Form value                            | Notes                                                                                                   |
| --------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `TextField`, `TextArea`, `PasswordField`                  | `string`                              |                                                                                                         |
| `NumberField`                                             | `number \| null`                      | Empty is `null`. Text input with `inputMode="decimal"`, `decimalSeparator?` prop (default `.`)          |
| `CheckboxField`, `SwitchField`                            | `boolean`                             |                                                                                                         |
| `SelectField`, `SearchableSelectField`, `RadioGroupField` | `V \| null`                           | `options: Option<V>[]`, `V extends string \| number`. No selection is `null`, never `''`                |
| `MultiSelectField`                                        | `V[]`                                 | Chips. `searchable?` switches to Autocomplete                                                           |
| `AsyncAutocompleteField<T>`                               | `T \| null`, or `T[]` with `multiple` | Holds the item, so an edit screen can show its label before any search                                  |
| `DurationField`                                           | `number \| null` (minutes)            | Hours and minutes selects, `maxHours` (≤ 24), `minuteStep` (default 15). Skipwash called it `TimeField` |
| `DateField`                                               | `'YYYY-MM-DD' \| null`                | A string cannot shift a day across timezones the way a `Date` at midnight does                          |
| `TimePickerField`                                         | `'HH:mm' \| null`                     |                                                                                                         |
| `DateRangeField`                                          | `{start, end}` of date strings        | Two linked `DatePicker`s. MUI's `DateRangePicker` is Pro and not usable here                            |
| `PhoneField`                                              | E.164 string or `null`                | `defaultCountry?`, `preferredCountries?`                                                                |
| `LocationSearchField`                                     | `Place \| null`                       | `{id, label, lat, lng}`                                                                                 |
| `AddressField`                                            | `Address`                             | `{line1, line2, city, region, postalCode, country}`, all strings, every part editable                   |

```ts
interface Option<V extends string | number> {
  value: V;
  label: string;
  disabled?: boolean;
  description?: string;
}
```

`AsyncAutocompleteField` takes `loadOptions(query, {signal})`, `getOptionValue`,
`getOptionLabel`, `debounceMs` (default 300) and `minQueryLength` (default 0). Each new
query aborts the previous request. Loading and failure states render inside the listbox.
It has no TanStack Query dependency; a consumer who wants caching calls
`queryClient.fetchQuery` inside `loadOptions`.

`NumberField` takes no `min`, `max` or `step`: it is a text input, so they would do
nothing, and range rules belong to the schema. It takes `allowDecimals?` (default `true`).

TanStack Form cannot check that the field component matches the value type at its path. In
development builds, a field whose runtime value does not match its declared type logs a
warning naming the field. The README documents the limit.

## The heavy entries

### `/pickers`

The field converts between the string value and the adapter's date type through the
`LocalizationProvider` the consumer mounted. No adapter ships with the package. The test
suite runs every picker test under both the date-fns and dayjs adapters, installed as
devDependencies only.

### `/phone`

Built on `mui-tel-input` 11, which supports MUI 9. No phone validator is exported: a schema importing one pulls
`libphonenumber-js` into every screen that loads the schema. The README shows the consumer
how to add one.

### `/maps`

Google's legacy Places Autocomplete service is not available to projects created since
March 2025, so this entry is written against Places API (New) (`AutocompleteSuggestion`,
`Place.fetchFields`). Skipwash's field is reference only.

The fields depend on an interface, not on Google:

```ts
interface PlacesProvider {
  newSession(): object;
  suggest(query: string, opts: {signal: AbortSignal; session: object}): Promise<readonly PlaceSuggestion[]>;
  resolve(id: string, opts: {session: object}): Promise<ResolvedPlace>; // Place plus its Address
}
```

`createGooglePlacesProvider(placesLibrary)` takes whatever `importLibrary('places')`
returned, however the consumer loaded it. The fields manage one session token per search
session, so a lookup is billed as one session rather than one per keystroke.
`LocationSearchField` is built on the internal Autocomplete behind
`AsyncAutocompleteField`, because it stores a `Place`, not the suggestion picked. Tests and stories use a fake
provider, with no key and no network.

## Verification

- **Unit tests** per field: value and `null` handling, error visibility, `formatError`,
  labels, server-error clearing, focus on invalid submit, stale-request abort.
- **Stories** for every field, each with a `play` function, under the a11y gate and both
  preview themes.
- **Surface lock:** an `index.test.ts` per entry listing its exports.
- **Coverage:** 90% lines, branches, functions and statements for `packages/form/**`, set as
  a per-glob threshold in the root `vitest.config.ts`.
- **Import graph:** a script walks the built `dist/` from each entry and fails if the root
  reaches `@mui/x-date-pickers` or `mui-tel-input`, if any `.d.ts` mentions `google.maps`, if a subpath reaches
  another subpath's peer, or if any file imports the `@mui/material` or
  `@mui/icons-material` barrel.
- **Consumer fixture:** `packages/form/fixtures/consumer`, a Vite app with a sign-in form
  and a lazily registered `DateField`. A script builds it and asserts the entry chunk holds no
  picker modules and the pickers land in their own chunk.
- **size-limit** per entry. Budgets are the first measured build plus about 10%.
- **publint** and **attw `--pack`** on the packed package.

## Documents this changes

- [Decision 0008](../../decisions/0008-target-consumers.md): the packages are for promptiva
  and future projects; skipwash does not adopt them.
- [Decision 0009](../../decisions/0009-optional-peers-get-a-subpath.md): an optional heavy
  peer gets its own subpath entry.
- The extraction survey gains a note pointing at 0008.
- The 2026-08-28 form-kit plan is marked superseded by this spec, and is deleted when the
  new plan is written.
- The roadmap: the form row points here, is no longer blocked on admin-ui, and the
  "skipwash-admin switches to the package" row goes. Open question B gains a note that the
  session and api-client spec revisits it.

Outside this repo: promptiva's decision D-27 and `.claude/rules/admin-web.md` name this
library `@bohardlabs/*`. That is theirs to update.

## Amendments while planning

Found while writing the plan, and already applied above.

- **MUI 9 only.** MUI 7 is dropped. MUI 9 moved Autocomplete's input props to
  `params.slotProps.htmlInput`, so one field body cannot serve both; `@mui/x-date-pickers` 9
  and `mui-tel-input` 11 need MUI 9 anyway. Peers: `@mui/material ^9`,
  `@mui/x-date-pickers ^9`, `mui-tel-input ^11`.
- **No `@types/google.maps` peer.** The package describes the few Places members it calls
  with its own `GooglePlaces` interface, and a type test checks that Google's real type still
  fits it.
- **`formatError` takes an issue only.** Strings are wrapped as issues before it runs.
- **Labels.** The required indicator's name is gone (the `*` is `aria-hidden` and the input
  carries `aria-required`). The phone field's country search text became `selectCountry`,
  the name of the flag button. Added: `moreInfo`, `rangeStart`, `rangeEnd` and the address
  labels. The defaults are `DEFAULT_FORM_LABELS`.
- **`NumberField`** has no `min`, `max` or `step`.
- **Server-error clearing** happens in the shared binding's `setValue`.
- **`PlacesProvider`** gained `newSession()`, the session is an `object` so it can go to
  Google without a cast, and `resolve` returns a `ResolvedPlace`. `Address` lost its
  optional `lat`, `lng` and `placeId`; `LocationSearchField` is the field for a point.
- **Import graph and consumer fixture** are scripts in a `verify` task after the build,
  not Vitest tests, because both need `dist/`.

## After this spec

The first real consumer is promptiva swapping `ui-web/forms` for this package. That is a
follow-up in their repo, done on request, and the test of whether this API is right.
