---
'@vt-labs/form': minor
---

`NumberField` takes `unit`, `min`, `max` and `step`. The unit shows at the end of the input, the range shows as the helper line when there is no `description` (new `numberRange`, `numberMin` and `numberMax` labels), and the arrow keys step the value and stop at the bounds. Typing is not clamped, so the schema still rejects an out-of-range value. With a bound or a `step` the input's role is `spinbutton`; without one it stays a `textbox`, as before.
