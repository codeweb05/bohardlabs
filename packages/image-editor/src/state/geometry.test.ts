import {describe, expect, it} from 'vitest';

import {
  FLIP_HORIZONTAL,
  FLIP_VERTICAL,
  IDENTITY,
  ROTATE_LEFT,
  ROTATE_RIGHT,
  apply,
  clampRect,
  coverScale,
  frameSize,
  invert,
  largestCrop,
  layoutStage,
  linearOf,
  multiply,
  stageToCrop,
  toFrame,
  zoomOf,
  type Matrix2,
  type Point,
} from './geometry.js';

const image = {width: 400, height: 200};

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('matrices', () => {
  it('turns right four times back to identity', () => {
    let m: Matrix2 = IDENTITY;
    for (let i = 0; i < 4; i++) m = multiply(ROTATE_RIGHT, m);
    expect(m).toEqual(IDENTITY);
  });

  it('undoes a flip with the same flip', () => {
    expect(multiply(FLIP_HORIZONTAL, FLIP_HORIZONTAL)).toEqual(IDENTITY);
    expect(multiply(FLIP_VERTICAL, FLIP_VERTICAL)).toEqual(IDENTITY);
    expect(multiply(ROTATE_LEFT, ROTATE_RIGHT)).toEqual(IDENTITY);
  });

  it('turns right clockwise on a y-down screen', () => {
    expect(apply(ROTATE_RIGHT, {x: 1, y: 0})).toEqual({x: 0, y: 1});
  });

  it('inverts', () => {
    const m: Matrix2 = [2, 1, 1, 3];
    const product = multiply(m, invert(m));
    product.forEach((value, i) => expect(value).toBeCloseTo(IDENTITY[i] ?? Number.NaN, 9));
  });
});

describe('frame', () => {
  it('swaps after one quarter turn', () => {
    expect(frameSize(image, ROTATE_RIGHT)).toEqual({width: 200, height: 400});
    expect(frameSize(image, FLIP_HORIZONTAL)).toEqual(image);
  });

  it('needs no cover scale when straight and √2 for a square at 45°', () => {
    expect(coverScale(image, 0)).toBe(1);
    expect(coverScale({width: 100, height: 100}, 45)).toBeCloseTo(Math.SQRT2, 9);
  });

  it('maps the image centre to the frame centre', () => {
    expect(distance(toFrame(image, ROTATE_RIGHT, 12, {x: 200, y: 100}), {x: 100, y: 200})).toBeLessThan(1e-6);
  });

  it('keeps every frame corner on the image when straightened', () => {
    const orientation = multiply(ROTATE_RIGHT, FLIP_HORIZONTAL);
    const frame = frameSize(image, orientation);
    const inverse = invert(linearOf(image, orientation, 30));
    const corners = [
      {x: 0, y: 0},
      {x: frame.width, y: 0},
      {x: 0, y: frame.height},
      {x: frame.width, y: frame.height},
    ];
    for (const corner of corners) {
      const p = apply(inverse, {x: corner.x - frame.width / 2, y: corner.y - frame.height / 2});
      const onImage = {x: p.x + image.width / 2, y: p.y + image.height / 2};
      expect(onImage.x).toBeGreaterThanOrEqual(-1e-9);
      expect(onImage.x).toBeLessThanOrEqual(image.width + 1e-9);
      expect(onImage.y).toBeGreaterThanOrEqual(-1e-9);
      expect(onImage.y).toBeLessThanOrEqual(image.height + 1e-9);
    }
  });
});

describe('crop', () => {
  it('calls the largest crop of a shape zoom 1', () => {
    const crop = largestCrop(image, 1);
    expect(crop).toEqual({x: 100, y: 0, width: 200, height: 200});
    expect(zoomOf(image, crop)).toBe(1);
    expect(zoomOf(image, {x: 0, y: 0, width: 100, height: 100})).toBe(2);
    expect(largestCrop(image, null)).toEqual({x: 0, y: 0, ...image});
  });

  it('pulls an overhanging rect back inside the frame', () => {
    expect(clampRect({x: 350, y: -20, width: 100, height: 50}, image)).toEqual({x: 300, y: 0, width: 100, height: 50});
  });

  it('shrinks an oversized rect about its centre, keeping its shape', () => {
    expect(clampRect({x: -100, y: -100, width: 800, height: 400}, image)).toEqual({
      x: 0,
      y: 0,
      width: 400,
      height: 200,
    });
    const square = clampRect({x: 0, y: 0, width: 300, height: 300}, image);
    expect(square.width).toBe(200);
    expect(square.height).toBe(200);
  });
});

describe('layoutStage', () => {
  const stage = {width: 800, height: 600};
  const crop = {x: 40, y: 30, width: 120, height: 90};
  const orientation = multiply(FLIP_VERTICAL, ROTATE_RIGHT);
  const layout = layoutStage(stage, 20, image, orientation, 7, crop);

  it('centres the crop on the stage inside the padding', () => {
    expect(layout.k).toBeCloseTo(560 / 90, 9);
    const {selection} = layout;
    expect(selection.x + selection.width / 2).toBeCloseTo(400, 9);
    expect(selection.y + selection.height / 2).toBeCloseTo(300, 9);
    expect(selection.height).toBeCloseTo(560, 9);
  });

  it('places the image element where the frame mapping says', () => {
    const [a, b, c, d, e, f] = layout.matrix;
    for (const p of [
      {x: 0, y: 0},
      {x: 400, y: 0},
      {x: 123, y: 45},
    ]) {
      const local = {x: p.x - image.width / 2, y: p.y - image.height / 2};
      const css = {
        x: image.width / 2 + a * local.x + c * local.y + e,
        y: image.height / 2 + b * local.x + d * local.y + f,
      };
      const framePoint = toFrame(image, orientation, 7, p);
      expect(
        distance(css, {x: layout.frame.x + layout.k * framePoint.x, y: layout.frame.y + layout.k * framePoint.y}),
      ).toBeLessThan(1e-6);
    }
  });

  it('reads its own selection back as the crop', () => {
    const back = stageToCrop(layout, layout.selection);
    expect(distance({x: back.x, y: back.y}, {x: crop.x, y: crop.y})).toBeLessThan(1e-6);
    expect(distance({x: back.width, y: back.height}, {x: crop.width, y: crop.height})).toBeLessThan(1e-6);
  });

  it('survives a stage too small for the padding', () => {
    expect(layoutStage({width: 0, height: 0}, 20, image, IDENTITY, 0, crop).k).toBeGreaterThan(0);
  });
});
