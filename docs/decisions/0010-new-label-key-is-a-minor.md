# 0010. A new `DataTableLabels` key is a minor

**Status:** decided, 2026-11-27.

## Context

Every user-facing string in `@vt-labs/datatable` comes from `DataTableLabels`, and new
features keep adding keys to it. The `labels` prop takes `Partial<DataTableLabels>` and is
merged over `DEFAULT_LABELS`, so a consumer who passes the prop gets the English default
for any key they did not set. Their build and their render are unaffected.

A consumer who annotates their own object as a complete `DataTableLabels` (to make sure a
translation misses nothing) gets a type error when a key is added. Treating that as breaking
would make every new string a major, which is the opposite of what such a consumer wants:
the error is the reminder to translate the new text.

The question first came up with `labels.sortBy` and `labels.selectRow` (e0dae7f), which
shipped in a minor and said so in the changelog, and again with the filter chips' six keys.

## Decision

Adding a key to `DataTableLabels` is a minor. The changeset names the new keys and says
that an object typed as a complete `DataTableLabels` has to add them.

Widening `FilterOperator` follows the same rule. `labels.filterOperator` takes it, so a
translation written as a full `Record` over the operators needs the new member, and that is
a minor too.

## What follows

- A consumer who wants the compiler to flag every new string types their object as
  `DataTableLabels` and takes the new keys at minors. One who does not types it as
  `Partial<DataTableLabels>` and gets the English default until they translate it.
- The JSDoc on `labels.filterOperator` says this.
- Removing or renaming a key, or changing a key's signature, is still a major.
