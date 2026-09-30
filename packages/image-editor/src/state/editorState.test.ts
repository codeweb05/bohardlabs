import {describe, expect, it} from 'vitest';

import {resolveFeatures} from '../features.js';
import {
  NEUTRAL_ADJUSTMENTS,
  currentZoom,
  editorReducer,
  frameOf,
  initialEditorState,
  sameState,
  type EditorAction,
  type EditorState,
} from './editorState.js';
import {IDENTITY, apply, invert, linearOf, toFrame, type Point} from './geometry.js';

const image = {width: 400, height: 200};
const base = initialEditorState(image, resolveFeatures({crop: {ratios: ['free']}}));

function run(state: EditorState, ...actions: EditorAction[]): EditorState {
  return actions.reduce(editorReducer, state);
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Where an image pixel lands in the frame, for comparing what the user sees. */
function seen(state: EditorState, p: Point): Point {
  return toFrame(state.image, state.orientation, state.straighten, p);
}

describe('initialEditorState', () => {
  it('starts on the largest crop of the first ratio', () => {
    const state = initialEditorState(image, resolveFeatures({crop: {ratios: ['1:1', 'free']}}));
    expect(state.crop).toEqual({x: 100, y: 0, width: 200, height: 200});
    expect(state.ratio).toBe(1);
    expect(state.orientation).toEqual(IDENTITY);
    expect(state.adjust).toEqual(NEUTRAL_ADJUSTMENTS);
  });

  it('crops the whole image when crop is off', () => {
    const state = initialEditorState(image, resolveFeatures({crop: false}));
    expect(state.crop).toEqual({x: 0, y: 0, ...image});
    expect(state.ratio).toBeNull();
  });

  it('starts inside a minimum zoom', () => {
    const state = initialEditorState(image, resolveFeatures({zoom: {min: 2}, crop: {ratios: ['free']}}));
    expect(currentZoom(state)).toBeCloseTo(2, 9);
  });

  it('has no zoom ceiling when zoom is off', () => {
    expect(initialEditorState(image, resolveFeatures({zoom: false})).zoom).toEqual({
      min: 1,
      max: Number.POSITIVE_INFINITY,
    });
  });
});

describe('rotate', () => {
  it('swaps the frame and the crop, and keeps the crop over the same pixels', () => {
    const cropped = run(base, {type: 'setCrop', crop: {x: 10, y: 20, width: 200, height: 100}});
    const turned = run(cropped, {type: 'rotate', direction: 1});
    expect(frameOf(turned)).toEqual({width: 200, height: 400});
    expect(turned.crop.width).toBeCloseTo(100, 9);
    expect(turned.crop.height).toBeCloseTo(200, 9);
    // The image point under the crop's centre is still under it.
    const centreBefore = {x: 110, y: 70};
    const imagePoint = apply(invert(linearOf(image, cropped.orientation, 0)), {x: 110 - 200, y: 70 - 100});
    const p = {x: imagePoint.x + 200, y: imagePoint.y + 100};
    expect(distance(seen(cropped, p), centreBefore)).toBeLessThan(1e-6);
    expect(
      distance(seen(turned, p), {x: turned.crop.x + turned.crop.width / 2, y: turned.crop.y + turned.crop.height / 2}),
    ).toBeLessThan(1e-6);
  });

  it('inverts the ratio', () => {
    const state = run(base, {type: 'setRatio', ratio: 4 / 3}, {type: 'rotate', direction: -1});
    expect(state.ratio).toBeCloseTo(3 / 4, 9);
  });

  it('comes back after four turns', () => {
    const r: EditorAction = {type: 'rotate', direction: 1};
    expect(sameState(run(base, r, r, r, r), base)).toBe(true);
  });
});

describe('flip', () => {
  it('mirrors the crop inside the frame', () => {
    const state = run(base, {type: 'setCrop', crop: {x: 10, y: 20, width: 200, height: 100}});
    expect(run(state, {type: 'flip', axis: 'horizontal'}).crop).toEqual({x: 190, y: 20, width: 200, height: 100});
    expect(run(state, {type: 'flip', axis: 'vertical'}).crop).toEqual({x: 10, y: 80, width: 200, height: 100});
  });

  it('acts on what the user sees after straighten and rotate', () => {
    const straight = run(base, {type: 'straighten', degrees: 10}, {type: 'rotate', direction: 1});
    const flipped = run(straight, {type: 'flip', axis: 'horizontal'});
    const frame = frameOf(straight);
    for (const p of [
      {x: 0, y: 0},
      {x: 400, y: 0},
      {x: 150, y: 170},
    ]) {
      const before = seen(straight, p);
      expect(distance(seen(flipped, p), {x: frame.width - before.x, y: before.y})).toBeLessThan(1e-6);
    }
    expect(flipped.straighten).toBe(-10);
  });
});

describe('crop', () => {
  it('clamps a crop set outside the frame', () => {
    expect(run(base, {type: 'setCrop', crop: {x: 380, y: -5, width: 150, height: 150}}).crop).toEqual({
      x: 250,
      y: 0,
      width: 150,
      height: 150,
    });
  });

  it('holds a crop inside the zoom range', () => {
    const state = run(base, {type: 'setCrop', crop: {x: 0, y: 0, width: 10, height: 5}});
    expect(currentZoom(state)).toBeCloseTo(3, 9);
  });

  it('moves and stops at the edge', () => {
    const state = run(base, {type: 'zoomTo', zoom: 2});
    expect(run(state, {type: 'moveCrop', dx: -10, dy: 0}).crop.x).toBeCloseTo(90, 9);
    expect(run(state, {type: 'moveCrop', dx: -1000, dy: 0}).crop.x).toBe(0);
  });

  it('returns the same state for a move that cannot happen', () => {
    expect(run(base, {type: 'moveCrop', dx: -10, dy: 0})).toBe(base);
  });

  it('resizes from the top-left corner and keeps the ratio', () => {
    const square = run(base, {type: 'setRatio', ratio: 1}, {type: 'zoomTo', zoom: 2});
    const bigger = run(square, {type: 'resizeCrop', dw: 10, dh: 0});
    expect(bigger.crop).toMatchObject({x: square.crop.x, y: square.crop.y, width: 110, height: 110});
    const taller = run(square, {type: 'resizeCrop', dw: 0, dh: -10});
    expect(taller.crop.width).toBeCloseTo(90, 9);
  });

  it('resizes a free crop on one axis', () => {
    const state = run(base, {type: 'zoomTo', zoom: 2}, {type: 'resizeCrop', dw: 0, dh: 20});
    expect(state.crop).toMatchObject({width: 200, height: 120});
  });
});

describe('zoom', () => {
  it('zooms about the crop centre within the range', () => {
    const state = run(base, {type: 'zoomBy', factor: 2});
    expect(state.crop).toEqual({x: 100, y: 50, width: 200, height: 100});
    expect(currentZoom(run(state, {type: 'zoomBy', factor: 10}))).toBeCloseTo(3, 9);
    expect(run(state, {type: 'zoomTo', zoom: 0.1}).crop).toEqual(base.crop);
  });
});

describe('ratio', () => {
  it('takes the largest crop of the ratio at the current zoom', () => {
    const state = run(base, {type: 'setRatio', ratio: 1});
    expect(state.crop).toEqual({x: 100, y: 0, width: 200, height: 200});
    expect(run(state, {type: 'setRatio', ratio: null}).crop).toEqual(state.crop);
  });
});

describe('adjust', () => {
  it('merges and clamps', () => {
    const state = run(base, {type: 'adjust', values: {brightness: 150}}, {type: 'adjust', values: {contrast: -30}});
    expect(state.adjust).toEqual({brightness: 100, contrast: -30, saturation: 0});
  });
});

describe('replace', () => {
  it('returns the given state', () => {
    const changed = run(base, {type: 'rotate', direction: 1});
    expect(run(changed, {type: 'replace', state: base})).toBe(base);
  });
});
