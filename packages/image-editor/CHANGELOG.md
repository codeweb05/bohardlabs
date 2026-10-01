# @vt-labs/image-editor

## 0.1.1-next.0

### Patch Changes

- 396621d: Fixes found by a critical pass over the editor. No prop or default changed.

  - The dialog no longer shows a horizontal and a vertical scrollbar. A hidden announcement box
    was as large as the dialog and hung past its edge. In a short window the image area now gives
    up height (down to 240 px) before the dialog scrolls.
  - Dragging a resize handle past the edge of the image stops at the edge. It used to push the
    opposite edge away. A fixed ratio keeps its shape.
  - A re-render of the parent while a handle is being dragged no longer puts the selection back
    where it started.
  - `onApply` and `onError` are not called for an export that finishes after the editor was closed.
  - `open={file !== null} source={file}` no longer flashes the picker while the dialog fades out.
  - A held arrow, `+` or `-` key is one step to undo and one announcement, not one per repeat.
  - The same announcement twice in a row (two flips) is read both times.
  - Undo no longer records a step for a gesture that ended where it began.
  - A `labels` object with an `undefined` value falls back to the English default for that key.
  - A `source` that is taken away and given back loads again, instead of showing an image whose
    working copy was already released.
  - With both a ratio and its reciprocal offered (`'4:3'` and `3 / 4`), the pressed button is the
    one in use.

## 0.1.0

The first stable release, on the `latest` tag. It is `0.1.0-next.0` unchanged.

## 0.1.0-next.0

### Minor Changes

- 5da4a0a: First version of `@vt-labs/image-editor`: a MUI dialog that crops, zooms, rotates and flips an image and returns a `File` that fits your output rules (type, quality, maximum dimensions and a byte budget it meets by lowering quality, then size). Straighten, brightness, contrast and saturation with presets, undo and redo, and a Replace button are on too; every tool can be switched off through `features`. It takes a File, Blob or URL, or shows its own picker; it goes full screen with a floating toolbar on small screens; every string is a label. cropperjs 2 is a peer and loads only when the dialog opens.
