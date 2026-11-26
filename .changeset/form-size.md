---
'@vt-labs/form': minor
---

Every field takes `size: 'small' | 'medium'`, and `FormConfigProvider` takes a `size` that every field below it follows, along with `SubmitButton` and `CancelButton`. A field's own `size` wins; with neither, MUI's default applies as before.
