import {describe, expect, it} from 'vitest';

import {EditorError, toEditorError} from './errors.js';

describe('toEditorError', () => {
  it('reports the code alone when there is no cause', () => {
    expect(toEditorError(new EditorError('too-small'), 'load-failed')).toEqual({code: 'too-small'});
  });

  it('keeps the cause, so the consumer can log what went wrong', () => {
    const cause = new TypeError('Failed to fetch');
    expect(toEditorError(new EditorError('load-failed', cause), 'too-large')).toEqual({code: 'load-failed', cause});
  });

  it('reports anything else under the fallback code, as the cause', () => {
    const thrown = new Error('boom');
    expect(toEditorError(thrown, 'load-failed')).toEqual({code: 'load-failed', cause: thrown});
    expect(toEditorError('a string', 'load-failed')).toEqual({code: 'load-failed', cause: 'a string'});
  });
});
