import {describe, expect, it, vi} from 'vitest';

import type {RegistryEntry} from '../core/types.js';
import {PreviewClientError} from './client.js';
import {catalogFailureOf, renderFailureOf, sendFailureOf} from './failures.js';
import {recentTargets, rememberTarget} from './recentTargets.js';
import {DEFAULT_PAGE_STRINGS as S} from './strings.js';
import {fromLocal, samples, toLocal, variableLabel, withPreset} from './values.js';

const entry: RegistryEntry = {
  id: 'e',
  channel: 'email',
  label: 'E',
  trigger: 'When.',
  variables: [
    {name: 'firstName', type: 'text', sample: 'Ada'},
    {name: 'resetUrl', type: 'url', sample: 'https://example.com/r'},
    {name: 'plan', type: 'enum', options: ['a', 'b'], sample: 'a'},
  ],
};

describe('values', () => {
  it('opens with the samples and applies a preset to the types it fills', () => {
    const opened = samples(entry);
    expect(opened).toEqual({firstName: 'Ada', resetUrl: 'https://example.com/r', plan: 'a'});
    expect(withPreset('empty', entry.variables, opened)).toEqual({...opened, firstName: ''});
    expect(withPreset('long', entry.variables, opened)['firstName']).toHaveLength(200);
    expect(withPreset('escaping', entry.variables, opened)['firstName']).toContain('<b>');
    expect(withPreset('longUrl', entry.variables, opened)['resetUrl']).toMatch(/^https:\/\/example\.com\/segment/u);
    expect(withPreset('sample', entry.variables, {})).toEqual(opened);
    expect(withPreset('empty', entry.variables, {})['plan']).toBe('');
  });

  it('names a variable in words', () => {
    expect(variableLabel('verificationUrl')).toBe('Verification URL');
    expect(variableLabel('account_id')).toBe('Account ID');
  });

  it('moves an instant to and from a datetime-local value in UTC', () => {
    expect(toLocal('2026-01-15T09:30:00.000Z')).toBe('2026-01-15T09:30:00');
    expect(toLocal('nonsense')).toBe('');
    expect(fromLocal('2026-01-15T09:30:00')).toBe('2026-01-15T09:30:00.000Z');
    expect(fromLocal('')).toBe('');
    expect(fromLocal('bad')).toBe('bad');
  });
});

describe('failures', () => {
  const refused = new PreviewClientError('No.', {status: 422, fieldErrors: {resetUrl: 'Must be a link.'}});

  it('puts a refused render value on its field', () => {
    expect(renderFailureOf(refused, S)).toEqual({fieldErrors: {resetUrl: 'Must be a link.'}, message: S.renderRefused});
    expect(renderFailureOf(new Error('x'), S).message).toBe('The preview failed.');
  });

  it("says the server's own message for a render that is not a refused value", () => {
    expect(renderFailureOf(new PreviewClientError('Sign in first.', {status: 401}), S)).toEqual({
      fieldErrors: {},
      message: 'Sign in first.',
    });
    expect(renderFailureOf(new PreviewClientError('No answer.', {status: 0}), S).message).toBe('No answer.');
    expect(
      renderFailureOf(new PreviewClientError('Too many requests.', {status: 429, retryAfterSeconds: 9}), S).message,
    ).toBe('Too many requests. Try again in 9 s.');
  });

  it('names a refused language in the status line, as it has no field', () => {
    const locale = new PreviewClientError('A value was refused.', {
      status: 422,
      fieldErrors: {locale: 'Not a language this notification renders in.'},
    });
    expect(renderFailureOf(locale, S)).toEqual({
      fieldErrors: {locale: 'Not a language this notification renders in.'},
      message: S.localeRefused('Not a language this notification renders in.'),
    });
  });

  it("says the server's message for a catalog that did not load, or catalogFailed without one", () => {
    expect(catalogFailureOf(new PreviewClientError('Sign in first.', {status: 401}), S)).toBe('Sign in first.');
    expect(catalogFailureOf(new PreviewClientError('Slow down.', {status: 429, retryAfterSeconds: 60}), S)).toBe(
      'Slow down. Try again in 60 s.',
    );
    expect(catalogFailureOf(new PreviewClientError('Slow down.', {status: 429}), S)).toBe('Slow down.');
    expect(catalogFailureOf(new SyntaxError('Not JSON'), S)).toBe(S.catalogFailed);
  });

  it('says why a send failed', () => {
    expect(sendFailureOf(refused, S)).toEqual({
      fieldErrors: {resetUrl: 'Must be a link.'},
      message: 'Not sent: Must be a link.',
    });
    expect(sendFailureOf(new PreviewClientError('Slow down.', {status: 429, retryAfterSeconds: 5}), S).message).toBe(
      'Slow down. Try again in 5 s.',
    );
    expect(sendFailureOf(new PreviewClientError('Not allowed.', {status: 403}), S).message).toBe('Not allowed.');
    expect(sendFailureOf(new PreviewClientError('Down.', {status: 503}), S).message).toBe('Down.');
    expect(sendFailureOf('x', S).message).toBe('The test send failed.');
  });
});

describe('recent targets', () => {
  it('keeps the newest five, one of each whatever the case', () => {
    for (const target of ['a@x.io', 'b@x.io', 'c@x.io', 'd@x.io', 'e@x.io', 'A@X.IO', '  '])
      rememberTarget('k', target);
    expect(recentTargets('k')).toEqual(['A@X.IO', 'e@x.io', 'd@x.io', 'c@x.io', 'b@x.io']);
    expect(recentTargets('other')).toEqual([]);
  });

  it('starts empty when the store holds something else or refuses', () => {
    localStorage.setItem('k', '{"no":1}');
    expect(recentTargets('k')).toEqual([]);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(recentTargets('k')).toEqual([]);
    expect(rememberTarget('k', 'a@x.io')).toEqual(['a@x.io']);
  });
});
