# `@vt-labs/image-editor` design

**Date:** 2026-09-30. **Status:** in review. **Plan:** not written yet. **Replaces:** the
image-editor section of [`../../extraction/README.md`](../../extraction/README.md) as the
argument for this package, and the
[2026-08-28 image-editor plan](../plans/open/2026-08-28-image-editor-package.md) as the way
to build it.

## Who it is for

Any React and MUI app that lets a user pick an image and hand a cropped, sized file to an
upload call. It has no specific consumer. Promptiva's avatar upload (JPEG, PNG or WebP, 5 MB
cap, sent as a `File`) is the first likely one and the case the defaults are checked
against. The skipwash apps keep their own copies
([decision 0008](../../decisions/0008-target-consumers.md)); their editor is reference
material.

Success looks like this: an avatar upload is one component with four props, the file it
produces always passes the server's type and size rules, and turning on every feature still
gives a screen a first-time user understands.

## What skipwash had, and what changes

Skipwash's `components/ImageEditor/` (817 lines, `react-easy-crop`) has fixed-ratio crop,
zoom from 1 to 3, 90° rotation, a free rotation slider from -180° to 180°, horizontal and
vertical flip, reset, "change image", and Blob or base64 output capped by width, height,
quality and type. Everything here keeps that set and changes the following:

| Skipwash                                                                                                                                     | This package                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Flip is a CSS transform in the preview but applied after the crop on export, so an off-centre crop on a flipped image saves the wrong region | One engine does preview and export; a story asserts the exported pixels |
| Fixed crop ratio only                                                                                                                        | Free crop with a resizable box, ratio presets, circle                   |
| Output silently capped at 500×500 JPEG                                                                                                       | No cap unless asked; the type follows the source                        |
| No size target                                                                                                                               | `maxBytes`: the file is made to fit, or the editor says it cannot       |
| Re-decodes the image on every apply                                                                                                          | Decoded once per source                                                 |
| Keyboard: none                                                                                                                               | A focusable canvas with its own key map and live announcements          |
| Strings through the app's `useTranslation`                                                                                                   | A `labels` prop with English defaults                                   |

New in v1: straighten (fine rotation within a range), adjustments (brightness, contrast,
saturation, five presets), undo and redo, and a built-in picker.

## The engine: cropperjs 2

Chosen over `react-easy-crop` (no resizable or free crop), `react-image-crop` (no pan or
zoom), `react-advanced-cropper` (unmaintained), filerobot (its own UI on styled-components
and Konva) and Pintura (commercial). A spike on 2026-09-30, since deleted, confirmed in real
Chromium under the axe gate:

- flip is honoured on export: the left half of a red-left, blue-right image exports red, and
  exports blue after `$scale(-1, 1)`;
- a 90° rotation exported with `{width: 300}` gives 300×300;
- `beforeDraw` can set `ctx.filter`, so adjustments are drawn in the same pass;
- a selection with `aspect-ratio` 1 holds its square, and `$addStyles(':host{border-radius:50%}')`
  on the shade and selection shows a circle;
- `theme-color` takes `palette.primary.main`.

It also showed three things to work around, and the design does:

- Its built-in keyboard mode listens on the whole document, deletes the selection on Delete,
  and has no focus or ARIA. It stays off; this package has its own key layer.
- Importing it defines custom elements (`class extends HTMLElement`) at module scope, which
  throws under SSR. It is loaded with a dynamic `import()` the first time the editor opens
  (about 13 KB gzipped).
- `$toCanvas` always returns a rectangle. The circle is clipped here.

cropperjs is a **required peer**. Custom elements live in one global registry, so two copies
in one page collide; the consumer must own the single copy.

## Package structure

One package, one entry point, `"private": true` until the user decides to publish.

| Peer                                   | Range  |
| -------------------------------------- | ------ |
| `react`, `react-dom`                   | `^19`  |
| `@mui/material`, `@mui/icons-material` | `^9`   |
| `@emotion/react`, `@emotion/styled`    | `^11`  |
| `cropperjs`                            | `^2.2` |

Each peer is repeated in `devDependencies` as `catalog:`; `cropperjs` is a new catalog
entry. Icons are deep imports (`@mui/icons-material/RotateRight`).

```
packages/image-editor/src/
├── index.ts          # ImageEditor, its types, DEFAULT_IMAGE_EDITOR_LABELS
├── state/            # reducer, history stack; pure, no DOM
├── engine/           # cropperjs adapter: mount, apply state, read crop, export canvas
├── input/            # source → decoded image + object URL, input rules
├── output/           # canvas → filters → circle → resize → encode → fit → File
├── ui/               # dialog, dock, mobile toolbar, tools, picker, key layer
└── labels.ts         # ImageEditorLabels, defaults, context
```

Each unit is testable alone. `state/` and most of `output/` run under jsdom with fakes;
`engine/` is only exercised in stories, because it needs a real browser.

## Public API

```tsx
<ImageEditor
  open
  source={file} // File | Blob | string (URL) | null
  onClose={() => setOpen(false)}
  onApply={async (result) => upload(result.file)} // {file, width, height, type}
  onError={(error) => log(error.code)} // optional
  features={{crop: {ratios: ['1:1'], shape: 'circle'}, adjust: true, history: true}}
  input={{accept: ['image/jpeg', 'image/png', 'image/webp'], minWidth: 200}}
  output={{type: 'image/webp', maxWidth: 1024, maxBytes: 5 * 1024 * 1024, fileName: 'avatar'}}
  labels={{apply: 'Übernehmen'}}
/>
```

Exports: `ImageEditor`, `DEFAULT_IMAGE_EDITOR_LABELS`, and the types `ImageEditorProps`,
`ImageEditorResult`, `ImageEditorError`, `ImageEditorErrorCode`, `ImageEditorFeatures`,
`ImageEditorInput`, `ImageEditorOutput`, `ImageEditorLabels`, `CropRatio`. No hook in v1.

### Source and the picker

`source` is a `File`, a `Blob` or a URL. With `source={null}` and `open`, the editor shows the
built-in picker instead of the canvas: a drop zone with a "Choose image" button, filtered by
`input.accept`. A picked or dropped file becomes the working source; the `source` prop is not
written back. When `source` changes while open, the new image loads and history resets.

### Features

Every feature is `boolean | options`. `false` removes its controls entirely; `true` uses
the defaults.

| Feature      | Default | Options                                                                                                                                                 |
| ------------ | :-----: | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crop`       |   on    | `ratios`: `('free' \| '1:1' \| '4:3' \| '16:9' \| number)[]`, default `['free', '1:1', '4:3', '16:9']`; `shape`: `'rect' \| 'circle'`, default `'rect'` |
| `zoom`       |   on    | `min`, default 1; `max`, default 3; `slider`, default `false`                                                                                           |
| `rotate`     |   on    | none (90° steps)                                                                                                                                        |
| `flip`       |   on    | `horizontal`, `vertical`, both default `true`                                                                                                           |
| `replace`    |   off   | none                                                                                                                                                    |
| `straighten` |   off   | `range`, default 45 (degrees either way)                                                                                                                |
| `adjust`     |   off   | `brightness`, `contrast`, `saturation`, `presets`, each default `true`                                                                                  |
| `history`    |   off   | none                                                                                                                                                    |

Rules the table does not show:

- The first entry of `ratios` is the starting ratio. One entry means no ratio control.
- `shape: 'circle'` locks the ratio to 1:1 and hides the ratio control.
- `crop: false` makes the crop box the whole image; zoom, rotate and flip still apply.
- Zoom 1 means the image just covers the crop box. Wheel, pinch and the `+`/`-` keys zoom
  whether or not `slider` is on.
- Straightening zooms in just enough that the crop box never shows an empty corner.

### Input rules

`input` is `{accept?, minWidth?, minHeight?, maxBytes?}`, all optional. `accept` defaults to
`['image/jpeg', 'image/png', 'image/webp', 'image/gif']`. A failing source is not shown; the
editor shows the error inline (with the picker, if `replace` is on or the source came from it)
and calls `onError`.

### Output options

`output` is `{type?, quality?, maxWidth?, maxHeight?, maxBytes?, background?, fileName?}`.

| Option                  | Default                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| `type`                  | The source's type if JPEG, PNG or WebP; otherwise PNG. PNG for a circle |
| `quality`               | 0.92 (lossy types only)                                                 |
| `maxWidth`, `maxHeight` | none; the crop's natural size                                           |
| `maxBytes`              | none                                                                    |
| `background`            | `'#ffffff'`, used only where a type without transparency meets a circle |
| `fileName`              | `'image'`; the extension is added from the type actually produced       |

`background` is a colour string for the output file's pixels, not UI, so the rule against
hardcoded colours does not apply to it.

### Result and errors

```ts
interface ImageEditorResult {
  file: File;
  width: number;
  height: number;
  type: string;
}

type ImageEditorErrorCode = 'unsupported-type' | 'too-small' | 'too-large' | 'load-failed' | 'output-too-large';
interface ImageEditorError {
  code: ImageEditorErrorCode;
  cause?: unknown;
}
```

`onApply` may return a promise. While it is pending the controls are disabled and Apply
shows progress. If it resolves the consumer closes the editor through `open`. If it rejects,
the editor stays open with the edits intact, shows `labels.applyFailed`, and Apply can be
pressed again. The rejection is not reported through `onError`; the consumer already has it.

Cancel, Escape and the backdrop call `onClose` without confirmation.

## Data flow

`source` → `input/` validates and decodes it once, creating an object URL where needed →
`engine/` mounts cropperjs on that URL → user edits dispatch actions to the `state/` reducer →
the engine is told the new state and applies it → Apply → `output/` builds the `File` →
`onApply`.

The reducer is the source of truth. Drags, pinches and wheel events inside cropperjs are
read back as actions (`setCrop`, `setZoom`), and the adapter skips re-applying a state it
just reported, so there is no loop.

**State:** quarter turns (0 to 3), straighten angle, flip horizontal and vertical, zoom, the
crop box in image pixels, the active ratio, and brightness, contrast and saturation (each
-100 to 100, 0 neutral). Reset returns to the initial state and is itself undoable.

**History:** every action is one entry, except that a continuous gesture (a drag, a slider
held down, a wheel burst within 300 ms) is one entry committed on release. The stack keeps
50 entries. A new action after an undo drops the redo branch.

### Input

- Object URLs this package creates are revoked when the editor closes, when the source
  changes, and on unmount.
- A URL from another origin must allow CORS, or the canvas is tainted and export fails.
  That is reported as `load-failed`, not thrown.
- The decoded working copy is capped at 4096 px on the long edge, because iOS Safari limits
  canvas memory. This is an internal constant, not an option.
- EXIF orientation is applied by the browser when it decodes; no library is needed.

### Output pipeline

1. **Crop, rotate, flip:** `$toCanvas` on the selection, at the crop's natural size.
2. **Adjustments:** `ctx.filter` set in `beforeDraw`, so they are drawn in the same pass.
3. **Circle:** clip to an ellipse. A type without transparency is filled with `background`
   first.
4. **Resize:** fit inside `maxWidth` and `maxHeight`, never enlarging.
5. **Encode:** `canvas.toBlob(type, quality)`.
6. **Fit to `maxBytes`**, when set and exceeded. For a lossy type, binary-search the quality
   between `quality` and 0.6 (at most six encodes). If that is not enough, or the type is
   lossless, scale the dimensions by `√(maxBytes ÷ size) × 0.95` and repeat. If the long edge
   would fall below 64 px, stop with `output-too-large`. A file over the limit is never
   returned.
7. **Wrap:** `new File([blob], fileName + ext, {type})`, with the dimensions actually used.

A browser that cannot encode the requested type (older Safari with WebP) returns PNG
without saying so. The pipeline checks `blob.type`; on a mismatch it re-encodes as JPEG, or
as PNG when transparency is needed. `result.type` is always what was produced.

## UI and interaction

The layout agreed with the user in the brainstorm (layout-v2):

**Desktop** (at and above the theme's `sm` breakpoint): an MUI `Dialog`, `maxWidth="md"`.
A header with the title, undo, redo and close. The canvas below it. Under the canvas, a
context row for the active tab: on Crop, the ratio control, the straighten ruler, and the
rotate and flip buttons; on Adjust, a grid of Brightness, Contrast, Saturation and Presets,
with the ruler setting the selected value. Then underlined tabs, Crop and Adjust. The
footer: Replace image on the left; Reset, Cancel and Apply on the right.

**Mobile** (below `sm`): the dialog goes full screen. Cancel, the title and Done across the
top. A floating pill toolbar over the canvas (undo, rotate, flip, reset). The context row and
the tabs sit at the bottom. It is the same component tree; only the placement changes.

**Controls hide without leaving gaps.** Without `adjust` there are no tabs; the Crop
controls sit directly in the dock. The ruler appears only with `straighten`, undo and redo
only with `history`, Replace only with `replace`, the zoom slider only with
`zoom.slider`. `adjust` needs canvas `filter` support (Safari 18 and later); where it is
missing, the Adjust tab is hidden, so the saved file never differs from the preview. The
live preview uses a CSS `filter` on the image element.

**Presets** are Original, Vivid, Mono, Warm and Cool. Each is fixed filter values; choosing
one sets the three sliders, and moving a slider afterwards is allowed.

**Theme.** The canvas stays dark under both preview themes, as photo editors do:
`palette.grey[900]` behind the image, `alpha(palette.common.black, 0.55)` for the mask,
`alpha(palette.common.white, 0.4)` for the thirds grid, `palette.primary.main` for the
selection outline and handles. The circle is `$addStyles` on the shade and selection.
Everything else is stock MUI and follows the consumer's theme.

**Components.** `ToggleButtonGroup` for ratios and presets, `IconButton` with an
`aria-label` for every action, `Tabs`, and `Slider` (with marks) for the ruler and the
adjustments. Their keyboard and screen-reader behaviour comes from MUI.

**Key layer.** The canvas wrapper is focusable (`tabIndex={0}`, `role="group"`, an
`aria-label`, and an `aria-describedby` pointing at the key help). Keys act only while it has
focus.

| Key                                | Action                                    |
| ---------------------------------- | ----------------------------------------- |
| Arrows                             | Move the crop box 10 px (1 px with Alt)   |
| Shift + arrows                     | Resize the crop box 10 px (1 px with Alt) |
| `+` / `-`                          | Zoom in or out one step                   |
| `R` / Shift + `R`                  | Rotate 90° right or left                  |
| Ctrl/Cmd + Z, Ctrl/Cmd + Shift + Z | Undo, redo (with `history`)               |

Pixel steps are in screen pixels. A polite live region announces each change ("Rotated
90°", "Crop 400 × 300", "Zoom 150%").

**Labels.** `ImageEditorLabels` holds every string: the title, each action and tool name,
the ratio and preset names, the picker text, the key help, the live-region messages as
functions (`rotated: (degrees: number) => string`), one message per error code, and
`applying` and `applyFailed`. `DEFAULT_IMAGE_EDITOR_LABELS` is English; `labels` is a
`Partial` merged over it and passed down by context, as the other packages do.

## Verification

- **Unit tests** (Vitest, jsdom): every reducer action, reset, history limits and gesture
  grouping; the fit-to-`maxBytes` search against a fake encoder whose size depends on
  quality and dimensions; the encode fallback; input rules; object URL revocation; label
  merging; which controls each feature combination renders.
- **SSR:** rendering `ImageEditor` with `renderToString` (closed and open) does not throw and
  does not load cropperjs.
- **Stories**, each with a `play` function, under the a11y gate and both preview themes:
  Basic, Avatar (circle, 1:1, WebP, 5 MB), Everything enabled, one per feature, Picker and
  Replace, Errors, Custom labels, Mobile (viewport set in the story). The spike's pixel
  checks become permanent: flip plus an off-centre crop exports the right region, rotation
  gives the right size, circle corners are transparent, an adjustment changes the pixels,
  `maxBytes` is respected. Also: keys act only with focus, undo and redo, a rejected
  `onApply` keeps the editor open.
- **Surface lock:** `index.test.ts` lists the exports.
- **Coverage:** 90% lines, branches, functions and statements for `packages/image-editor/**`.
- **Import graph:** a script checks the built `dist/` reaches `cropperjs` only through a
  dynamic `import()` and never imports the `@mui/material` or `@mui/icons-material` barrel.
- **size-limit**, with the budget set at the first measured build plus about 10%.
- **publint** and **attw `--pack`** on the packed package.

## Not in v1

Drawing, text and stickers; several images at once; a headless hook export; data URL output
(a consumer can read one from the `File`); a crop that starts on a detected face; filters
beyond the five presets; HEIC input (browsers do not decode it); a confirmation before
discarding edits; rendering the editor itself on the server.

## Documents this changes

- The 2026-08-28 image-editor plan is marked superseded by this spec, and is deleted when
  the new plan is written.
- The roadmap row for image-editor points here.
- The extraction survey's image-editor section describes `react-easy-crop`; it gains a note
  pointing here when the plan lands.
