/**
 * The editor's geometry, with no DOM in it.
 *
 * A matrix is `[a, b, c, d]` acting on a column vector: `x' = a·x + b·y`, `y' = c·x + d·y`.
 * The y axis points down, so a positive angle turns clockwise on screen.
 *
 * The **frame** is the image after its orientation (quarter turns and flips): what the user
 * sees before straightening. A frame point is `cF + s·Rot(θ)·O·(p − cI)`, where `cI` and
 * `cF` are the image and frame centres and `s` is the smallest scale at which the
 * straightened image still covers the whole frame. The crop lives in frame pixels.
 */

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

export const IDENTITY: Matrix2 = [1, 0, 0, 1];
export const ROTATE_RIGHT: Matrix2 = [0, -1, 1, 0];
export const ROTATE_LEFT: Matrix2 = [0, 1, -1, 0];
export const FLIP_HORIZONTAL: Matrix2 = [-1, 0, 0, 1];
export const FLIP_VERTICAL: Matrix2 = [1, 0, 0, -1];

// Adding zero turns -0 into 0, so two orientations that are the same compare equal.
export function multiply(a: Matrix2, b: Matrix2): Matrix2 {
  return [
    a[0] * b[0] + a[1] * b[2] + 0,
    a[0] * b[1] + a[1] * b[3] + 0,
    a[2] * b[0] + a[3] * b[2] + 0,
    a[2] * b[1] + a[3] * b[3] + 0,
  ];
}

export function apply(m: Matrix2, p: Point): Point {
  return {x: m[0] * p.x + m[1] * p.y, y: m[2] * p.x + m[3] * p.y};
}

export function invert(m: Matrix2): Matrix2 {
  const det = m[0] * m[3] - m[1] * m[2];
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det];
}

export function rotation(degrees: number): Matrix2 {
  const r = (degrees * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return [cos, -sin, sin, cos];
}

export function scale(m: Matrix2, k: number): Matrix2 {
  return [m[0] * k, m[1] * k, m[2] * k, m[3] * k];
}

export function frameSize(image: Size, orientation: Matrix2): Size {
  return orientation[0] === 0 ? {width: image.height, height: image.width} : {width: image.width, height: image.height};
}

export function coverScale(frame: Size, degrees: number): number {
  if (degrees === 0) return 1;
  const r = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(r));
  const sin = Math.abs(Math.sin(r));
  const {width: w, height: h} = frame;
  return Math.max((w * cos + h * sin) / w, (w * sin + h * cos) / h);
}

/** `s·Rot(θ)·O`: image offsets from its centre to frame offsets from the frame centre. */
export function linearOf(image: Size, orientation: Matrix2, degrees: number): Matrix2 {
  const frame = frameSize(image, orientation);
  return scale(multiply(rotation(degrees), orientation), coverScale(frame, degrees));
}

export function toFrame(image: Size, orientation: Matrix2, degrees: number, p: Point): Point {
  const frame = frameSize(image, orientation);
  const offset = apply(linearOf(image, orientation, degrees), {x: p.x - image.width / 2, y: p.y - image.height / 2});
  return {x: frame.width / 2 + offset.x, y: frame.height / 2 + offset.y};
}

/** The widest crop of this shape that fits in the frame. */
export function maxCropWidth(frame: Size, aspect: number): number {
  return Math.min(frame.width, frame.height * aspect);
}

/** 1 for the largest crop of the current shape, 2 for one half as wide, and so on. */
export function zoomOf(frame: Size, crop: Rect): number {
  return maxCropWidth(frame, crop.width / crop.height) / crop.width;
}

/** Shrinks a rect that is too big (about its centre, keeping its shape), then moves it inside. */
export function clampRect(rect: Rect, frame: Size): Rect {
  const shrink = Math.min(1, frame.width / rect.width, frame.height / rect.height);
  const width = rect.width * shrink;
  const height = rect.height * shrink;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  return {
    x: Math.min(Math.max(cx - width / 2, 0), frame.width - width),
    y: Math.min(Math.max(cy - height / 2, 0), frame.height - height),
    width,
    height,
  };
}

/** The largest centred crop of a shape, or the whole frame for a free crop. */
/** How close two stage coordinates are before an edge counts as not having moved. */
const EDGE_EPSILON = 1e-6;

/**
 * Where along one axis a resize is pinned, as a fraction of the new extent: 0 when the low
 * edge stayed put, 1 when the high edge did, and the middle when a fixed shape grew both ways.
 */
function anchorOf(low: number, extent: number, previousLow: number, previousExtent: number): number {
  const lowMoved = Math.abs(low - previousLow) > EDGE_EPSILON;
  const highMoved = Math.abs(low + extent - previousLow - previousExtent) > EDGE_EPSILON;
  if (lowMoved === highMoved) return 0.5;
  return lowMoved ? 1 : 0;
}

/**
 * How far an extent can be scaled before it no longer fits in `0..limit`. Pinned at an edge,
 * it has the room from that edge to the far side. Grown about its middle, nothing is pinned
 * and it may slide, so it has the whole limit.
 */
function axisRoom(low: number, extent: number, anchor: number, limit: number): number {
  if (anchor === 0.5) return limit / extent;
  return anchor === 0 ? (limit - low) / extent : (low + extent) / extent;
}

/** Where a scaled extent starts: against its pinned edge, or about its middle and slid back inside. */
function axisStart(low: number, extent: number, scaled: number, anchor: number, limit: number): number {
  const start = low + anchor * (extent - scaled);
  return anchor === 0.5 ? Math.min(Math.max(start, 0), limit - scaled) : start;
}

/**
 * Keeps a resized rectangle inside the frame without moving the edges the gesture left alone.
 * `clampRect` is the wrong tool for a resize: it shifts the whole rectangle back inside, so
 * dragging one edge past the image would push the opposite edge away from where it was.
 *
 * A free shape is cut off at the frame. A `locked` one keeps its ratio, so it is scaled
 * about whatever stayed put, which `previous` (the rectangle before the gesture) tells. An
 * edge handle grows a locked shape both ways on the other axis, and there it may slide.
 */
export function fitResize(rect: Rect, previous: Rect, frame: Size, locked: boolean): Rect {
  const left = Math.max(rect.x, 0);
  const top = Math.max(rect.y, 0);
  const right = Math.min(rect.x + rect.width, frame.width);
  const bottom = Math.min(rect.y + rect.height, frame.height);
  const cut = {x: left, y: top, width: right - left, height: bottom - top};
  if (cut.width === rect.width && cut.height === rect.height) return rect;
  if (!locked) return cut;

  const ax = anchorOf(rect.x, rect.width, previous.x, previous.width);
  const ay = anchorOf(rect.y, rect.height, previous.y, previous.height);
  const shrink = Math.min(
    1,
    axisRoom(rect.x, rect.width, ax, frame.width),
    axisRoom(rect.y, rect.height, ay, frame.height),
  );
  const width = rect.width * shrink;
  const height = rect.height * shrink;
  return {
    x: axisStart(rect.x, rect.width, width, ax, frame.width),
    y: axisStart(rect.y, rect.height, height, ay, frame.height),
    width,
    height,
  };
}

export function largestCrop(frame: Size, aspect: number | null): Rect {
  if (aspect === null) return {x: 0, y: 0, width: frame.width, height: frame.height};
  const width = maxCropWidth(frame, aspect);
  const height = Math.min(frame.height, width / aspect);
  return {x: (frame.width - width) / 2, y: (frame.height - height) / 2, width, height};
}

export interface StageLayout {
  /** Stage pixels per frame pixel. */
  k: number;
  /** The crop on the stage. */
  selection: Rect;
  /** The whole frame on the stage; a resize must stay inside it. */
  frame: Rect;
  /**
   * CSS `matrix(a, b, c, d, e, f)` for an image element placed at the stage origin at its
   * natural size, with the default centre transform-origin.
   */
  matrix: [number, number, number, number, number, number];
}

/** Fits the crop into the stage, centred, and places the image around it. */
export function layoutStage(
  stage: Size,
  padding: number,
  image: Size,
  orientation: Matrix2,
  degrees: number,
  crop: Rect,
): StageLayout {
  const available = {
    width: Math.max(1, stage.width - 2 * padding),
    height: Math.max(1, stage.height - 2 * padding),
  };
  const k = Math.min(available.width / crop.width, available.height / crop.height);
  const centre = {x: stage.width / 2, y: stage.height / 2};
  const cropCentre = {x: crop.x + crop.width / 2, y: crop.y + crop.height / 2};
  const frame = frameSize(image, orientation);
  const m = scale(linearOf(image, orientation, degrees), k);
  return {
    k,
    selection: {
      x: centre.x - (k * crop.width) / 2,
      y: centre.y - (k * crop.height) / 2,
      width: k * crop.width,
      height: k * crop.height,
    },
    frame: {
      x: centre.x - k * cropCentre.x,
      y: centre.y - k * cropCentre.y,
      width: k * frame.width,
      height: k * frame.height,
    },
    matrix: [
      m[0],
      m[2],
      m[1],
      m[3],
      centre.x + k * (frame.width / 2 - cropCentre.x) - image.width / 2,
      centre.y + k * (frame.height / 2 - cropCentre.y) - image.height / 2,
    ],
  };
}

/** A rect on the stage back in frame pixels. */
export function stageToCrop(layout: StageLayout, rect: Rect): Rect {
  return {
    x: (rect.x - layout.frame.x) / layout.k,
    y: (rect.y - layout.frame.y) / layout.k,
    width: rect.width / layout.k,
    height: rect.height / layout.k,
  };
}
