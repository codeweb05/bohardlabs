# @bohar/image-editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the crop/zoom/rotate/flip image editor duplicated across four admin apps into a standalone package with no app imports and no hardcoded strings.

**Architecture:** A headless hook (`useImageEditor`) holding transform state and doing the canvas work, plus a MUI dialog (`ImageEditor`) that renders controls around it. All user-facing text comes from a `Labels` object with English defaults, following the pattern `@bohar/datatable` already uses. `react-easy-crop` is the only non-MUI dependency and it is a peer.

**Tech Stack:** React 19, MUI 7, `react-easy-crop` 5, Vite lib mode, Vitest + jsdom, Storybook 10.

**Spec:** [`docs/extraction/README.md`](../../../extraction/README.md), section "1. `@bohar/image-editor`"

**Source being ported:** `skipwash-latest/skipwash-admin/src/components/ImageEditor/` (817 loc, 4 files). The copy in `smart/admin-v2` is byte-identical apart from semicolons; do not consult it.

## Global Constraints

- Package name `@bohar/image-editor`, `"private": true`, version `0.0.0`.
- No `@/…` imports. Anything the app supplied becomes a prop or an option.
- No hardcoded user-facing string in a component. Use the `Labels` pattern below.
- No hardcoded colour. Theme tokens only (`text.secondary`, `action.hover`, `divider`).
- Never `any`, `@ts-ignore`, `@ts-expect-error`, `as unknown as`.
- Icons import per-icon (`@mui/icons-material/RotateLeft`), never the barrel.
- Peers: `react` ^19, `react-dom` ^19, `@mui/material` ^7, `@mui/icons-material` ^7, `@emotion/react` ^11, `@emotion/styled` ^11, `react-easy-crop` ^5. Every one is repeated in `devDependencies` as `catalog:` except `react-easy-crop`, which is new to the workspace and gets added to the catalog in Task 1.
- ESM only, `formats: ['es']`, `preserveModules: true`.
- Extend `tsconfig.base.json`. Do not re-declare options it already sets.
- Never run a git command. Tasks end with a handoff step; a person commits.

---

### Task 1: Package scaffolding that builds and tests empty

**Files:**

- Create: `packages/image-editor/package.json`
- Create: `packages/image-editor/tsconfig.json`
- Create: `packages/image-editor/tsconfig.build.json`
- Create: `packages/image-editor/vite.config.ts`
- Create: `packages/image-editor/src/index.ts`
- Create: `packages/image-editor/src/test/setup.ts`
- Modify: `pnpm-workspace.yaml` (add `react-easy-crop` to the catalog)

**Interfaces:**

- Consumes: nothing.
- Produces: a buildable package directory. Later tasks add files under `src/`.

- [ ] **Step 1: Add the new dependency to the version catalog**

In `pnpm-workspace.yaml`, inside the `catalog:` block, after the `dayjs` line:

```yaml
  'react-easy-crop': ^5.5.6
```

- [ ] **Step 2: Write `packages/image-editor/package.json`**

```json
{
  "name": "@bohar/image-editor",
  "version": "0.0.0",
  "private": true,
  "description": "Crop, zoom, rotate and flip an image in a MUI dialog",
  "type": "module",
  "sideEffects": false,
  "files": ["dist"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./package.json": "./package.json"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "publishConfig": {
    "access": "public"
  },
  "scripts": {
    "build": "vite build && tsc -p tsconfig.build.json",
    "dev": "vite build --watch",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "test:cov": "vitest run --coverage",
    "clean": "rm -rf dist *.tsbuildinfo"
  },
  "peerDependencies": {
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.0",
    "@mui/icons-material": "^7.0.0",
    "@mui/material": "^7.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-easy-crop": "^5.0.0"
  },
  "devDependencies": {
    "@emotion/react": "catalog:",
    "@emotion/styled": "catalog:",
    "@mui/icons-material": "catalog:",
    "@mui/material": "catalog:",
    "@storybook/addon-docs": "^10.5.10",
    "@storybook/react-vite": "^10.5.10",
    "@testing-library/dom": "^10.4.1",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^26.4.0",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "@vitejs/plugin-react": "catalog:",
    "babel-plugin-react-compiler": "^1.0.0",
    "jsdom": "^28.0.1",
    "react": "catalog:",
    "react-dom": "catalog:",
    "react-easy-crop": "catalog:",
    "storybook": "^10.5.10",
    "typescript": "catalog:",
    "vite": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 3: Write the two tsconfigs**

`packages/image-editor/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`packages/image-editor/tsconfig.build.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": false,
    "emitDeclarationOnly": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/*.stories.tsx", "src/test"]
}
```

- [ ] **Step 4: Write `packages/image-editor/vite.config.ts`**

```ts
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  plugins: [react({babel: {plugins: ['babel-plugin-react-compiler']}})],
  build: {
    target: 'es2022',
    sourcemap: true,
    emptyOutDir: true,
    lib: {
      entry: {index: 'src/index.ts'},
      formats: ['es'],
    },
    rollupOptions: {
      external: (id) => !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0'),
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
    testTimeout: 15000,
    hookTimeout: 15000,
    pool: 'forks',
    maxWorkers: process.env.VITEST_MAX_WORKERS ? Number(process.env.VITEST_MAX_WORKERS) : '50%',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['src/test/**', 'src/**/*.stories.tsx', 'src/index.ts'],
    },
  },
});
```

- [ ] **Step 5: Write the test setup**

jsdom implements none of the canvas or image-decoding APIs this package uses. Without these stubs every test throws before it reaches an assertion. `getContext` returns `null` in jsdom, `toBlob` and `toDataURL` do not exist, and an `Image` never fires `load` because jsdom does not fetch.

`packages/image-editor/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import {cleanup} from '@testing-library/react';
import {afterEach, vi} from 'vitest';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class MockResizeObserver implements ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
globalThis.ResizeObserver = MockResizeObserver;

// A 2D context with only the calls the editor makes. Every one records its
// arguments so a test can assert on the draw sequence rather than on pixels.
interface FakeContext {
  save: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  translate: ReturnType<typeof vi.fn>;
  scale: ReturnType<typeof vi.fn>;
  rotate: ReturnType<typeof vi.fn>;
  drawImage: ReturnType<typeof vi.fn>;
}

export function createFakeContext(): FakeContext {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    drawImage: vi.fn(),
  };
}

export const lastContexts: FakeContext[] = [];

HTMLCanvasElement.prototype.getContext = vi.fn(function getContext(this: HTMLCanvasElement) {
  const ctx = createFakeContext();
  lastContexts.push(ctx);
  return ctx as unknown as CanvasRenderingContext2D;
}) as unknown as HTMLCanvasElement['getContext'];

HTMLCanvasElement.prototype.toBlob = function toBlob(callback: BlobCallback, type?: string) {
  callback(new Blob(['fake'], {type: type ?? 'image/png'}));
};

HTMLCanvasElement.prototype.toDataURL = function toDataURL(type?: string) {
  return `data:${type ?? 'image/png'};base64,ZmFrZQ==`;
};

// jsdom never loads an image, so `new Image().src = ...` never fires `load` and
// every await in generateCroppedImage would hang until the test timed out.
// Resolve on the next microtask with fixed intrinsic dimensions instead.
Object.defineProperty(HTMLImageElement.prototype, 'src', {
  configurable: true,
  set(this: HTMLImageElement, value: string) {
    this.setAttribute('src', value);
    Object.defineProperty(this, 'width', {configurable: true, value: 800});
    Object.defineProperty(this, 'height', {configurable: true, value: 600});
    queueMicrotask(() => this.dispatchEvent(new Event('load')));
  },
  get(this: HTMLImageElement) {
    return this.getAttribute('src') ?? '';
  },
});
```

- [ ] **Step 6: Write a placeholder entry point**

`packages/image-editor/src/index.ts`:

```ts
export {};
```

- [ ] **Step 7: Install and verify the package is wired into the workspace**

Run: `pnpm install`
Then: `pnpm --filter @bohar/image-editor build`
Expected: Vite reports a build with no entry modules of substance, and `tsc` emits an empty `dist/index.d.ts`. No error.

Then: `pnpm --filter @bohar/image-editor test`
Expected: PASS, "no test files" (that is what `--passWithNoTests` is for).

- [ ] **Step 8: Hand off for commit**

Files: `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `packages/image-editor/`

Suggested message:

```
chore(image-editor): scaffold the package
```

---

### Task 2: Labels

**Files:**

- Create: `packages/image-editor/src/i18n/labels.ts`
- Create: `packages/image-editor/src/i18n/LabelsContext.tsx`
- Create: `packages/image-editor/src/i18n/index.ts`
- Test: `packages/image-editor/src/i18n/LabelsContext.test.tsx`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `interface ImageEditorLabels` with the 15 string keys listed below.
  - `const DEFAULT_LABELS: ImageEditorLabels`.
  - `<ImageEditorLabelsProvider labels?: Partial<ImageEditorLabels}>`: merges over defaults.
  - `useLabels(): ImageEditorLabels`: returns `DEFAULT_LABELS` outside a provider.

- [ ] **Step 1: Write the failing test**

`packages/image-editor/src/i18n/LabelsContext.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import {DEFAULT_LABELS, ImageEditorLabelsProvider, useLabels} from './index';

function ShowTitle() {
  const labels = useLabels();
  return <span>{labels.title}</span>;
}

describe('ImageEditorLabelsProvider', () => {
  it('falls back to the English defaults outside a provider', () => {
    render(<ShowTitle />);
    expect(screen.getByText('Edit image')).toBeInTheDocument();
  });

  it('overrides only the keys it is given', () => {
    render(
      <ImageEditorLabelsProvider labels={{title: 'Bild bearbeiten'}}>
        <ShowTitle />
      </ImageEditorLabelsProvider>,
    );
    expect(screen.getByText('Bild bearbeiten')).toBeInTheDocument();
  });

  it('leaves untouched keys at their default', () => {
    function ShowApply() {
      return <span>{useLabels().apply}</span>;
    }
    render(
      <ImageEditorLabelsProvider labels={{title: 'Bild bearbeiten'}}>
        <ShowApply />
      </ImageEditorLabelsProvider>,
    );
    expect(screen.getByText(DEFAULT_LABELS.apply)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @bohar/image-editor test`
Expected: FAIL, "Failed to resolve import './index'".

- [ ] **Step 3: Write `labels.ts`**

The values are the English strings the app's `en.json` carries today, with sentence case applied so they match the rest of the workspace (`headerCase` in the table settled on sentence case).

```ts
/**
 * Every user-facing string the editor can render.
 *
 * The package ships English defaults and takes overrides through the `labels` prop, so a
 * consumer wires its own i18n by passing translated values in. The package has no i18n
 * runtime: adding one would force every consumer onto the same library.
 *
 * Only the keys passed are replaced; the rest fall back to {@link DEFAULT_LABELS}.
 *
 * @example
 * ```tsx
 * // A module constant, not an inline object: `labels` is compared by identity, and a
 * // literal in JSX is a new object on every render.
 * const GERMAN: Partial<ImageEditorLabels> = {
 *   title: 'Bild bearbeiten',
 *   apply: 'Übernehmen',
 * };
 *
 * <ImageEditor labels={GERMAN} open={open} imageSrc={src} onClose={close} onApply={save} />
 * ```
 */
export interface ImageEditorLabels {
  readonly title: string;
  readonly apply: string;
  readonly cancel: string;
  readonly reset: string;
  readonly zoom: string;
  readonly zoomIn: string;
  readonly zoomOut: string;
  readonly rotation: string;
  readonly rotateLeft: string;
  readonly rotateRight: string;
  readonly flipHorizontal: string;
  readonly flipVertical: string;
  readonly aspectRatio: string;
  readonly changeImage: string;
  readonly processing: string;
}

export const DEFAULT_LABELS: ImageEditorLabels = {
  title: 'Edit image',
  apply: 'Apply',
  cancel: 'Cancel',
  reset: 'Reset',
  zoom: 'Zoom',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  rotation: 'Rotation',
  rotateLeft: 'Rotate left 90°',
  rotateRight: 'Rotate right 90°',
  flipHorizontal: 'Flip horizontal',
  flipVertical: 'Flip vertical',
  aspectRatio: 'Aspect ratio',
  changeImage: 'Change image',
  processing: 'Processing…',
};
```

- [ ] **Step 4: Write `LabelsContext.tsx`**

```tsx
import {createContext, useContext, useMemo} from 'react';
import type {ReactNode} from 'react';

import type {ImageEditorLabels} from './labels';
import {DEFAULT_LABELS} from './labels';

/**
 * Defaults are the context default, not `null`, so every component reads real strings even
 * when rendered outside a provider (a leaf under test, a story of one control group).
 */
const LabelsContext = createContext<ImageEditorLabels>(DEFAULT_LABELS);

interface ImageEditorLabelsProviderProps {
  readonly labels?: Partial<ImageEditorLabels>;
  readonly children: ReactNode;
}

export function ImageEditorLabelsProvider({labels, children}: Readonly<ImageEditorLabelsProviderProps>) {
  const value = useMemo<ImageEditorLabels>(() => (labels ? {...DEFAULT_LABELS, ...labels} : DEFAULT_LABELS), [labels]);

  return <LabelsContext.Provider value={value}>{children}</LabelsContext.Provider>;
}

export function useLabels(): ImageEditorLabels {
  return useContext(LabelsContext);
}
```

- [ ] **Step 5: Write `i18n/index.ts`**

```ts
export {ImageEditorLabelsProvider, useLabels} from './LabelsContext';
export {DEFAULT_LABELS} from './labels';
export type {ImageEditorLabels} from './labels';
```

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @bohar/image-editor test`
Expected: PASS, 3 tests.

- [ ] **Step 7: Hand off for commit**

```
feat(image-editor): labels with English defaults
```

---

### Task 3: Types

**Files:**

- Create: `packages/image-editor/src/types.ts`

**Interfaces:**

- Consumes: `ImageEditorLabels` from Task 2.
- Produces: `CropArea`, `OutputFormat`, `ImageEditorResult`, `ImageEditorProps`, `ImageEditorState`, `UseImageEditorOptions`.

This task has no test of its own: types are exercised by Tasks 4 and 5, and `pnpm typecheck` is the gate.

- [ ] **Step 1: Write `types.ts`**

Ported from the app's `types.ts`. Three changes from the original: the four individual label props (`title`, `applyLabel`, `cancelLabel`, `changeImageLabel`) collapse into one `labels` object, `onFileSelect` is documented as the caller's job, and every field keeps its `readonly`.

```ts
import type {SxProps, Theme} from '@mui/material';

import type {ImageEditorLabels} from './i18n';

/** A rectangle in the source image's own pixel space, as `react-easy-crop` reports it. */
export interface CropArea {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type OutputFormat = 'blob' | 'base64';

export interface ImageEditorResult {
  /** Present when `outputFormat` is `'blob'` (the default). */
  readonly blob?: Blob;
  /** Present when `outputFormat` is `'base64'`. A full data URL, not a bare payload. */
  readonly base64?: string;
  readonly width: number;
  readonly height: number;
  readonly mimeType: string;
}

export interface ImageEditorProps {
  readonly open: boolean;
  /** Any source an `<img>` accepts: an object URL, a data URL, or a same-origin path. */
  readonly imageSrc: string;
  readonly onClose: () => void;
  readonly onApply: (result: ImageEditorResult) => void | Promise<void>;
  /** When given, a "change image" control appears. The consumer owns the file picker. */
  readonly onChangeImage?: () => void;
  /** Width divided by height. `1` is square, `16 / 9` is widescreen. */
  readonly aspectRatio?: number;
  readonly maxOutputWidth?: number;
  readonly maxOutputHeight?: number;
  readonly outputFormat?: OutputFormat;
  /** 0 to 1. Ignored for `image/png`, which is lossless. */
  readonly outputQuality?: number;
  readonly mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  readonly labels?: Partial<ImageEditorLabels>;
  readonly sx?: SxProps<Theme>;
}

export interface ImageEditorState {
  readonly crop: {x: number; y: number};
  readonly zoom: number;
  readonly rotation: number;
  readonly flipHorizontal: boolean;
  readonly flipVertical: boolean;
  readonly croppedAreaPixels: CropArea | null;
}

export interface UseImageEditorOptions {
  readonly imageSrc: string;
  readonly aspectRatio?: number;
  readonly outputFormat?: OutputFormat;
  readonly outputQuality?: number;
  readonly maxOutputWidth?: number;
  readonly maxOutputHeight?: number;
  readonly mimeType?: string;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @bohar/image-editor typecheck`
Expected: PASS.

- [ ] **Step 3: Hand off for commit**

```
feat(image-editor): public types
```

---

### Task 4: The headless hook

**Files:**

- Create: `packages/image-editor/src/useImageEditor.ts`
- Test: `packages/image-editor/src/useImageEditor.test.ts`

**Interfaces:**

- Consumes: `CropArea`, `ImageEditorResult`, `UseImageEditorOptions` from Task 3.
- Produces: `useImageEditor(options)` returning `{crop, zoom, rotation, flipHorizontal, flipVertical, aspectRatio, croppedAreaPixels, setCrop, setZoom, setRotation, rotateLeft, rotateRight, toggleFlipHorizontal, toggleFlipVertical, resetEdits, onCropComplete, generateCroppedImage}`. `generateCroppedImage` is `() => Promise<ImageEditorResult>`.

The hook is a straight port with no behaviour change. Write the tests first anyway: the app version shipped with no tests at all, and rotation wrap-around and output clamping are exactly the places a later refactor breaks silently.

- [ ] **Step 1: Write the failing tests**

`packages/image-editor/src/useImageEditor.test.ts`:

```ts
import {act, renderHook} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import {useImageEditor} from './useImageEditor';

const SRC = 'blob:fake';

describe('useImageEditor', () => {
  it('starts unrotated, unflipped and at zoom 1', () => {
    const {result} = renderHook(() => useImageEditor({imageSrc: SRC}));

    expect(result.current.zoom).toBe(1);
    expect(result.current.rotation).toBe(0);
    expect(result.current.flipHorizontal).toBe(false);
    expect(result.current.flipVertical).toBe(false);
    expect(result.current.croppedAreaPixels).toBeNull();
  });

  it('wraps rotation past 180 back into the -180..180 range', () => {
    const {result} = renderHook(() => useImageEditor({imageSrc: SRC}));

    act(() => result.current.rotateRight());
    act(() => result.current.rotateRight());
    expect(result.current.rotation).toBe(180);

    act(() => result.current.rotateRight());
    expect(result.current.rotation).toBe(-90);
  });

  it('wraps rotation past -180 the other way', () => {
    const {result} = renderHook(() => useImageEditor({imageSrc: SRC}));

    act(() => result.current.rotateLeft());
    act(() => result.current.rotateLeft());
    expect(result.current.rotation).toBe(-180);

    act(() => result.current.rotateLeft());
    expect(result.current.rotation).toBe(90);
  });

  it('resetEdits returns every transform to its initial value', () => {
    const {result} = renderHook(() => useImageEditor({imageSrc: SRC}));

    act(() => {
      result.current.setZoom(2.5);
      result.current.rotateRight();
      result.current.toggleFlipHorizontal();
      result.current.toggleFlipVertical();
      result.current.setCrop({x: 10, y: 20});
    });

    act(() => result.current.resetEdits());

    expect(result.current.zoom).toBe(1);
    expect(result.current.rotation).toBe(0);
    expect(result.current.flipHorizontal).toBe(false);
    expect(result.current.flipVertical).toBe(false);
    expect(result.current.crop).toEqual({x: 0, y: 0});
  });

  it('rejects generateCroppedImage before a crop has been reported', async () => {
    const {result} = renderHook(() => useImageEditor({imageSrc: SRC}));

    await expect(result.current.generateCroppedImage()).rejects.toThrow('No crop area defined');
  });

  it('clamps the output to maxOutputWidth, keeping the aspect ratio', async () => {
    const {result} = renderHook(() =>
      useImageEditor({imageSrc: SRC, maxOutputWidth: 100, maxOutputHeight: 1000}),
    );

    act(() => result.current.onCropComplete({x: 0, y: 0, width: 400, height: 200}, {x: 0, y: 0, width: 400, height: 200}));

    const output = await result.current.generateCroppedImage();

    expect(output.width).toBe(100);
    expect(output.height).toBe(50);
  });

  it('clamps to maxOutputHeight when height is the binding constraint', async () => {
    const {result} = renderHook(() =>
      useImageEditor({imageSrc: SRC, maxOutputWidth: 1000, maxOutputHeight: 100}),
    );

    act(() => result.current.onCropComplete({x: 0, y: 0, width: 200, height: 400}, {x: 0, y: 0, width: 200, height: 400}));

    const output = await result.current.generateCroppedImage();

    expect(output.height).toBe(100);
    expect(output.width).toBe(50);
  });

  it('returns a blob by default and a data URL when asked for base64', async () => {
    const crop = {x: 0, y: 0, width: 200, height: 200};

    const blobHook = renderHook(() => useImageEditor({imageSrc: SRC}));
    act(() => blobHook.result.current.onCropComplete(crop, crop));
    const blobResult = await blobHook.result.current.generateCroppedImage();
    expect(blobResult.blob).toBeInstanceOf(Blob);
    expect(blobResult.base64).toBeUndefined();
    expect(blobResult.mimeType).toBe('image/jpeg');

    const b64Hook = renderHook(() => useImageEditor({imageSrc: SRC, outputFormat: 'base64', mimeType: 'image/png'}));
    act(() => b64Hook.result.current.onCropComplete(crop, crop));
    const b64Result = await b64Hook.result.current.generateCroppedImage();
    expect(b64Result.base64).toMatch(/^data:image\/png;base64,/);
    expect(b64Result.blob).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `pnpm --filter @bohar/image-editor test`
Expected: FAIL, "Failed to resolve import './useImageEditor'".

- [ ] **Step 3: Port the hook**

Copy `skipwash-latest/skipwash-admin/src/components/ImageEditor/useImageEditor.ts` to `packages/image-editor/src/useImageEditor.ts` verbatim. It has no app imports, so nothing needs rewriting. Confirm the import line reads:

```ts
import type {CropArea, ImageEditorResult, UseImageEditorOptions} from './types';
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @bohar/image-editor test`
Expected: PASS, 8 tests.

If "clamps the output to maxOutputWidth" fails with `height: 50` expected but something else received, the port dropped the second `if` in `computeOutputSize`; both clamps apply in sequence and the second reads the width the first already reduced.

- [ ] **Step 5: Hand off for commit**

```
feat(image-editor): port useImageEditor with tests
```

---

### Task 5: The dialog

**Files:**

- Create: `packages/image-editor/src/ImageEditor.tsx`
- Test: `packages/image-editor/src/ImageEditor.test.tsx`
- Modify: `packages/image-editor/src/index.ts`

**Interfaces:**

- Consumes: `useImageEditor` (Task 4), `useLabels` / `ImageEditorLabelsProvider` (Task 2), `ImageEditorProps` (Task 3).
- Produces: `<ImageEditor {...ImageEditorProps} />`, exported from the package root along with `useImageEditor`, `DEFAULT_LABELS`, and every type in `types.ts`.

- [ ] **Step 1: Write the failing tests**

`packages/image-editor/src/ImageEditor.test.tsx`:

```tsx
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {ImageEditor} from './ImageEditor';

function setup(overrides: Partial<React.ComponentProps<typeof ImageEditor>> = {}) {
  const onClose = vi.fn();
  const onApply = vi.fn();
  render(<ImageEditor open imageSrc="blob:fake" onClose={onClose} onApply={onApply} {...overrides} />);
  return {onClose, onApply};
}

describe('ImageEditor', () => {
  it('renders nothing when closed', () => {
    render(<ImageEditor open={false} imageSrc="blob:fake" onClose={vi.fn()} onApply={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('uses the English defaults for its title and actions', () => {
    setup();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Edit image')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Apply'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
  });

  it('takes label overrides through the labels prop', () => {
    setup({labels: {title: 'Bild bearbeiten', apply: 'Übernehmen'}});
    expect(screen.getByText('Bild bearbeiten')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Übernehmen'})).toBeInTheDocument();
    // An unlisted key stays English.
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
  });

  it('calls onClose when cancel is pressed', async () => {
    const user = userEvent.setup();
    const {onClose} = setup();

    await user.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('hides the change-image control unless onChangeImage is given', () => {
    setup();
    expect(screen.queryByRole('button', {name: 'Change image'})).not.toBeInTheDocument();
  });

  it('shows the change-image control when onChangeImage is given', () => {
    setup({onChangeImage: vi.fn()});
    expect(screen.getAllByRole('button', {name: 'Change image'}).length).toBeGreaterThan(0);
  });

  it('exposes every transform control with an accessible name', () => {
    setup();
    for (const name of ['Rotate left 90°', 'Rotate right 90°', 'Flip horizontal', 'Flip vertical', 'Zoom in', 'Zoom out', 'Reset']) {
      expect(screen.getByRole('button', {name})).toBeInTheDocument();
    }
  });

  it('disables both footer actions while a crop is being produced', async () => {
    const user = userEvent.setup();
    let release: (() => void) | undefined;
    const onApply = vi.fn(() => new Promise<void>((resolve) => {
      release = resolve;
    }));

    render(<ImageEditor open imageSrc="blob:fake" onClose={vi.fn()} onApply={onApply} />);

    await user.click(screen.getByRole('button', {name: 'Apply'}));

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled();
    });

    release?.();
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `pnpm --filter @bohar/image-editor test`
Expected: FAIL, "Failed to resolve import './ImageEditor'".

- [ ] **Step 3: Port the component**

Copy `ImageEditor.tsx` from the app, then make exactly these changes:

1. Delete `import {useTranslation} from '@/hooks/useTranslation';`. Add `import {ImageEditorLabelsProvider, useLabels} from './i18n';`.
2. Replace the destructured props `title, applyLabel, cancelLabel, changeImageLabel` with `labels`.
3. Split the component in two so the provider wraps the body. The exported `ImageEditor` renders `<ImageEditorLabelsProvider labels={labels}><ImageEditorBody … /></ImageEditorLabelsProvider>`; `ImageEditorBody` is the old function with `const labels = useLabels();` at the top and no `labels` prop of its own. Doing it this way rather than threading `labels` down means `ControlSection` and any future leaf reads strings from context, the same way the table does it.
4. Replace every `t('imageEditor.X')` with `labels.X`, and every `xLabel ?? t('imageEditor.x')` with `labels.x`.
5. Give every icon-only `IconButton` an `aria-label` equal to the label already in its `Tooltip`. A `Tooltip` alone does not name a button for `getByRole`, which is what the a11y story test in Task 6 will otherwise fail on.

The header block becomes:

```tsx
export function ImageEditor({labels, ...rest}: Readonly<ImageEditorProps>) {
  return (
    <ImageEditorLabelsProvider labels={labels}>
      <ImageEditorBody {...rest} />
    </ImageEditorLabelsProvider>
  );
}
```

and each control follows this shape:

```tsx
<Tooltip title={labels.rotateLeft}>
  <IconButton aria-label={labels.rotateLeft} onClick={rotateLeft} size="small">
    <RotateLeft fontSize="small" />
  </IconButton>
</Tooltip>
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @bohar/image-editor test`
Expected: PASS, 16 tests across both files.

- [ ] **Step 5: Write the real entry point**

Replace `packages/image-editor/src/index.ts`:

```ts
/**
 * Public surface.
 *
 * `ImageEditor` is the product: a dialog that takes an image source and hands back a
 * cropped blob. `useImageEditor` is the same behaviour without the MUI shell, for a
 * consumer who wants their own chrome around `react-easy-crop`.
 *
 * The internals (the control sections, the toolbar) stay unexported: rearranging them
 * would otherwise be a breaking change for someone.
 */
export {ImageEditor} from './ImageEditor';
export {useImageEditor} from './useImageEditor';
export {DEFAULT_LABELS, ImageEditorLabelsProvider, useLabels} from './i18n';
export type {ImageEditorLabels} from './i18n';
export type {
  CropArea,
  ImageEditorProps,
  ImageEditorResult,
  ImageEditorState,
  OutputFormat,
  UseImageEditorOptions,
} from './types';
```

- [ ] **Step 6: Build and typecheck**

Run: `pnpm --filter @bohar/image-editor build && pnpm --filter @bohar/image-editor typecheck`
Expected: both PASS. Check `dist/` contains `index.js`, `ImageEditor.js`, `useImageEditor.js`, `i18n/` and matching `.d.ts` files, and that no `node_modules` path appears in any of them (that is what the `external` predicate in `vite.config.ts` guarantees).

- [ ] **Step 7: Hand off for commit**

```
feat(image-editor): port the dialog, labels instead of t()
```

---

### Task 6: Story, a11y, and the showcase

**Files:**

- Create: `packages/image-editor/src/ImageEditor.stories.tsx`
- Modify: `apps/storybook/package.json`

**Interfaces:**

- Consumes: the package's public surface from Task 5.
- Produces: stories that Storybook picks up with no registration step, and a `play` function that is the interaction test.

- [ ] **Step 1: Add the package to the showcase's dependencies**

In `apps/storybook/package.json`, in `dependencies`, alongside `@bohar/datatable`:

```json
    "@bohar/image-editor": "workspace:*"
```

Then run `pnpm install`.

The `stories` globs in `.storybook/main.ts` already read `../../../packages/*/src/**/*.stories.@(ts|tsx)`, so nothing else needs registering.

- [ ] **Step 2: Write the stories**

`packages/image-editor/src/ImageEditor.stories.tsx`:

```tsx
import Button from '@mui/material/Button';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, userEvent, within} from 'storybook/test';
import {useState} from 'react';

import {ImageEditor} from './ImageEditor';
import type {ImageEditorLabels, ImageEditorResult} from './index';

// An inline SVG data URL rather than a network image: a story that fetches is a story that
// fails in CI the first time the network is slow.
const SAMPLE =
  'data:image/svg+xml;base64,' +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
       <rect width="800" height="600" fill="#4b6bfb"/>
       <circle cx="400" cy="300" r="180" fill="#fbbf24"/>
     </svg>`,
  );

const meta = {
  title: 'Image editor/ImageEditor',
  component: ImageEditor,
  parameters: {layout: 'centered'},
} satisfies Meta<typeof ImageEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

function Harness({labels, onApply}: {labels?: Partial<ImageEditorLabels>; onApply?: (r: ImageEditorResult) => void}) {
  const [open, setOpen] = useState(true);
  const [size, setSize] = useState<string | null>(null);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open editor</Button>
      {size && <p data-testid="result">{size}</p>}
      <ImageEditor
        open={open}
        imageSrc={SAMPLE}
        labels={labels}
        onClose={() => setOpen(false)}
        onApply={(result) => {
          setSize(`${result.width}×${result.height}`);
          setOpen(false);
          onApply?.(result);
        }}
      />
    </>
  );
}

export const Default: Story = {
  args: {open: true, imageSrc: SAMPLE, onClose: () => {}, onApply: () => {}},
  render: () => <Harness />,
  play: async ({canvasElement}) => {
    // The dialog renders into a portal, so query the document body rather than the canvas.
    const dialog = within(canvasElement.ownerDocument.body);

    await expect(await dialog.findByText('Edit image')).toBeVisible();
    await userEvent.click(dialog.getByRole('button', {name: 'Rotate right 90°'}));
    await expect(dialog.getByText('90°')).toBeVisible();
    await userEvent.click(dialog.getByRole('button', {name: 'Reset'}));
    await expect(dialog.getByText('0°')).toBeVisible();
  },
};

const GERMAN: Partial<ImageEditorLabels> = {
  title: 'Bild bearbeiten',
  apply: 'Übernehmen',
  cancel: 'Abbrechen',
  reset: 'Zurücksetzen',
  rotateLeft: 'Nach links drehen',
  rotateRight: 'Nach rechts drehen',
};

export const Translated: Story = {
  args: {open: true, imageSrc: SAMPLE, onClose: () => {}, onApply: () => {}},
  render: () => <Harness labels={GERMAN} />,
  play: async ({canvasElement}) => {
    const dialog = within(canvasElement.ownerDocument.body);

    await expect(await dialog.findByText('Bild bearbeiten')).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Übernehmen'})).toBeVisible();
    // Untranslated keys stay English, which is the fallback contract.
    await expect(dialog.getByRole('button', {name: 'Flip horizontal'})).toBeVisible();
  },
};

export const Widescreen: Story = {
  args: {open: true, imageSrc: SAMPLE, onClose: () => {}, onApply: () => {}, aspectRatio: 16 / 9},
  render: () => (
    <ImageEditor open imageSrc={SAMPLE} aspectRatio={16 / 9} onClose={() => {}} onApply={() => {}} />
  ),
  play: async ({canvasElement}) => {
    const dialog = within(canvasElement.ownerDocument.body);
    await expect(await dialog.findByText('16:9')).toBeVisible();
  },
};
```

- [ ] **Step 3: Run the story tests**

Run: `pnpm --filter @bohar/storybook test`
Expected: PASS. Every story also runs through axe, because `.storybook/preview.tsx` sets `parameters.a11y.test = 'error'`.

If a story fails on "Buttons must have discernible text", Step 5 of Task 5 was skipped for one of the icon buttons. Fix the component, not the story.

- [ ] **Step 4: Look at it in both themes**

Run: `pnpm storybook`
Open <http://localhost:6006>, find "Image editor/ImageEditor", and switch the theme toolbar between light and dark. The crop overlay, the slider track, and the aspect-ratio chip all need to stay legible in both. Anything that does not is a hardcoded colour that survived the port; replace it with a theme token.

- [ ] **Step 5: Hand off for commit**

```
feat(image-editor): stories, interaction tests, a11y
```

---

### Task 7: README, changeset, and close the plan

**Files:**

- Create: `packages/image-editor/README.md`
- Create: `.changeset/<generated-name>.md`
- Modify: `README.md` (the root package table)
- Modify: `docs/superpowers/plans/README.md`
- Move: this file from `docs/superpowers/plans/open/` to `docs/superpowers/plans/done/`

- [ ] **Step 1: Write the package README**

Open with what the package does and who it is for, not with install instructions. Follow the shape of `packages/datatable/README.md`: what it is, what makes it different, install with the peer table, setup, a worked example, the labels contract, and a short note that it is not published yet.

The peer table has seven rows and every one is required:

| Peer                                         | Needed for                          |
| -------------------------------------------- | ----------------------------------- |
| `react` ^19, `react-dom` ^19                 | everything                          |
| `@mui/material` ^7, `@mui/icons-material` ^7 | the dialog, controls and icons      |
| `@emotion/react` ^11, `@emotion/styled` ^11  | MUI's styling engine                |
| `react-easy-crop` ^5                         | the crop surface itself             |

Include the one thing a consumer will get wrong: `imageSrc` must be same-origin or a
`blob:`/`data:` URL. The hook sets `crossOrigin = 'anonymous'` on the image it decodes, so a
cross-origin URL without CORS headers taints the canvas and `toBlob` throws a
`SecurityError` at apply time rather than at load time.

- [ ] **Step 2: Add the package to the root README table**

In `README.md`, under "## Packages", add a row:

```
| `packages/image-editor` | Crop, zoom, rotate and flip an image in a MUI dialog | ported, not published |
```

- [ ] **Step 3: Write the changeset**

Run: `pnpm changeset`
Select `@bohar/image-editor`, choose **minor** (the package is new and pre-1.0, so minor is the first real entry), and write the line a consumer's changelog will show. Not "extract ImageEditor from skipwash-admin", which means nothing to a stranger. Something like:

```
Initial release. A MUI dialog for cropping, zooming, rotating and flipping an image,
returning a Blob or a data URL. Every string is overridable through `labels`.
```

- [ ] **Step 4: Run the full gate**

Run: `pnpm validate:ci`
Expected: PASS. This is oxlint, ESLint, the format check, typecheck, build, and every test in the workspace.

If oxfmt rewrites files, that is expected on ported code: the app repo and this one do not share a formatter config. Let it rewrite, then run the gate again.

- [ ] **Step 5: Close the plan**

Move this file:

```bash
mv docs/superpowers/plans/open/2026-08-28-image-editor-package.md \
   docs/superpowers/plans/done/2026-08-28-image-editor-package.md
```

In `docs/superpowers/plans/README.md`, delete the image-editor row from "Open" and add it to "Done" with today's date. Fix the link path in the same edit: it now points at `done/`.

- [ ] **Step 6: Hand off for commit**

```
feat(image-editor): README, changeset, first release prep
```

---

## Out of scope

**Adopting the package in skipwash-admin.** The app cannot install `@bohar/image-editor`
until it is published, and publishing needs the npm org that
[`docs/decisions/open-questions.md`](../../../decisions/open-questions.md) is still waiting
on. When that lands, the app change is: delete `src/components/ImageEditor/`, install the
package, and pass `labels` built from the existing `imageEditor.*` block in
`src/lib/i18n/locales/en.json` so nothing user-visible changes.

**The other three forks.** Same story, and doing all four at once is how a port turns into
four half-migrations.
