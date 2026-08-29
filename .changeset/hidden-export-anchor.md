---
'@bohar/datatable': patch
---

Export no longer leaves an unlabelled link in the tab order. The anchor the download
goes through was appended to the page visible and focusable, so for 100ms after every
CSV or JSON export a keyboard user could tab onto a link with no accessible name, and
axe reported a `link-name` violation. It is now hidden.
