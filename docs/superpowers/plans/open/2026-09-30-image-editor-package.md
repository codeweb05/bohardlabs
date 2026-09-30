# `@vt-labs/image-editor` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A generic MUI image editor dialog (crop, zoom, rotate, flip, straighten, adjust,
undo) that turns a `File`, `Blob` or URL into a `File` that passes the consumer's upload
rules.

**Architecture:** A pure state layer (geometry, reducer, history) is the source of truth.
cropperjs 2 is only the view and the pointer handler: a thin adapter lays the image and
selection out from state and reports gestures back as actions. Export does not use
`$toCanvas`; it draws from the same state with the same matrix at natural resolution, so the
preview and the file cannot disagree.

**Tech Stack:** React 19, MUI 9, cropperjs 2.2 (dynamic import), Vite 8 lib mode, Vitest 4
(jsdom and Storybook in Chromium).

**Spec:** [`../../specs/2026-09-30-image-editor-package-design.md`](../../specs/2026-09-30-image-editor-package-design.md),
including its "Amendments while planning" section, which this plan introduced.

## Status

| Task | What                                              | State |
| :--: | ------------------------------------------------- | ----- |
|  1   | Scaffold, public types, labels, features, surface | todo  |
|  2   | Geometry                                          | todo  |
|  3   | Editor reducer and history                        | todo  |
|  4   | Input: fetch, validate, decode, cap               | todo  |
|  5   | Output: filters, render, encode, fit, export      | todo  |
|  6   | Engine: loader and `CropperView`                  | todo  |
|  7   | UI shell: dialog, load, apply, errors, picker     | todo  |
|  8   | Crop tools, key layer, live region                | todo  |
|  9   | Adjust, presets, history UI                       | todo  |
|  10  | Mobile layout                                     | todo  |
|  11  | Stories with pixel checks                         | todo  |
|  12  | Verify gate, docs, changeset, close               | todo  |

## Global Constraints

- Package `@vt-labs/image-editor`, `"private": true`, ESM only, one entry (`.`).
- Peers: `react`, `react-dom` `^19.0.0`; `@mui/material`, `@mui/icons-material` `^9.0.0`;
  `@emotion/react`, `@emotion/styled` `^11.14.0`; `cropperjs` `^2.2.0`. Each repeated in
  `devDependencies` as `catalog:`. `cropperjs: ^2.2.0` is a new catalog entry.
- `cropperjs` is reached only through `import('cropperjs')` inside `engine/loadCropper.ts`.
- MUI and icons by deep path (`@mui/material/Button`, `@mui/icons-material/RotateRight`).
- No hardcoded UI string (everything in `ImageEditorLabels`), no hardcoded UI colour (theme
  tokens; `output.background` is file pixels, not UI).
- No `any`, `@ts-ignore`, `@ts-expect-error`, `as unknown as`.
- Working copy capped at 4096 px on the long edge. History limit 50. Wheel gesture commits
  after 300 ms. Default quality 0.92, quality floor 0.6, at most six encodes per size,
  shrink factor `√(maxBytes ÷ size) × 0.95`, 64 px minimum long edge.
- Text: no em-dashes, no filler.
- Commit per task on `feature/image-editor`, conventional commits, scope `image-editor`,
  staged by name.

## Review Focus

1. **A source larger than the cap** (a 6000×4000 phone photo): the crop, the export size and
   the pixels all refer to the 4096 px working copy, never a mix. Test: `loadSource` with a
   fake decoder returns 4096×2731 and `downscale` was called (Task 4).
2. **Rotate after straighten after flip:** the view must show exactly what the user saw
   plus the one change. Test: the mapping of the four frame corners after `flip` then
   `rotate` equals flipping then rotating the mapped points (Task 3).
3. **An encoder that ignores the requested type** (Safari and WebP): `result.type` and the
   file extension follow the blob actually produced. Test: `encodeWithFallback` with a fake
   that always returns PNG (Task 5).
4. **`maxBytes` smaller than any achievable size:** `output-too-large`, never an oversized
   file and never an endless loop. Test: `fitToBytes` with a fake whose size never drops
   under the limit throws after the 64 px floor (Task 5).
5. **Apply pressed twice, or closed while applying:** one export, one `onApply` call.
   Test: double click on Apply calls `onApply` once (Task 7).

## File map

```
packages/image-editor/
├── package.json, tsconfig.json, tsconfig.build.json, vite.config.ts, README.md
├── .size-limit.json, scripts/check-graph.mjs            (Task 12)
└── src/
    ├── index.ts, index.test.ts                          public surface and its lock
    ├── types.ts                                         public types
    ├── labels.ts                                        ImageEditorLabels, defaults
    ├── features.ts                                      resolveFeatures, parseRatio
    ├── errors.ts                                        EditorError
    ├── state/geometry.ts                                matrices, frame, cover scale, zoom, layout
    ├── state/editorState.ts                             EditorState, actions, reducer
    ├── state/history.ts                                 generic undo stack with gestures
    ├── input/loadSource.ts                              fetch, validate, decode, cap
    ├── output/filters.ts                                filterString, PRESETS, canvas filter support
    ├── output/render.ts                                 draw state to a canvas
    ├── output/encode.ts                                 output type, encode fallback, fitToBytes
    ├── output/exportImage.ts                            the pipeline end to end
    ├── engine/loadCropper.ts                            cached dynamic import
    ├── engine/CropperView.tsx                           cropperjs adapter
    ├── ui/LabelsContext.tsx                             labels context
    ├── ui/ImageEditor.tsx                               dialog, open/close, source switching
    ├── ui/EditorSession.tsx                             one loaded image: state, layout, apply
    ├── ui/useLoadedImage.ts                             load lifecycle, URL revocation
    ├── ui/CanvasArea.tsx                                measured stage, key layer, live region
    ├── ui/CropControls.tsx, ui/AdjustControls.tsx
    ├── ui/HistoryButtons.tsx, ui/MobileToolbar.tsx, ui/Picker.tsx
    ├── stories/*.stories.tsx, stories/fixtures.ts
    └── test/setup.ts
```

---

### Task 1: Scaffold, public types, labels, features, surface lock

**Files:** create `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vite.config.ts`,
`src/test/setup.ts` (copied from `packages/form`, trimmed to one entry and no optional
peers), `src/types.ts`, `src/labels.ts`, `src/features.ts`, `src/errors.ts`, `src/index.ts`,
`src/index.test.ts`, `src/features.test.ts`. Modify `pnpm-workspace.yaml` (catalog
`cropperjs: ^2.2.0`), `apps/storybook/package.json` (workspace dependency).

**Interfaces (produces):**

```ts
// types.ts
export type CropRatio = 'free' | '1:1' | '4:3' | '16:9' | number;
export type CropShape = 'rect' | 'circle';
export type OutputType = 'image/jpeg' | 'image/png' | 'image/webp';
export interface ImageEditorFeatures {
  crop?: boolean | {ratios?: CropRatio[]; shape?: CropShape};
  zoom?: boolean | {min?: number; max?: number; slider?: boolean};
  rotate?: boolean;
  flip?: boolean | {horizontal?: boolean; vertical?: boolean};
  replace?: boolean;
  straighten?: boolean | {range?: number};
  adjust?: boolean | {brightness?: boolean; contrast?: boolean; saturation?: boolean; presets?: boolean};
  history?: boolean;
}
export interface ImageEditorInput {
  accept?: string[];
  minWidth?: number;
  minHeight?: number;
  maxBytes?: number;
}
export interface ImageEditorOutput {
  type?: OutputType;
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  maxBytes?: number;
  background?: string;
  fileName?: string;
}
export interface ImageEditorResult {
  file: File;
  width: number;
  height: number;
  type: string;
}
export type ImageEditorErrorCode = 'unsupported-type' | 'too-small' | 'too-large' | 'load-failed' | 'output-too-large';
export interface ImageEditorError {
  code: ImageEditorErrorCode;
  cause?: unknown;
}
export interface ImageEditorProps {
  open: boolean;
  source: File | Blob | string | null;
  onClose: () => void;
  onApply: (result: ImageEditorResult) => void | Promise<void>;
  onError?: (error: ImageEditorError) => void;
  features?: ImageEditorFeatures;
  input?: ImageEditorInput;
  output?: ImageEditorOutput;
  labels?: Partial<ImageEditorLabels>;
}

// features.ts
export interface ResolvedFeatures {
  crop: {ratios: CropRatio[]; shape: CropShape; enabled: boolean};
  zoom: false | {min: number; max: number; slider: boolean};
  rotate: boolean;
  flip: false | {horizontal: boolean; vertical: boolean};
  replace: boolean;
  straighten: false | {range: number};
  adjust: false | {brightness: boolean; contrast: boolean; saturation: boolean; presets: boolean};
  history: boolean;
}
export function resolveFeatures(features: ImageEditorFeatures | undefined): ResolvedFeatures;
export function parseRatio(ratio: CropRatio): number | null; // null is free

// errors.ts
export class EditorError extends Error {
  readonly code: ImageEditorErrorCode;
  readonly cause?: unknown;
}
export function toEditorError(error: unknown, fallback: ImageEditorErrorCode): ImageEditorError;
```

Rules `resolveFeatures` encodes (each gets a test in `features.test.ts`):
`undefined` gives crop/zoom/rotate/flip on and the rest off; `crop: false` gives
`{enabled: false, ratios: ['free'], shape: 'rect'}`; `shape: 'circle'` forces
`ratios: ['1:1']`; an empty or all-invalid `ratios` falls back to the default list;
`flip: {horizontal: false, vertical: false}` becomes `false`; `adjust: {…all false}` becomes
`false`; `zoom.min` below 1 is raised to 1 and `max` below `min` is raised to `min`;
`straighten.range` is clamped to 1..90. `parseRatio('4:3')` is `4 / 3`, `'free'` and any
non-positive or non-finite value is `null`.

`labels.ts` holds `ImageEditorLabels` (flat keys, functions for messages with values) and
`DEFAULT_IMAGE_EDITOR_LABELS`; the full list is in the file. `index.test.ts` pins the
runtime exports to `['DEFAULT_IMAGE_EDITOR_LABELS', 'ImageEditor']` and checks every label
default is a non-empty string or a function returning one.

- [ ] Write `features.test.ts` and `index.test.ts`, see them fail, implement, see them pass
      (`pnpm vitest run --project @vt-labs/image-editor`).
- [ ] `pnpm install`, `pnpm --filter @vt-labs/image-editor typecheck`.
- [ ] Commit `feat(image-editor): scaffold the package with its public types, labels and feature resolution`.

### Task 2: Geometry

**Files:** `src/state/geometry.ts`, `src/state/geometry.test.ts`.

The model. A matrix is `[a, b, c, d]`, acting on a column vector: `x' = a·x + b·y`,
`y' = c·x + d·y`, y pointing down, so a positive angle turns clockwise on screen.

- `orientation` is a dihedral matrix (entries -1, 0, 1). Rotating right is `R90 · O`, left
  `R-90 · O`, flipping `diag(-1, 1) · O` or `diag(1, -1) · O`. Composing on the left keeps
  every command relative to what the user currently sees.
- The **frame** is the oriented image: `w × h`, swapped when `O[0] === 0`.
- A frame point is `F(p) = cF + s·Rot(θ)·O·(p − cI)` where `cI` is the image centre, `cF` the
  frame centre, and `s` the cover scale that keeps the frame covered at angle θ:
  `s = max((w|cos θ| + h|sin θ|) / w, (w|sin θ| + h|cos θ|) / h)`.
- The crop is a rect in frame pixels, always inside `[0, w] × [0, h]`.
- **Zoom is derived**, not stored: `zoom = maxWidth(aspect) / crop.width` with
  `maxWidth(a) = min(w, h·a)`, so zoom 1 is the largest crop of that shape.
- **Layout** for a stage of size `S` with padding `p`: `k = min((S.w − 2p) / crop.w,
(S.h − 2p) / crop.h)`; the crop centre lands on the stage centre `C`. The image element
  (absolute at 0,0, natural size, centre transform-origin) takes CSS
  `matrix(M00, M10, M01, M11, e, f)` with `M = k·s·Rot(θ)·O` and
  `(e, f) = C + k·(cF − cropCentre) − cI`. The selection is the fitted crop rect.

**Produces:**

```ts
export type Matrix2 = readonly [number, number, number, number];
export interface Size {
  width: number;
  height: number;
}
export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export const IDENTITY: Matrix2,
  ROTATE_RIGHT: Matrix2,
  ROTATE_LEFT: Matrix2,
  FLIP_HORIZONTAL: Matrix2,
  FLIP_VERTICAL: Matrix2;
export function multiply(a: Matrix2, b: Matrix2): Matrix2;
export function apply(m: Matrix2, p: Point): Point;
export function rotation(degrees: number): Matrix2;
export function scale(m: Matrix2, k: number): Matrix2;
export function frameSize(image: Size, orientation: Matrix2): Size;
export function coverScale(frame: Size, degrees: number): number;
export function linearOf(image: Size, orientation: Matrix2, degrees: number): Matrix2; // s·Rot·O
export function toFrame(image: Size, orientation: Matrix2, degrees: number, p: Point): Point;
export function maxCropWidth(frame: Size, aspect: number): number;
export function zoomOf(frame: Size, crop: Rect): number;
export function clampRect(rect: Rect, frame: Size): Rect; // fits size first, then position
export function largestCrop(frame: Size, aspect: number | null): Rect; // centred
export interface StageLayout {
  k: number;
  selection: Rect;
  frame: Rect;
  matrix: [number, number, number, number, number, number];
}
export function layoutStage(
  stage: Size,
  padding: number,
  image: Size,
  orientation: Matrix2,
  degrees: number,
  crop: Rect,
): StageLayout;
export function stageToCrop(layout: StageLayout, stage: Size, crop: Rect, selection: Rect): Rect; // inverse of the selection mapping
```

Tests (each an `it` in `geometry.test.ts`): four right rotations give `IDENTITY`; flipping
twice gives `IDENTITY`; `R90` sends `(1, 0)` to `(0, 1)`; `frameSize` swaps after one
rotation; `coverScale` is 1 at 0° and for a 100×100 frame at 45° is `√2`; the four frame
corners map inside the covered image at 30° (inverse-map each corner and check it lies in
`[0, w] × [0, h]`); `toFrame` of the image centre is the frame centre; `zoomOf` of
`largestCrop` is 1; `clampRect` pulls an overhanging rect back in and shrinks an oversized
one; `layoutStage` puts the crop centre at the stage centre, maps the crop's top-left image
point to the selection's top-left (apply the CSS matrix by hand), and `stageToCrop` of the
layout's own selection returns the crop.

- [ ] Tests first, fail, implement, pass. Commit `feat(image-editor): add the geometry model`.

### Task 3: Editor reducer and history

**Files:** `src/state/editorState.ts`, `src/state/history.ts` and their tests.

**Produces:**

```ts
export interface Adjustments {
  brightness: number;
  contrast: number;
  saturation: number;
}
export interface EditorState {
  image: Size;
  orientation: Matrix2;
  straighten: number;
  crop: Rect;
  ratio: number | null;
  zoom: {min: number; max: number};
  adjust: Adjustments;
}
export type EditorAction =
  | {type: 'rotate'; direction: 1 | -1}
  | {type: 'flip'; axis: 'horizontal' | 'vertical'}
  | {type: 'straighten'; degrees: number}
  | {type: 'setCrop'; crop: Rect}
  | {type: 'moveCrop'; dx: number; dy: number}
  | {type: 'resizeCrop'; dw: number; dh: number}
  | {type: 'zoomBy'; factor: number}
  | {type: 'zoomTo'; zoom: number}
  | {type: 'setRatio'; ratio: number | null}
  | {type: 'adjust'; values: Partial<Adjustments>}
  | {type: 'replace'; state: EditorState};
export function initialEditorState(image: Size, features: ResolvedFeatures): EditorState;
export function editorReducer(state: EditorState, action: EditorAction): EditorState;
export function frameOf(state: EditorState): Size;
export function currentZoom(state: EditorState): number;

export interface History<S> {
  past: S[];
  present: S;
  future: S[];
  pending: S | null;
}
export type HistoryAction<S, A> =
  | {type: 'apply'; action: A; transient?: boolean}
  | {type: 'commit'}
  | {type: 'undo'}
  | {type: 'redo'}
  | {type: 'init'; state: S};
export const HISTORY_LIMIT = 50;
export function createHistory<S>(present: S): History<S>;
export function historyReducer<S, A>(reducer: (s: S, a: A) => S): (h: History<S>, a: HistoryAction<S, A>) => History<S>;
```

Behaviour and the test for each:

- `rotate`: orientation composes on the left, the crop centre is rotated about the frame
  centre into the new frame, width and height swap, `ratio` inverts (not for `null` or 1).
- `flip`: orientation composes on the left, `straighten` is negated, the crop mirrors
  inside the frame. Review Focus 2: after `straighten 10`, `flip`, `rotate`, the mapped
  frame corners equal the old mapped corners mirrored then rotated.
- `straighten`: sets the angle; crop unchanged.
- `setCrop`: clamped to the frame, and to the zoom range by rescaling about its centre.
- `moveCrop`: translate then clamp.
- `resizeCrop`: from the top-left corner; with a ratio, height follows width (or width
  follows height when `dw` is 0); minimum 1 px; then the `setCrop` rules.
- `zoomBy`/`zoomTo`: new width `maxCropWidth / zoom` with zoom clamped, about the crop
  centre, then clamped.
- `setRatio`: `null` keeps the crop; a number gives the largest crop of that ratio divided
  by the current zoom, centred on the old centre, clamped.
- `adjust`: merges and clamps each value to -100..100.
- Actions that change nothing return the same object (history uses identity).
- History: an `apply` pushes the previous present and clears `future`; an unchanged state
  pushes nothing; a transient `apply` keeps the first pre-gesture state in `pending`;
  `commit` pushes that once; `undo`/`redo` commit a pending gesture first; `past` never
  exceeds 50; `init` clears everything. Reset is `apply(replace(initial))`, so it is undoable.

- [ ] Tests first, fail, implement, pass. Commit `feat(image-editor): add the editor reducer and gesture-aware history`.

### Task 4: Input

**Files:** `src/input/loadSource.ts`, `src/input/loadSource.test.ts`.

**Produces:**

```ts
export const MAX_WORKING_EDGE = 4096;
export interface LoadedImage {
  url: string;
  width: number;
  height: number;
  type: string;
  revoke: () => void;
}
export interface Decoder {
  decode: (url: string) => Promise<{width: number; height: number; image: CanvasImageSource}>;
  downscale: (image: CanvasImageSource, width: number, height: number) => Promise<Blob>;
}
export const DEFAULT_ACCEPT: string[]; // jpeg, png, webp, gif
export function checkBlob(blob: Blob, input: ImageEditorInput): ImageEditorErrorCode | null;
export function loadSource(
  source: File | Blob | string,
  input: ImageEditorInput,
  decoder?: Decoder,
): Promise<LoadedImage>;
```

A URL is fetched (`fetch(url, {mode: 'cors'})`), so every source becomes a `Blob` with a
type and a size; a failed fetch or a non-OK response is `load-failed`. Then: type not in
`accept` is `unsupported-type`; size over `input.maxBytes` is `too-large`; decode failure
is `load-failed`; natural size under `minWidth`/`minHeight` is `too-small`; a long edge
over 4096 is drawn down to 4096 and re-wrapped in a new object URL (the first one revoked).
`revoke` revokes whatever URL survives. Any URL created before a failure is revoked.

Tests with a fake decoder and a stubbed `URL.createObjectURL`/`revokeObjectURL` and
`fetch`: each error code; the URL is revoked on each failure; Review Focus 1 (6000×4000
gives 4096×2731 and `downscale` is called once, the original URL revoked); a URL source's
type comes from the fetched blob.

- [ ] Tests first, fail, implement, pass. Commit `feat(image-editor): load and validate a file, blob or url into a capped working copy`.

### Task 5: Output

**Files:** `src/output/filters.ts`, `src/output/render.ts`, `src/output/encode.ts`,
`src/output/exportImage.ts`, tests for `filters` and `encode`.

**Produces:**

```ts
export const PRESETS: {id: PresetId; values: Adjustments}[]; // original, vivid, mono, fade, dramatic
export type PresetId = 'original' | 'vivid' | 'mono' | 'fade' | 'dramatic';
export function filterString(a: Adjustments): string; // 'none' when neutral
export function supportsCanvasFilter(): boolean;

export function outputSize(crop: Size, maxWidth?: number, maxHeight?: number): Size; // never enlarges, ≥ 1
export function renderState(
  image: CanvasImageSource,
  state: EditorState,
  options: {
    shape: CropShape;
    width: number;
    height: number;
    background: string | null;
  },
): HTMLCanvasElement;

export function resolveOutputType(requested: OutputType | undefined, sourceType: string, shape: CropShape): OutputType;
export function needsAlpha(sourceType: string, shape: CropShape): boolean;
export function encodeWithFallback(
  encode: (type: string, quality: number) => Promise<Blob>,
  type: OutputType,
  quality: number,
  alpha: boolean,
): Promise<Blob>;
export function fitToBytes(options: {
  encode: (scale: number, quality: number) => Promise<Blob>;
  type: string;
  quality: number;
  maxBytes: number;
  longEdge: number;
}): Promise<{blob: Blob; scale: number}>;
export function extensionFor(type: string): string;
export function exportImage(options: {
  image: CanvasImageSource;
  state: EditorState;
  shape: CropShape;
  sourceType: string;
  output: ImageEditorOutput;
}): Promise<ImageEditorResult>;
```

Presets (the sliders must be able to express each): original `{0, 0, 0}`, vivid
`{5, 15, 35}`, mono `{0, 10, -100}`, fade `{10, -25, -20}`, dramatic `{-10, 40, -10}` as
`{brightness, contrast, saturation}`. `filterString` is
`brightness(1+b/100) contrast(1+c/100) saturate(1+s/100)`.

`renderState` draws, in one pass: scale to the output size, clip to an ellipse for a
circle (after filling `background` when given), `translate(-crop)`, `translate(cF)`,
`transform(s·Rot·O)`, `translate(-cI)`, `ctx.filter`, `drawImage`.

`fitToBytes` (tests with a fake whose size is `pixels × quality` in bytes): returns the
first encode when it fits; for a lossy type binary-searches quality in `[0.6, quality]`
with at most six encodes and returns the highest passing one; otherwise, or for PNG,
multiplies the scale by `√(maxBytes ÷ size) × 0.95` and repeats; throws `EditorError
('output-too-large')` once `longEdge × scale < 64` (Review Focus 4). `encodeWithFallback`:
a blob whose type differs from the request is re-encoded as PNG when `alpha`, else JPEG
(Review Focus 3). `resolveOutputType`: requested wins; else PNG for a circle; else the
source type when JPEG, PNG or WebP; else PNG.

`render` and `exportImage` need a real canvas; they are covered by the pixel stories
(Task 11).

- [ ] Tests first, fail, implement, pass. Commit `feat(image-editor): add the output pipeline with size fitting and encode fallback`.

### Task 6: Engine

**Files:** `src/engine/loadCropper.ts`, `src/engine/CropperView.tsx`,
`src/engine/ssr.test.tsx`.

**Produces:**

```ts
export function loadCropper(): Promise<void>; // cached import('cropperjs')
export interface CropperViewProps {
  src: string;
  state: EditorState;
  stage: Size;
  layout: StageLayout;
  shape: CropShape;
  filter: string;
  editable: boolean;
  onAction: (action: EditorAction, options?: {transient?: boolean}) => void;
  onCommit: () => void;
}
export function CropperView(props: CropperViewProps): JSX.Element;
```

`CropperView` renders a wrapper `div`; after `loadCropper()` resolves it builds, once per
`src`: `cropper-canvas` (`aria-hidden`) › `cropper-image` (rotatable scalable skewable
translatable), `cropper-handle action="move" plain` over the whole stage, `cropper-shade`,
`cropper-selection` (not movable, resizable unless `!editable`, keyboard off, outlined)
› `cropper-grid covered`, `cropper-handle action="move"` (transparent) and the eight resize
handles. On every render it writes the layout: image `$setTransform(matrix)`, selection
`$change(selection)`, `aspectRatio`, the image's CSS `filter`, and the circle styles.

Pointer input: a capture-phase `action` listener on the wrapper turns `move` into
`moveCrop(-dx/k, -dy/k)` (transient) and `scale`/`transform` with a numeric `scale` into
`zoomBy(1 + scale)` (transient; the wheel commits after 300 ms of quiet), and cancels the
event so cropperjs does not move anything itself. A `change` listener on the selection
clamps a resize to the layout's frame rect. `actionend` reads the selection back with
`stageToCrop`, dispatches `setCrop` and commits. Theme: shade
`alpha(common.black, 0.55)`, selection and handles `primary.main`, grid
`alpha(common.white, 0.4)`, stage `grey[900]`.

Test: `renderToString(<ImageEditor open source={blob} …/>)` and closed do not throw and do
not call `import('cropperjs')` (mock `loadCropper` and assert no calls).

- [ ] Implement, write the SSR test, pass. Commit `feat(image-editor): add the cropperjs view adapter`.

### Task 7: UI shell

**Files:** `ui/LabelsContext.tsx`, `ui/ImageEditor.tsx`, `ui/EditorSession.tsx`,
`ui/useLoadedImage.ts`, `ui/CanvasArea.tsx` (stage only in this task), `ui/Picker.tsx`,
`ui/ImageEditor.test.tsx`, `stories/Basic.stories.tsx`, `stories/fixtures.ts`.

The session mounts only while `open`, so closing discards state. `source` changes reset
the picked file and history. `useLoadedImage` revokes on source change, close and unmount.
Apply: controls disabled while pending, a second click ignored (Review Focus 5), a
rejection shows `labels.applyFailed` and keeps state; `output-too-large` shows its message
and calls `onError`.

jsdom tests mock `engine/CropperView` and `input/loadSource` and `output/exportImage`:
closed renders nothing; `source={null}` shows the picker filtered by `accept`; a load
error shows the error message and calls `onError` once; picking a file loads it; Apply
calls `onApply` with the export result; a double click calls it once; a rejection shows
`applyFailed`; Cancel and Escape call `onClose`; `labels` override one string; the URL is
revoked on close.

- [ ] Tests first, fail, implement, pass. Commit `feat(image-editor): add the dialog shell with load, apply and the picker`.

### Task 8: Crop tools, key layer, live region

**Files:** `ui/CropControls.tsx`, `ui/CanvasArea.tsx`, tests.

Ratio `ToggleButtonGroup` when crop is enabled, rect, and more than one ratio; straighten
`Slider` (−range..range, marks at 0 and the ends) with `straighten`; zoom `Slider` with
`zoom.slider`; rotate left/right with `rotate`; flip buttons per axis. Sliders dispatch
transient and commit on `onChangeCommitted`.

Key layer on the stage wrapper (`tabIndex 0`, `role="group"`, `aria-label`,
`aria-describedby` → visually hidden help): arrows move 10 screen px (1 with Alt),
Shift+arrows resize, `+`/`=`/`-` zoom by 1.1, `r`/`R` rotate (when enabled), Ctrl/Cmd+Z
and Ctrl/Cmd+Shift+Z undo and redo (with `history`). Screen px become frame px by dividing
by the layout's `k`. Each change is announced in a polite status region.

Tests: which controls render for each feature combination; keys do nothing unless the
stage has focus; arrow and rotate keys dispatch and announce.

- [ ] Tests first, fail, implement, pass. Commit `feat(image-editor): add crop tools, the key layer and announcements`.

### Task 9: Adjust, presets, history UI

**Files:** `ui/AdjustControls.tsx`, `ui/HistoryButtons.tsx`, tests.

Tabs Crop/Adjust only when `adjust` is on and `supportsCanvasFilter()`. Adjust: an
exclusive `ToggleButtonGroup` of the enabled values (each showing its number) and one
`Slider` for the selected one; a preset `ToggleButtonGroup` when `presets`. Undo and redo
buttons with `history`, disabled at the ends. Reset in the footer, disabled when the state
equals the initial one.

Tests: tabs absent without adjust or without canvas filter support; a preset sets all three
values; undo and redo buttons walk the history; reset is undoable.

- [ ] Tests first, fail, implement, pass. Commit `feat(image-editor): add adjustments, presets and undo and redo`.

### Task 10: Mobile layout

**Files:** `ui/MobileToolbar.tsx`, `ui/EditorSession.tsx`, tests.

Below `sm` the dialog is full screen; the header is Cancel, title, Done; a floating pill
over the stage holds undo, rotate, flip and reset (each only when its feature is on); the
dock sits at the bottom; the footer is gone. Test by mocking `useMediaQuery` to true.

- [ ] Test first, fail, implement, pass. Commit `feat(image-editor): add the mobile layout`.

### Task 11: Stories

**Files:** `stories/*.stories.tsx`.

Basic, Avatar, Everything, Crop ratios, Straighten, Adjust, History, Picker and Replace,
Errors, Custom labels, Mobile. Each has a `play`. Pixel checks (real Chromium, real
cropperjs): flip plus an off-centre crop exports the right colour; a 90° rotation swaps the
output size; circle corners are transparent; an adjustment changes the pixels;
`maxBytes` is respected; keys act only with focus; undo and redo; a rejected `onApply`
keeps the editor open.

- [ ] Write, run `pnpm vitest run --project storybook`, pass. Commit `test(image-editor): add stories with interaction and pixel checks`.

### Task 12: Verify gate, docs, close

**Files:** `scripts/check-graph.mjs`, `.size-limit.json`, `README.md`,
`.changeset/image-editor-initial.md`; modify `package.json` (verify script and the
size-limit, publint, attw dev dependencies), `vitest.config.ts` coverage thresholds for
`packages/image-editor/**` at 90, `docs/roadmap.md`, `docs/extraction/README.md`, the spec
status, and move this plan to `plans/done/`.

`check-graph.mjs` walks `dist/**/*.js` and fails on a static `cropperjs` import, on
`from '@mui/material'` or `from '@mui/icons-material'`, and when no file has
`import('cropperjs')`. size-limit rows: `import {ImageEditor}` with every peer ignored; the
limit is the first measurement plus 10%. `verify` runs check-graph, size-limit, publint and
`attw --pack . --profile esm-only`. Turbo and the root scripts are left alone, because the
form package adds the same wiring in its Task 13; the two merge there.

- [ ] Run `pnpm --filter @vt-labs/image-editor verify` and `pnpm validate`, both exit 0.
- [ ] Commit `docs(image-editor): readme, changeset, verify gate and roadmap`.
