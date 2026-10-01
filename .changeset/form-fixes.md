---
'@vt-labs/form': patch
---

Fixes found by a critical pass over the fields. No prop or default changed.

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
