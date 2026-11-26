import {describe, expect, it} from 'vitest';

import * as entry from './react.js';
import {DEFAULT_NOTIFICATION_PREVIEW_STRINGS as S} from './react.js';

describe('the react entry', () => {
  it('exports exactly the pinned list', () => {
    expect(Object.keys(entry).sort()).toEqual([
      'DEFAULT_NOTIFICATION_PREVIEW_STRINGS',
      'NotificationPreviewPage',
      'PreviewClientError',
      'createFetchClient',
    ]);
  });

  it('has an English default for every plain string', () => {
    const plain = Object.entries(S).filter(([, value]) => typeof value !== 'function');
    expect(plain.filter(([, value]) => typeof value !== 'string' || value === '')).toEqual([]);
    expect(plain.length).toBeGreaterThan(60);
  });

  it('builds each sentence around its value', () => {
    expect(S.languageName('es')).toBe('Spanish (es)');
    expect(S.languageName('not a code!')).toBe('not a code!');
    expect(S.position(2, 9)).toBe('2 / 9');
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
