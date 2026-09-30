# Migrating an app form to @vt-labs/form

Internal note for teams moving an existing app form (skipwash-admin, promptiva) onto the
package; not for the public README. The package covers the generic fields in
skipwash-admin's `components/form`. What changes when you move a form over:

- **`SubscribeButton` is `SubmitButton`, and its text is children.** There is no `label`
  prop. `label` and `loadingLabel` become `<form.SubmitButton submittingLabel="Saving…">Save</form.SubmitButton>`.
  It has no `disabled` prop and no spinner.
- **Query by label, not by id or name.** Ids come from `useId`, never from the field name,
  so a test or a CSS selector written as `#email` matches nothing. No field renders a `name`
  attribute either (the old `Select` set one), so `[name="email"]` goes too. In tests use `getByLabelText('Email')` or `getByRole('combobox', {name: /Team/})`.
- **`createAppForm` replaces `createFormHook`.** The package owns the field and form
  contexts. A custom field reads `useFieldContext` from `@vt-labs/form`, not from the app's
  `form-context`, or it will not find its field.
- **Empty is `null`.** `Select`, `DateField` and `TimePickerField` stored `''` for nothing
  chosen; their replacements store `null`. `PhoneField` stored the formatted text
  (`+49 30 123456`); it now stores E.164 (`+4930123456`) or `null`.
- **Renamed fields and props.** `Select` is `SelectField` with `options` for `values`;
  `Checkbox` is `CheckboxField`; `TimeField` is `DurationField` (minutes, `maxHours` and
  `minuteStep` kept). `helperText` is `description`. `DateField`'s `minDate` and `maxDate`
  are `'YYYY-MM-DD'` strings, not Dayjs, and `shouldDisableDate` is gone.
- **`TextField type="number"` is `NumberField`.** It stores `number | null`. `htmlInputProps`
  is gone; `NumberField` takes `decimalSeparator` and `allowDecimals` instead. `maxLength` and
  `autoComplete` are `TextField` props, not `NumberField` props.
- **`SearchableSelect` was a controlled component outside the form.** `SearchableSelectField`
  is bound to the form and filters its `options` locally. For server search, use
  `AsyncAutocompleteField`.
- **`FormError` shows only server errors**, set by `applyServerErrors`. It no longer reads
  the `form` message of an `onSubmit` validator, and it has no close button.
- **`CancelButton` renders no dialog.** It is never disabled; on a pristine form it calls
  `onCancel` at once, and on a dirty one it awaits your `confirm()` first. `hasChanges` and
  `disabled` are gone.
- **The maps fields take a `provider`** instead of `onSearch`, and render no map.
- **Not here:** `Schedule` and `BuildingSelectField` stay in the app.
