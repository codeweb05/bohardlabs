---
'@vt-labs/datatable': minor
---

New prop `enableFilterChips` (default `false`) adds a row under the toolbar that says what is narrowing the list: one chip per active column filter and one for the search. Each chip reads the way the request sends it, with the operator the table infers, which is what `useServerSidePagination` sends: "Status is not Cancelled", "Total between 10 and 50", "Items at least 2", "Placed after 01/11/2026". A select shows the option's label, a yes/no shows `labels.yes` or `labels.no`, and a date is written in `dateFormats.display`. A chip's remove button clears that filter, "Clear all" clears every filter and the search, and both go back to page 1. The search chip has no remove button; the search box clears it. With the prop off, nothing changes.

Six new keys in `labels`: `filterChip(column, operator, value)` (the chip text, so a language can reorder the three parts), `filterOperator(operator)` (the words for each operator, plus `atLeast`, `atMost`, `after` and `before` for a range with one end set), `filterRange(from, to)` ("10 and 50"), `filterSearch(term)`, `removeFilter(chip)` (the remove button's accessible name) and `clearAllFilters` ("Clear all"). A consumer passing a complete `DataTableLabels` object (rather than a `Partial`) has to add them.
