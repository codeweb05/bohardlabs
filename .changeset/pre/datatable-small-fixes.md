---
'@vt-labs/datatable': patch
---

Four small fixes. No prop, export or label key changed.

- A bulk action whose `onClick` rejects is logged and the selection is kept, so the same
  rows can be tried again. It used to leave an unhandled promise rejection.
- `filterConfig.min` and `max` hold a number filter to those limits. A number typed past
  one is filtered as the limit, and the box shows the limit once it is left. `max` used to
  do nothing, and `min` only decided whether a minus sign could be typed.
- The column menu casts the shadow the theme gives any other popover (`shadows[8]`). It
  had two fixed shadows of its own, one for light and one for dark, so it ignored a theme's
  `shadows` and did not match the export and density menus beside it. Under the stock MUI
  themes the shadow is a little heavier than before.
- A table with truncating headers, which is the default, renders in a browser with no
  `ResizeObserver`. It used to throw on mount. An export format the menu has no label for
  is listed under its own name, where it was an empty menu item.
