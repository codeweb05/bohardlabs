import {describe, expect, it} from 'vitest';

import {DEFAULT_IMAGE_EDITOR_LABELS as L} from '../labels.js';
import {errorMessage} from './LabelsContext.js';

describe('errorMessage', () => {
  it.each([
    ['unsupported-type', L.errorUnsupportedType],
    ['too-small', L.errorTooSmall],
    ['too-large', L.errorTooLarge],
    ['load-failed', L.errorLoadFailed],
    ['output-too-large', L.errorOutputTooLarge],
  ] as const)('reads %s from the labels', (code, message) => {
    expect(errorMessage(L, code)).toBe(message);
  });
});
