# `@vt-labs/form`: next features

Approved 2026-11-26, with the mocks, for building. Each item becomes a task-by-task plan in `docs/superpowers/plans/open/`
when picked up. Item numbers match [`../../packages/form/roadmap.md`](../../packages/form/roadmap.md);
all four came from a consuming admin app (2026-10-26).

## Answers to the open questions (2026-11-26)

| #   | Question                        | Answer                                                                                                    |
| --- | ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 2   | Does `step` limit decimals      | No: it drives the arrow keys and `aria` only; the schema validates                                        |
| 1   | Invalid entries                 | Stay visible as error chips (as mocked), stay out of the value, and the field reports an error            |
| 3   | Photo editing                   | The `onEdit` callback (as mocked); no subpath, no new peer                                                |
| 3   | Drag and drop                   | Yes (the mock says "or drop it here")                                                                     |
| 4   | Submit and cancel follow `size` | Yes, when set on `FormConfigProvider`                                                                     |
| any | A question not answered here    | Take the option that adds no breaking change and the least public surface, and say which in the changeset |

## Recommended order

| Order | #   | Feature                             | Size | Bump  | Depends on                  |
| :---: | --- | ----------------------------------- | :--: | ----- | --------------------------- |
|   1   | 2   | Number field: unit, min, max, step  |  S   | minor | nothing                     |
|   2   | 4   | A size option for denser forms      |  S   | minor | nothing                     |
|   3   | 1   | A field for a list of whole numbers |  M   | minor | 2 (bounds and unit)         |
|   4   | 3   | File or photo field                 |  L   | minor | 4 (size); image-editor hook |

---

## 1. Number field with a unit, a minimum, a maximum and a step (#2)

**Goal:** the user sees the unit and the range while typing, not after a failed submit.

**Proposed API**

```ts
interface NumberFieldProps extends CommonFieldProps {
  unit?: string; // rendered as an end adornment; the consumer translates it
  min?: number;
  max?: number;
  step?: number; // default 1
}
// labels: numberRange(min, max) => 'Between 5 and 120', numberMin, numberMax
```

**Behaviour**

- `unit` renders as an `InputAdornment` at the end.
- `aria-valuemin` and `aria-valuemax` on the input; a helper line from `labels` when no
  `description` is set.
- `ArrowUp` and `ArrowDown` step by `step` and stop at the bounds.
- Typing is never clamped. The schema stays the one place a value is rejected.

**Tests/stories**

- Unit: arrow keys step and stop at bounds; typed values past a bound are kept; ARIA values
  present.
- Story "Number with unit and range"; `play` presses `ArrowUp` past `max`, asserts it stops,
  types past it, asserts the schema error on blur.

**Changeset:** minor, new optional props and labels.

**Open questions**

- Does `step` also limit the decimals a user may type (step 0.5 allows one decimal)?

## 2. A size option for denser forms (#4)

**Goal:** small fields in side panels and dialogs without a theme override.

**Proposed API**

```ts
interface CommonFieldProps {
  size?: 'small' | 'medium';
}

<FormConfigProvider size="small">…</FormConfigProvider>
```

**Behaviour**

- The field's `size` wins over the provider's; the provider's wins over MUI's default.
- Passed to the MUI input on every field, pickers and phone included.
- Label, helper text and `InfoTooltip` spacing checked at `small`.

**Tests/stories**

- Unit: precedence field > provider > default, per field family.
- Story "Dense form" in a 360px panel; `play` asserts every input has the small class.
  Visual check in light and dark.

**Changeset:** minor.

**Open questions**

- Should `SubmitButton` and `CancelButton` follow the form-wide size too?

## 3. A field for a list of whole numbers (#1)

**Goal:** edit settings like "15, 30, 60 minutes" as one field holding `number[]`.

**Proposed API**

```ts
interface IntegerListFieldProps extends CommonFieldProps {
  min?: number; // per entry, as in NumberField
  max?: number;
  unit?: string;
  allowDuplicates?: boolean; // default false
  sorted?: boolean; // default false: keep entry order
}
// labels: integerListInvalid(entry), integerListDuplicate(entry), integerListOutOfRange
```

**Behaviour**

- Value is always `number[]`, never strings.
- Comma, `Enter` or blur commits the typed entry as a chip; `Backspace` on empty removes
  the last chip.
- An entry that is not a whole number, or is out of range, stays as an error chip with a
  message; the field is invalid until it is fixed or removed.
- `sorted` reorders on commit; `allowDuplicates: false` marks a repeat as an error chip.

**Tests/stories**

- Unit: commit keys; paste of "15, 30,x, 60" gives three chips and one error chip; duplicates;
  sorting; value shape.
- Story "Reminder offsets"; `play` types and commits entries, asserts the chip list and the
  form value.

**Changeset:** minor, a new field export.

**Open questions**

- Error chips: should they also block the form value (value excludes them) or only mark the
  field invalid?

## 4. File or photo field (#3)

**Goal:** a form-native file input with preview, checks and errors; upload stays the
consumer's job.

**Proposed API**

```ts
interface FileFieldProps extends CommonFieldProps {
  variant?: 'file' | 'photo';
  accept?: string;
  maxBytes?: number;
  multiple?: boolean;
  /** Photo variant: open an editor before the file is kept. */
  onEdit?: (file: File) => Promise<File | null>;
}
// value: File | File[] | null
// labels: chooseFile, choosePhoto, removeFile, fileTooLarge(max), fileWrongType, edit
```

**Behaviour**

- `file`: a drop zone plus button; chosen files listed with name, size and a remove action.
- `photo`: a thumbnail preview with replace, edit (when `onEdit` is set) and remove.
- `accept` and `maxBytes` checked on choose; rejections shown from `labels`.
- `onEdit` is the hook point for `@vt-labs/image-editor`, so form takes no peer on it.

**Tests/stories**

- Unit: type and size rejections; multiple; remove; `onEdit` returning `null` keeps the
  original.
- Story "Photo field with image editor"; `play` uploads a fixture, asserts the preview,
  removes it, asserts `null`.

**Changeset:** minor, a new field export.

**Open questions**

- `onEdit` hook (no dependency) or a `@vt-labs/form/photo` subpath that takes image-editor as
  an optional peer, per [decision 0009](../../decisions/0009-optional-peers-get-a-subpath.md)?
  The hook is smaller and keeps any editor pluggable.
- Do we need drag-and-drop in the first version?
