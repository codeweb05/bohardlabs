---
'@vt-labs/datatable': minor
---

Cards in the phone layout can now open a row on a tap and do nothing else. Set `cardTapAction: 'open'` and a tap calls `onRowClick` without also selecting or expanding the row; selection stays on the card's checkbox, expansion on its chevron button, and a chevron on the right of the card shows that it opens. The default stays `'select'`, so a tap behaves as it always has. The next major makes `'open'` the default whenever `onRowClick` is set.

Cards can also be reached from the keyboard, whichever mode is set. A card with `onRowClick` or a selection checkbox is a tab stop named by its title, with a focus ring in the theme's primary colour: Enter calls `onRowClick` and Space toggles the selection. A card with neither stays out of the tab order. A card drawn by `renderMobileCard` is your own and ignores the new prop. No new labels.
