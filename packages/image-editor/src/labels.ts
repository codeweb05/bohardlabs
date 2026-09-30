import type {CropRatio} from './types';

/**
 * Every word the editor puts on screen or announces. Pass a partial object as the
 * `labels` prop; missing keys fall back to the English defaults.
 */
export interface ImageEditorLabels {
  title: string;
  apply: string;
  /** Apply's label while `onApply` is pending. */
  applying: string;
  /** Shown when `onApply` rejects. */
  applyFailed: string;
  cancel: string;
  close: string;
  /** Apply's label in the mobile header. */
  done: string;
  reset: string;
  undo: string;
  redo: string;
  replace: string;
  loading: string;
  /** Tabs, shown only when adjustments are enabled. */
  cropTab: string;
  adjustTab: string;
  /** The ratio control's group label, and how each ratio reads. */
  ratio: string;
  ratioName: (ratio: CropRatio) => string;
  rotateLeft: string;
  rotateRight: string;
  flipHorizontal: string;
  flipVertical: string;
  straighten: string;
  zoom: string;
  brightness: string;
  contrast: string;
  saturation: string;
  /** The adjustment picker's group label. */
  adjustment: string;
  presets: string;
  presetOriginal: string;
  presetVivid: string;
  presetMono: string;
  presetFade: string;
  presetDramatic: string;
  /** The focusable canvas, and the key help it points at. */
  canvas: string;
  keyHelp: string;
  /** The picker, shown when there is no source or when replacing it. */
  pickerPrompt: string;
  pickerChoose: string;
  /** Live-region announcements. */
  rotated: (degrees: number) => string;
  flipped: string;
  straightened: (degrees: number) => string;
  cropChanged: (width: number, height: number) => string;
  zoomChanged: (percent: number) => string;
  undone: string;
  redone: string;
  resetDone: string;
  /** One message per error code. */
  errorUnsupportedType: string;
  errorTooSmall: string;
  errorTooLarge: string;
  errorLoadFailed: string;
  errorOutputTooLarge: string;
}

export const DEFAULT_IMAGE_EDITOR_LABELS: ImageEditorLabels = {
  title: 'Edit image',
  apply: 'Apply',
  applying: 'Applying…',
  applyFailed: 'Could not save the image. Try again.',
  cancel: 'Cancel',
  close: 'Close',
  done: 'Done',
  reset: 'Reset',
  undo: 'Undo',
  redo: 'Redo',
  replace: 'Replace image',
  loading: 'Loading image…',
  cropTab: 'Crop',
  adjustTab: 'Adjust',
  ratio: 'Aspect ratio',
  ratioName: (ratio) => {
    if (ratio === 'free') return 'Free';
    return typeof ratio === 'number' ? String(Number(ratio.toFixed(2))) : ratio;
  },
  rotateLeft: 'Rotate left',
  rotateRight: 'Rotate right',
  flipHorizontal: 'Flip horizontally',
  flipVertical: 'Flip vertically',
  straighten: 'Straighten',
  zoom: 'Zoom',
  brightness: 'Brightness',
  contrast: 'Contrast',
  saturation: 'Saturation',
  adjustment: 'Adjustment',
  presets: 'Presets',
  presetOriginal: 'Original',
  presetVivid: 'Vivid',
  presetMono: 'Mono',
  presetFade: 'Fade',
  presetDramatic: 'Dramatic',
  canvas: 'Image crop area',
  keyHelp:
    'Arrow keys move the crop, Shift and arrow keys resize it, hold Alt for small steps. Plus and minus zoom, R rotates.',
  pickerPrompt: 'Drop an image here',
  pickerChoose: 'Choose image',
  rotated: (degrees) => `Rotated ${degrees}°`,
  flipped: 'Flipped',
  straightened: (degrees) => `Straightened ${degrees}°`,
  cropChanged: (width, height) => `Crop ${width} × ${height}`,
  zoomChanged: (percent) => `Zoom ${percent}%`,
  undone: 'Undone',
  redone: 'Redone',
  resetDone: 'Reset',
  errorUnsupportedType: 'This file type is not supported.',
  errorTooSmall: 'This image is too small.',
  errorTooLarge: 'This file is too large.',
  errorLoadFailed: 'The image could not be loaded.',
  errorOutputTooLarge: 'The image cannot be made small enough to upload.',
};
