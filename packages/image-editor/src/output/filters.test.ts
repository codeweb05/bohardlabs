import {describe, expect, it} from 'vitest';

import {NEUTRAL_ADJUSTMENTS} from '../state/editorState';
import {filterString, PRESETS, presetOf, supportsCanvasFilter} from './filters';

describe('filterString', () => {
  it('is none when every value is neutral', () => {
    expect(filterString(NEUTRAL_ADJUSTMENTS)).toBe('none');
  });

  it('maps -100..100 onto CSS factors', () => {
    expect(filterString({brightness: 10, contrast: -25, saturation: -100})).toBe(
      'brightness(1.1) contrast(0.75) saturate(0)',
    );
  });
});

describe('presets', () => {
  it('starts with original, which is neutral', () => {
    expect(PRESETS[0]).toEqual({id: 'original', values: NEUTRAL_ADJUSTMENTS});
  });

  it('recognises a preset by its values and nothing else', () => {
    expect(presetOf({brightness: 0, contrast: 10, saturation: -100})).toBe('mono');
    expect(presetOf({brightness: 1, contrast: 10, saturation: -100})).toBeNull();
  });
});

describe('supportsCanvasFilter', () => {
  it('answers from the 2d context prototype', () => {
    expect(supportsCanvasFilter()).toBe(
      typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype,
    );
  });
});
