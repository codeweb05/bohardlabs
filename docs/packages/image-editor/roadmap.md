# Image editor roadmap

This is the feature backlog for `@vt-labs/image-editor`. Where it stands next to everything
else in the repo is on [`../../roadmap.md`](../../roadmap.md). What the package is and why
it is shaped this way is in the
[design](../../superpowers/specs/2026-09-30-image-editor-package-design.md); this file holds
only what comes after it.

Candidate features, each saying what exists today so the estimate reflects the real
remaining work. Items with `app` in the Source column came from a consuming admin app that
asked for them while building on the published package (2026-10-26).

## Status

| #   | Feature                                        | Source | Status   |
| --- | ---------------------------------------------- | ------ | -------- |
| 1   | Redo and rotate left in the phone toolbar      | app    | proposed |
| 2   | A notice when the adjust tools are unavailable | app    | proposed |

---

## 1. Redo and rotate left in the phone toolbar

**Why it matters:** below `sm` the floating pill toolbar offers undo, rotate right, flip and
reset. A user on a phone who undoes one step too many cannot redo it from the pill, and has
to rotate right three times to turn an image left.

**What exists:** `MobileToolbar` renders undo (with `history`), rotate right (with
`rotate`), the two flips and reset. Redo and rotate left already exist on the desktop
layout (`HistoryButtons`, `CropControls`), with their labels (`labels.redo`,
`labels.rotateLeft`), icons and actions (`{type: 'rotate', direction: -1}`), and the
keyboard shortcut for redo.

**What is missing:** the two buttons in the pill, under the same `history` and `rotate`
gates, and an `onRedo` prop beside `onUndo`. Check the pill's width at 320px with every tool
on: seven buttons may need the flips folded into one menu.

## 2. A notice when the adjust tools are unavailable

**Why it matters:** where the browser cannot apply a canvas `filter` (Safari before 18),
`EditorSession` hides the Adjust tab so the saved file never differs from the preview. That
is the right call, but the user is told nothing, and a consuming app that enabled `adjust`
gets support questions about a tab that "disappeared".

**What exists:** `supportsCanvasFilter()` in `output/filters.ts`, and the gate in
`EditorSession` that drops `adjust` when it returns false.

**What is missing:** a short notice in the dock where the tabs would be (a new label,
`adjustUnavailable`, English default), shown only when the consumer enabled `adjust` and
the browser cannot honour it. Optionally an `onUnsupported` callback, or a flag on the
editor's result, so the app can log it; nobody has asked for that yet, so leave it out
unless the design needs it.
