# @vt-labs/image-editor

## 0.1.0-next.0

### Minor Changes

- 5da4a0a: First version of `@vt-labs/image-editor`: a MUI dialog that crops, zooms, rotates and flips an image and returns a `File` that fits your output rules (type, quality, maximum dimensions and a byte budget it meets by lowering quality, then size). Straighten, brightness, contrast and saturation with presets, undo and redo, and a Replace button are on too; every tool can be switched off through `features`. It takes a File, Blob or URL, or shows its own picker; it goes full screen with a floating toolbar on small screens; every string is a label. cropperjs 2 is a peer and loads only when the dialog opens.
