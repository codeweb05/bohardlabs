import {describe, expect, it, vi} from 'vitest';

import type {RegistryEntry} from '../core/types.js';
import {PreviewClientError} from './client.js';
import {renderFailureOf, sendFailureOf} from './failures.js';
import {recentTargets, rememberTarget} from './recentTargets.js';
import {DEFAULT_NOTIFICATION_PREVIEW_STRINGS as S} from './strings.js';
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
    expect(renderFailureOf(new PreviewClientError('x', {status: 500}), S).message).toBe('The preview failed with 500.');
    expect(renderFailureOf(new PreviewClientError('x', {status: 0}), S).message).toBe('The preview failed.');
    expect(renderFailureOf(new Error('x'), S).message).toBe('The preview failed.');
  });

  it('says why a send failed', () => {
    expect(sendFailureOf(refused, S)).toEqual({
      fieldErrors: {resetUrl: 'Must be a link.'},
      message: 'Not sent: Must be a link.',
    });
    expect(sendFailureOf(new PreviewClientError('x', {status: 429, retryAfterSeconds: 5}), S).message).toBe(
      'Too many test sends. Try again in 5 s.',
    );
    expect(sendFailureOf(new PreviewClientError('x', {status: 204}), S).message).toBe('The test send failed.');
    expect(sendFailureOf(new PreviewClientError('x', {status: 503}), S).message).toBe('The test send failed with 503.');
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
