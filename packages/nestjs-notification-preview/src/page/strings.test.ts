import {describe, expect, it} from 'vitest';

import {DEFAULT_PAGE_STRINGS as S, mergeStrings} from './strings.js';

describe('the page strings', () => {
  it('has an English default for every plain string', () => {
    const plain = Object.entries(S).filter(([key, value]) => typeof value !== 'function' && key !== 'failure');
    expect(plain.filter(([, value]) => typeof value !== 'string' || value === '')).toEqual([]);
    expect(plain.length).toBeGreaterThan(60);
    expect(Object.values(S.failure).filter((value) => typeof value !== 'string' || value === '')).toEqual([]);
    expect(S.failure[401]).toBe('Sign in to use the notification preview.');
  });

  it('merges a translation over the English, one failure sentence at a time', () => {
    const merged = mergeStrings({title: 'Vista previa', failure: {default: 'Falló.', 401: 'Inicia sesión.'}});
    expect(merged.title).toBe('Vista previa');
    expect(merged.loading).toBe(S.loading);
    expect(merged.failure).toMatchObject({default: 'Falló.', 401: 'Inicia sesión.', 403: S.failure[403]});
    expect(mergeStrings(undefined)).toEqual(S);
  });

  it('builds each sentence around its value', () => {
    expect(S.languageName('es')).toBe('Spanish (es)');
    expect(S.languageName('not a code!')).toBe('not a code!');
    expect(S.position(2, 9)).toBe('2 / 9');
    expect(S.testProgress(3, 39)).toBe('3 / 39');
    expect(S.phoneLabel('iPhone', 'Lock screen')).toBe('iPhone, Lock screen');
    expect(S.renderFailed(undefined)).toBe('The preview failed.');
    expect(S.renderFailed(500)).toBe('The preview failed with 500.');
    expect(S.kilobytes('1.5')).toBe('1.5 KB');
    expect(S.sentEmail('a@example.com')).toBe('Sent to a@example.com.');
    expect(S.sentPush({devices: 1, sent: 1, failed: 0, removed: 0})).toBe('Sent to 1 of 1 device.');
    expect(S.sentPush({devices: 3, sent: 1, failed: 1, removed: 1})).toBe(
      'Sent to 1 of 3 devices. 1 device failed. 1 device no longer registered, removed.',
    );
    expect(S.sendRefused('Required.')).toBe('Not sent: Required.');
    expect(S.sendFailed(undefined)).toBe('The test send failed.');
    expect(S.sendFailed(502)).toBe('The test send failed with 502.');
    expect(S.tooManySends(undefined)).toBe('Too many test sends. Try again shortly.');
    expect(S.tooManySends(30)).toBe('Too many test sends. Try again in 30 s.');
  });
});
