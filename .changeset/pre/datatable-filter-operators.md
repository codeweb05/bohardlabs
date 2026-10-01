---
'@vt-labs/datatable': minor
---

`useServerSidePagination` sends each column filter with the operator its control means.
Every filter used to go out as `contains`, including a dropdown, a yes/no and a range.

- Pass the table's `columns` to the hook and the operator follows each column's
  `filterConfig.type`: `contains` for text, `equals` for a dropdown or a yes/no, `in` for a
  list of dropdown values, `between` for a number or date range, `equals` for a single
  number or day.
- New `filterConfig.operator` sets the operator for one column, for a server that wants
  something else (`startsWith` for a reference number).
- Without `columns` the operator is read off the value: a yes/no and a number are `equals`,
  a range is `between`, a list is `in`. Text stays `contains`, and so does a dropdown, which
  the hook cannot tell from text until it has the columns.
- `FilterOperator` gains `'in'`.

If your server already accepted `contains` for a yes/no or a range filter, it now receives
`equals` or `between` for those.
