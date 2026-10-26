# Form roadmap

This is the feature backlog for `@vt-labs/form`. Where it stands next to everything else in
the repo is on [`../../roadmap.md`](../../roadmap.md). What the package is and why it is
shaped this way is in the
[design](../../superpowers/specs/2026-09-29-form-package-design.md); this file holds only
what comes after it.

Candidate features, each saying what exists today so the estimate reflects the real
remaining work. Items with `app` in the Source column came from a consuming admin app that
asked for them while building on the published package (2026-10-26).

## Status

| #   | Feature                             | Source | Status   |
| --- | ----------------------------------- | ------ | -------- |
| 1   | A field for a list of whole numbers | app    | proposed |
| 2   | Number field: unit, min, max, step  | app    | proposed |
| 3   | File or photo field                 | app    | proposed |
| 4   | A size option for denser forms      | app    | proposed |

---

## 1. A field for a list of whole numbers

One field whose value is `number[]`, entered as chips or as a comma-separated list, each
entry a whole number.

**Why it matters:** a consuming app edits settings such as reminder offsets ("15, 30, 60
minutes") that are a list of integers. Without a field for it, the app either renders
several `NumberField`s with its own add and remove buttons, or parses a `TextField` by hand
and maps the errors back itself.

**What exists:** `NumberField` (one number, `allowDecimals`) and `MultiSelectField` (chips,
but over a fixed option list). `useFieldBinding` and `FieldShell` are exported, so the field
can be built from the same parts.

**What is missing:** the field itself. Settle three things in the design: how an entry that
is not a whole number is shown (kept as an invalid chip with an error, not silently
dropped), whether duplicates and order matter (an option each), and whether the per-entry
bounds from item 2 apply to every entry. The value is always `number[]`, never strings.

## 2. Number field with a unit, a minimum, a maximum and a step

**Why it matters:** a consuming app has numeric settings measured in minutes, hours or
percent, each with a range. Today the unit lives in the label ("Grace period (minutes)")
and the range is checked only by the form's schema, so the user learns the limit after
typing past it.

**What exists:** `NumberField` takes `decimalSeparator`, `allowDecimals` and
`placeholder`. It has no `min`, `max`, `step` or adornment.

**What is missing:** `unit?: string` rendered as an end adornment (a prop, so the consumer
translates it), and `min`, `max` and `step`. Bounds should be shown and announced
(`aria-valuemin`, `aria-valuemax`, a helper line from `labels`) and used by arrow-key
stepping; they should not clamp what the user types, since the schema stays the one place a
value is rejected. Decide whether `step` also limits the decimals a user may type.

## 3. File or photo field

A field that takes one file (or several), shows what was chosen, and holds a `File` value,
with a photo variant that previews the image.

**Why it matters:** a consuming app has forms that carry an image beside ordinary fields.
Out of the form package, each app builds its own input, preview, size and type checks, and
error display.

**What exists:** nothing. File upload was declared out of scope for the first version in the
design. `@vt-labs/image-editor` returns a `File` from its dialog and could be what the photo
variant opens to crop or rotate.

**What is missing:** the field, with `accept`, `maxBytes`, `multiple`, a remove action, and
errors from `labels`. Two design questions first: whether the photo variant takes
`@vt-labs/image-editor` as an optional peer (a subpath entry, per decision 0009) or only
exposes a hook point for any editor, and whether upload itself stays the consumer's job
(the field holds a `File`, the consumer sends it). The second should be yes.

## 4. A size option for denser forms

**Why it matters:** a consuming app puts forms in side panels and dialogs where MUI's
default field height wastes space. The design says field size follows the theme's MUI
defaults, so today the only way to get small fields is a theme override that changes every
`TextField` in the app, not just the forms that want it.

**What exists:** none of the fields take `size`; each renders MUI's default.

**What is missing:** `size?: 'small' | 'medium'` on `CommonFieldProps`, passed to the MUI
input, and a form-wide default through `FormConfigProvider` so a dense form does not repeat
it on every field. Check the label, helper text and `InfoTooltip` spacing at `small`.
