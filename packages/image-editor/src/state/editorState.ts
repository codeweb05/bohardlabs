import type {ResolvedFeatures} from '../features.js';
import {parseRatio} from '../features.js';
import {
  FLIP_HORIZONTAL,
  FLIP_VERTICAL,
  IDENTITY,
  ROTATE_LEFT,
  ROTATE_RIGHT,
  apply,
  clampRect,
  frameSize,
  largestCrop,
  maxCropWidth,
  multiply,
  zoomOf,
  type Matrix2,
  type Rect,
  type Size,
} from './geometry.js';

export interface Adjustments {
  brightness: number;
  contrast: number;
  saturation: number;
}

export const NEUTRAL_ADJUSTMENTS: Adjustments = {brightness: 0, contrast: 0, saturation: 0};

export interface EditorState {
  /** The working copy's size in pixels. */
  image: Size;
  /** Quarter turns and flips, as a dihedral matrix. */
  orientation: Matrix2;
  /** Degrees, clockwise. */
  straighten: number;
  /** In frame pixels. */
  crop: Rect;
  /** Width ÷ height the crop is held to, or `null` for free. */
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

export function initialEditorState(image: Size, features: ResolvedFeatures): EditorState {
  const first = features.crop.ratios[0];
  const ratio = features.crop.enabled && first !== undefined ? parseRatio(first) : null;
  const zoom = features.zoom
    ? {min: features.zoom.min, max: features.zoom.max}
    : {min: 1, max: Number.POSITIVE_INFINITY};
  const state: EditorState = {
    image,
    orientation: IDENTITY,
    straighten: 0,
    crop: largestCrop(image, ratio),
    ratio,
    zoom,
    adjust: NEUTRAL_ADJUSTMENTS,
  };
  return {...state, crop: constrain(state, state.crop)};
}

export function frameOf(state: EditorState): Size {
  return frameSize(state.image, state.orientation);
}

export function currentZoom(state: EditorState): number {
  return zoomOf(frameOf(state), state.crop);
}

function centreOf(rect: Rect) {
  return {x: rect.x + rect.width / 2, y: rect.y + rect.height / 2};
}

function around(centre: {x: number; y: number}, width: number, height: number): Rect {
  return {x: centre.x - width / 2, y: centre.y - height / 2, width, height};
}

/** A crop of the same shape and centre at a given zoom, clamped to the zoom range and the frame. */
function atZoom(state: EditorState, crop: Rect, zoom: number): Rect {
  const frame = frameOf(state);
  const aspect = crop.width / crop.height;
  const z = Math.min(state.zoom.max, Math.max(state.zoom.min, zoom));
  const width = maxCropWidth(frame, aspect) / z;
  return clampRect(around(centreOf(crop), width, width / aspect), frame);
}

function constrain(state: EditorState, crop: Rect): Rect {
  const frame = frameOf(state);
  const zoom = zoomOf(frame, crop);
  if (zoom < state.zoom.min || zoom > state.zoom.max) return atZoom(state, crop, zoom);
  return clampRect(crop, frame);
}

function clampAdjust(value: number): number {
  return Math.min(100, Math.max(-100, value));
}

function rotate(state: EditorState, direction: 1 | -1): EditorState {
  const turn = direction === 1 ? ROTATE_RIGHT : ROTATE_LEFT;
  const before = frameOf(state);
  const orientation = multiply(turn, state.orientation);
  const after = frameSize(state.image, orientation);
  const c = centreOf(state.crop);
  const offset = apply(turn, {x: c.x - before.width / 2, y: c.y - before.height / 2});
  const crop = around(
    {x: after.width / 2 + offset.x, y: after.height / 2 + offset.y},
    state.crop.height,
    state.crop.width,
  );
  return {
    ...state,
    orientation,
    crop: clampRect(crop, after),
    ratio: state.ratio === null ? null : 1 / state.ratio,
  };
}

function flip(state: EditorState, axis: 'horizontal' | 'vertical'): EditorState {
  const frame = frameOf(state);
  const {crop} = state;
  return {
    ...state,
    orientation: multiply(axis === 'horizontal' ? FLIP_HORIZONTAL : FLIP_VERTICAL, state.orientation),
    // Mirroring a turned image turns it the other way, so the view stays a mirror image
    // of what the user saw.
    straighten: -state.straighten + 0,
    crop:
      axis === 'horizontal'
        ? {...crop, x: frame.width - crop.x - crop.width}
        : {...crop, y: frame.height - crop.y - crop.height},
  };
}

function resize(state: EditorState, dw: number, dh: number): Rect {
  const {crop, ratio} = state;
  let width = Math.max(1, crop.width + dw);
  let height = Math.max(1, crop.height + dh);
  if (ratio !== null) {
    if (dw === 0) width = height * ratio;
    else height = width / ratio;
  }
  return constrain(state, {x: crop.x, y: crop.y, width, height});
}

function setRatio(state: EditorState, ratio: number | null): EditorState {
  if (ratio === null) return {...state, ratio};
  const width = maxCropWidth(frameOf(state), ratio) / currentZoom(state);
  const crop = around(centreOf(state.crop), width, width / ratio);
  return {...state, ratio, crop: constrain(state, crop)};
}

function next(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'rotate':
      return rotate(state, action.direction);
    case 'flip':
      return flip(state, action.axis);
    case 'straighten':
      return {...state, straighten: action.degrees};
    case 'setCrop':
      return {...state, crop: constrain(state, action.crop)};
    case 'moveCrop':
      return {
        ...state,
        crop: clampRect({...state.crop, x: state.crop.x + action.dx, y: state.crop.y + action.dy}, frameOf(state)),
      };
    case 'resizeCrop':
      return {...state, crop: resize(state, action.dw, action.dh)};
    case 'zoomBy':
      return {...state, crop: atZoom(state, state.crop, currentZoom(state) * action.factor)};
    case 'zoomTo':
      return {...state, crop: atZoom(state, state.crop, action.zoom)};
    case 'setRatio':
      return setRatio(state, action.ratio);
    case 'adjust': {
      const merged = {...state.adjust, ...action.values};
      return {
        ...state,
        adjust: {
          brightness: clampAdjust(merged.brightness),
          contrast: clampAdjust(merged.contrast),
          saturation: clampAdjust(merged.saturation),
        },
      };
    }
    case 'replace':
      return action.state;
  }
}

const EPSILON = 1e-6;

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < EPSILON || a === b;
}

export function sameState(a: EditorState, b: EditorState): boolean {
  return (
    a === b ||
    (a.orientation.every((value, i) => value === b.orientation[i]) &&
      near(a.straighten, b.straighten) &&
      near(a.crop.x, b.crop.x) &&
      near(a.crop.y, b.crop.y) &&
      near(a.crop.width, b.crop.width) &&
      near(a.crop.height, b.crop.height) &&
      a.ratio === b.ratio &&
      a.adjust.brightness === b.adjust.brightness &&
      a.adjust.contrast === b.adjust.contrast &&
      a.adjust.saturation === b.adjust.saturation &&
      a.image.width === b.image.width &&
      a.image.height === b.image.height)
  );
}

/** Returns the same object when nothing changed, so history can skip it. */
export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const result = next(state, action);
  return sameState(state, result) ? state : result;
}
