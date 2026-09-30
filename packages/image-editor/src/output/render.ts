import {frameOf, type EditorState} from '../state/editorState.js';
import {linearOf, type Size} from '../state/geometry.js';
import type {CropShape} from '../types.js';
import {filterString} from './filters.js';

/** Fits the crop inside the limits without ever enlarging it. */
export function outputSize(crop: Size, maxWidth?: number, maxHeight?: number): Size {
  const factor = Math.min(
    1,
    (maxWidth ?? Number.POSITIVE_INFINITY) / crop.width,
    (maxHeight ?? Number.POSITIVE_INFINITY) / crop.height,
  );
  return {
    width: Math.max(1, Math.round(crop.width * factor)),
    height: Math.max(1, Math.round(crop.height * factor)),
  };
}

/**
 * Draws the edited image in one pass, with the same mapping the preview uses: output
 * pixels ← crop ← frame ← `s·Rot(θ)·O` ← image. The adjustments are drawn in the same pass
 * through `ctx.filter`.
 */
export function renderState(
  image: CanvasImageSource,
  state: EditorState,
  options: {shape: CropShape; width: number; height: number; background: string | null},
): HTMLCanvasElement {
  const {width, height} = options;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No 2d context');

  const {crop} = state;
  const frame = frameOf(state);
  const linear = linearOf(state.image, state.orientation, state.straighten);

  if (options.shape === 'circle') {
    context.beginPath();
    context.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    context.clip();
  }
  if (options.background !== null) {
    context.fillStyle = options.background;
    context.fillRect(0, 0, width, height);
  }
  context.scale(width / crop.width, height / crop.height);
  context.translate(-crop.x + frame.width / 2, -crop.y + frame.height / 2);
  context.transform(linear[0], linear[2], linear[1], linear[3], 0, 0);
  context.translate(-state.image.width / 2, -state.image.height / 2);
  context.filter = filterString(state.adjust);
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, state.image.width, state.image.height);
  return canvas;
}
