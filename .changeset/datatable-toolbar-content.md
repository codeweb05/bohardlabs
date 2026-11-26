---
'@vt-labs/datatable': minor
---

New `toolbarContent` prop: put your own controls in the toolbar, right after the search box. The table renders them as given and holds none of their state, so a status menu that drives your own query param works without touching the table's filters. `showToolbar={false}` hides them with the rest of the toolbar.
