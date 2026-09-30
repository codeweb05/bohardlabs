import {describe, expect, it} from 'vitest';

import {DEFAULT_RATIOS, parseRatio, resolveFeatures} from './features';

describe('parseRatio', () => {
  it.each([
    ['free', null],
    ['1:1', 1],
    ['4:3', 4 / 3],
    ['16:9', 16 / 9],
    [1.5, 1.5],
    [0, null],
    [-2, null],
    [Number.NaN, null],
    [Number.POSITIVE_INFINITY, null],
  ] as const)('%s is %s', (ratio, expected) => {
    expect(parseRatio(ratio)).toBe(expected);
  });
});

describe('resolveFeatures', () => {
  it('turns on crop, zoom, rotate and flip by default and nothing else', () => {
    expect(resolveFeatures(undefined)).toEqual({
      crop: {enabled: true, ratios: DEFAULT_RATIOS, shape: 'rect'},
      zoom: {min: 1, max: 3, slider: false},
      rotate: true,
      flip: {horizontal: true, vertical: true},
      replace: false,
      straighten: false,
      adjust: false,
      history: false,
    });
  });

  it('gives the whole frame when crop is off', () => {
    expect(resolveFeatures({crop: false}).crop).toEqual({enabled: false, ratios: ['free'], shape: 'rect'});
  });

  it('locks a circle to 1:1', () => {
    expect(resolveFeatures({crop: {shape: 'circle', ratios: ['16:9', 'free']}}).crop).toEqual({
      enabled: true,
      ratios: ['1:1'],
      shape: 'circle',
    });
  });

  it('keeps the given ratios in order and drops unusable ones', () => {
    expect(resolveFeatures({crop: {ratios: ['16:9', 0, 'free']}}).crop.ratios).toEqual(['16:9', 'free']);
  });

  it('falls back to the default ratios when none is usable', () => {
    expect(resolveFeatures({crop: {ratios: [-1]}}).crop.ratios).toEqual(DEFAULT_RATIOS);
    expect(resolveFeatures({crop: {ratios: []}}).crop.ratios).toEqual(DEFAULT_RATIOS);
  });

  it('keeps zoom limits sane', () => {
    expect(resolveFeatures({zoom: {min: 0.2, max: 0.5}}).zoom).toEqual({min: 1, max: 1, slider: false});
    expect(resolveFeatures({zoom: {max: 5, slider: true}}).zoom).toEqual({min: 1, max: 5, slider: true});
    expect(resolveFeatures({zoom: false}).zoom).toBe(false);
  });

  it('turns flip off when both axes are off', () => {
    expect(resolveFeatures({flip: {horizontal: false, vertical: false}}).flip).toBe(false);
    expect(resolveFeatures({flip: {vertical: false}}).flip).toEqual({horizontal: true, vertical: false});
  });

  it('clamps the straighten range', () => {
    expect(resolveFeatures({straighten: true}).straighten).toEqual({range: 45});
    expect(resolveFeatures({straighten: {range: 200}}).straighten).toEqual({range: 90});
    expect(resolveFeatures({straighten: {range: 0}}).straighten).toEqual({range: 1});
  });

  it('turns adjust off when every tool in it is off', () => {
    expect(resolveFeatures({adjust: true}).adjust).toEqual({
      brightness: true,
      contrast: true,
      saturation: true,
      presets: true,
    });
    expect(
      resolveFeatures({adjust: {brightness: false, contrast: false, saturation: false, presets: false}}).adjust,
    ).toBe(false);
  });

  it('passes the switches through', () => {
    const resolved = resolveFeatures({rotate: false, replace: true, history: true});
    expect([resolved.rotate, resolved.replace, resolved.history]).toEqual([false, true, true]);
  });
});
