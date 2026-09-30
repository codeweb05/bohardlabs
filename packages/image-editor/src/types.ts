import type {ImageEditorLabels} from './labels';

/** A crop ratio: `'free'`, one of the named ratios, or width ÷ height as a number. */
export type CropRatio = 'free' | '1:1' | '4:3' | '16:9' | number;

export type CropShape = 'rect' | 'circle';

export type OutputType = 'image/jpeg' | 'image/png' | 'image/webp';

/**
 * Which tools the editor shows. Every entry is `boolean | options`: `false` removes the
 * tool and its controls, `true` uses its defaults. Crop, zoom, rotate and flip are on by
 * default; the rest are off until asked for.
 */
export interface ImageEditorFeatures {
  /** The first ratio is the starting one. `shape: 'circle'` locks the ratio to 1:1. */
  crop?: boolean | {ratios?: CropRatio[]; shape?: CropShape};
  /** Zoom 1 is the largest crop of the current shape. `slider` adds a visible control. */
  zoom?: boolean | {min?: number; max?: number; slider?: boolean};
  /** 90° steps. */
  rotate?: boolean;
  flip?: boolean | {horizontal?: boolean; vertical?: boolean};
  /** A "Replace image" button that opens the picker. */
  replace?: boolean;
  /** Fine rotation within ±`range` degrees (default 45). */
  straighten?: boolean | {range?: number};
  adjust?: boolean | {brightness?: boolean; contrast?: boolean; saturation?: boolean; presets?: boolean};
  /** Undo and redo, as buttons and as Ctrl/Cmd + Z. */
  history?: boolean;
}

/** Rules a source must pass before it is shown. */
export interface ImageEditorInput {
  /** MIME types. Default: JPEG, PNG, WebP and GIF. */
  accept?: string[];
  minWidth?: number;
  minHeight?: number;
  maxBytes?: number;
}

/** What the produced file must look like. */
export interface ImageEditorOutput {
  /** Default: the source's type when it is JPEG, PNG or WebP, otherwise PNG; PNG for a circle. */
  type?: OutputType;
  /** 0 to 1, for JPEG and WebP. Default 0.92. */
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  /** The file is made to fit, or the editor reports `output-too-large`. */
  maxBytes?: number;
  /** Fills the corners of a circle when the type has no transparency. Default `'#ffffff'`. */
  background?: string;
  /** Without extension; the extension follows the type actually produced. Default `'image'`. */
  fileName?: string;
}

export interface ImageEditorResult {
  file: File;
  width: number;
  height: number;
  /** The type actually produced, which can differ from `output.type` where a browser cannot encode it. */
  type: string;
}

export type ImageEditorErrorCode = 'unsupported-type' | 'too-small' | 'too-large' | 'load-failed' | 'output-too-large';

export interface ImageEditorError {
  code: ImageEditorErrorCode;
  cause?: unknown;
}

export interface ImageEditorProps {
  open: boolean;
  /** `null` shows the built-in picker. A change while open loads the new image and clears history. */
  source: File | Blob | string | null;
  /** Cancel, Escape, the close button and the backdrop. */
  onClose: () => void;
  /**
   * Receives the finished file. While a returned promise is pending the editor is busy;
   * when it rejects the editor stays open with the edits intact.
   */
  onApply: (result: ImageEditorResult) => void | Promise<void>;
  /** A source that failed the input rules or could not load, or an output that could not fit. */
  onError?: (error: ImageEditorError) => void;
  features?: ImageEditorFeatures;
  input?: ImageEditorInput;
  output?: ImageEditorOutput;
  labels?: Partial<ImageEditorLabels>;
}
