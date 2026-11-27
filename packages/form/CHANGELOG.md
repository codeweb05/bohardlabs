# @vt-labs/form

## 0.2.0

### Minor Changes

- 5651a97: New `FileField` for a file or a photo, held in the form as a `File` (or `File[]` with `multiple`). The user chooses with a button or drops a file on the field. `accept` and `maxBytes` are checked on the way in: a refused file never reaches the value, and the field says why through the new `fileTooLarge` and `fileWrongType` labels. `variant="photo"` shows a square preview with Replace and Remove, and `onEdit` adds an Edit button that hands the current file to your editor (such as `@vt-labs/image-editor`) and keeps the file it resolves, or the original on `null`. The field never uploads; send the file from your submit handler. Other new labels: `chooseFile`, `dropFile`, `replaceFile`, `removeFile`, `choosePhoto`, `editPhoto`, `replacePhoto`, `removePhoto` and `fileSize`. A refused file shows its message without blocking submit, since the value still holds only what was accepted.
- bc8666f: New `IntegerListField` for a list of whole numbers held as `number[]`, such as reminder offsets. Comma, `Enter` or blur commits an entry as a chip, a pasted "15, 30, 60" becomes three chips, and it takes `min`, `max`, `unit`, `allowDuplicates` and `sorted`. An entry that is not a whole number, is out of range or repeats stays on screen as an error chip, is kept out of the value, and blocks submit until it is fixed or removed. New labels: `integerListInvalid`, `integerListDuplicate`, `integerListOutOfRange` and `removeEntry`.
- 4731da2: `NumberField` takes `unit`, `min`, `max` and `step`. The unit shows at the end of the input, the range shows as the helper line when there is no `description` (new `numberRange`, `numberMin` and `numberMax` labels), and the arrow keys step the value and stop at the bounds. Typing is not clamped, so the schema still rejects an out-of-range value. With a bound or a `step` the input's role is `spinbutton`; without one it stays a `textbox`, as before.
- 32c2e74: Every field takes `size: 'small' | 'medium'`, and `FormConfigProvider` takes a `size` that every field below it follows, along with `SubmitButton` and `CancelButton`. A field's own `size` wins; with neither, MUI's default applies as before.

## 0.1.1

### Patch Changes

- 56c5ae4: Fixes found by a critical pass over the fields. No prop or default changed.

  - `SearchableSelectField` and `MultiSelectField` keep the text being typed when the parent
    re-renders with an `options` array built inline. The search box used to clear itself.
  - Focus after a failed submit skips an invalid field that is disabled or hidden and lands on
    the next one that can take it.
  - `CancelButton` asks its `confirm` once when clicked twice, and treats a `confirm` that
    rejects as "stay".
  - Async fields do not call `loadOptions` for a query that is only spaces.
  - An empty `description` keeps the helper line's height, so the field does not jump.
  - `AddressField` clears a server error on the address as soon as one of its parts is edited.
  - `LocationSearchField` and `AddressField`: typing after picking a place no longer has the
    typed text overwritten when the place lookup comes back.

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
