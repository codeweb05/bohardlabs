# `@vt-labs/image-editor`: next features

Draft for discussion. Each item becomes a task-by-task plan in `docs/superpowers/plans/open/`
when picked up. Item numbers match
[`../../packages/image-editor/roadmap.md`](../../packages/image-editor/roadmap.md); both came
from a consuming admin app (2026-10-26).

## Recommended order

| Order | #   | Feature                                        | Size | Bump  | Depends on |
| :---: | --- | ---------------------------------------------- | :--: | ----- | ---------- |
|   1   | 1   | Redo and rotate left in the phone toolbar      |  S   | patch | nothing    |
|   2   | 2   | A notice when the adjust tools are unavailable |  S   | minor | nothing    |

---

## 1. Redo and rotate left in the phone toolbar (#1)

**Goal:** a phone user can redo, and turn an image left in one tap.

**Proposed API:** no public change. `MobileToolbar` is internal; it gains an `onRedo` prop
beside `onUndo`. The labels (`labels.redo`, `labels.rotateLeft`) and actions
(`{type: 'rotate', direction: -1}`) already exist on the desktop layout.

```ts
// internal
interface MobileToolbarProps {
  onRedo: (() => void) | null;
}
```

**Behaviour**

- Pill order: undo, redo, rotate left, rotate right, flip, reset.
- Redo gated by `history`, rotate left by `rotate`, same as their desktop twins.
- At 320px with every tool on, the two flips fold into one "Flip" button that opens a menu
  with horizontal and vertical. Above that width they stay as two buttons.

**Tests/stories**

- Unit: redo disabled with nothing to redo; rotate left dispatches `direction: -1`; flips fold
  below the width threshold.
- Story "Phone toolbar" at a 320px viewport; `play` rotates left, undoes, redoes, asserts the
  preview rotation each step. axe must pass.

**Changeset:** patch. No exported type or label changes; consumers get two buttons on phones.
The Flip menu needs a `labels.flip` key; if that is new, this becomes a minor.

**Open questions**

- Fold the flips by viewport width, or always fold them on phones for a stable layout?

## 2. A notice when the adjust tools are unavailable (#2)

**Goal:** tell the user why the Adjust tab is missing instead of letting it vanish.

**Proposed API**

```ts
interface ImageEditorLabels {
  /** Shown where the Adjust tab would be when the browser cannot apply filters. */
  adjustUnavailable: string; // default "Adjustments aren't available in this browser."
}
```

**Behaviour**

- Shown in the dock, in the Adjust tab's place, only when the consumer enabled `adjust` and
  `supportsCanvasFilter()` returns false.
- An informational, theme-coloured note; not a dismissable error.
- No `onUnsupported` callback yet; nobody has asked.

**Tests/stories**

- Unit: notice shown when adjust is on and filters unsupported; hidden when adjust is off;
  hidden when supported.
- Story "Adjust unavailable" with `supportsCanvasFilter` stubbed false; `play` asserts the
  notice text and that no Adjust tab exists.

**Changeset:** minor. A new key on the exported labels type is public surface.

**Open questions**

- Tooltip on a disabled Adjust tab instead of a notice? A disabled tab is more discoverable
  but harder to read on touch.
