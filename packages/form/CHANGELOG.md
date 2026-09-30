# @vt-labs/form

## 0.1.0

The first stable release, on the `latest` tag. `0.1.0-next.0` was never published; this
version is the same package with these changes on top.

### Minor Changes

- `DurationField` takes an `emptyLabel` prop. When the field is not required, the Hours list
  offers it as a choice that clears the value.

### Patch Changes

- `NumberField` stores `null` for `NaN` and `Infinity`, and `NumberField` and `DurationField`
  show them as empty.
- `NumberField`, `PhoneField` and the date, time and date-range pickers drop a half-typed entry
  on `form.reset()`.
- The pickers keep a typed draft only while it is still the text the user entered, and
  `DateRangeField` reads and writes each end on its own.
- `MultiSelectField` keeps a stored value that is missing from `options` as a chip, lists each
  value once, and keeps a selected value when `options` change.
- `AsyncAutocompleteField` keeps the typed text with `multiple`, and lists the stored item only
  when it matches the query or the query is shorter than `minQueryLength`.
- `SelectField` can select an option whose value is `''`.
- `useAsyncOptions` reports a loader that throws synchronously as a failed load.
- `AddressField` clears server errors on the parts a pick replaces, and a lookup that resolves
  after the field unmounts writes nothing.
- Type declarations no longer point at source files that are not in the package.

## 0.1.0-next.0

### Minor Changes

- 8c1230e: First version of `@vt-labs/form`: MUI fields for TanStack Form. Text, password, number, select, searchable and multi select, radio, checkbox, switch, duration and async autocomplete fields in the main entry, with submit, cancel and form-error components and server-error mapping. Date, time and date-range pickers in `@vt-labs/form/pickers`, a phone field in `@vt-labs/form/phone`, and location and address fields with a Google Places provider in `@vt-labs/form/maps`.
