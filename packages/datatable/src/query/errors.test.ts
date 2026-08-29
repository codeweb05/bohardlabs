/**
 * Coverage for `getErrorMessage`, which had no test of its own.
 *
 * Three lines, but they are the entire error contract of the package: every message a
 * consumer reads for a failed query, mutation or inline save comes out of here.
 * `useInlineEdit` exercised the `Error` path incidentally and nothing else, which left
 * the two fallbacks undescribed.
 */
import {describe, expect, it} from 'vitest';

import {getErrorMessage} from './errors';

describe('getErrorMessage', () => {
  it('reads the message off an Error', () => {
    expect(getErrorMessage(new Error('Request failed with status 500'))).toBe('Request failed with status 500');
  });

  it('reads the message off an Error subclass', () => {
    // What a transport actually throws is its own subclass (AxiosError, TRPCClientError).
    // `instanceof Error` still holds, so these take the first path rather than the
    // fallback, and the transport keeps control of the wording.
    class TransportError extends Error {}

    expect(getErrorMessage(new TransportError('Network unreachable'))).toBe('Network unreachable');
  });

  it('passes a thrown string through unchanged', () => {
    // `throw 'nope'` is legal and some transports do it.
    expect(getErrorMessage('Invalid credentials')).toBe('Invalid credentials');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a number', 404],
    ['a boolean', false],
    ['an array', ['first', 'second']],
  ])('falls back to the generic message for %s', (_label, value) => {
    expect(getErrorMessage(value)).toBe('Something went wrong');
  });

  it('falls back for a plain object even when it carries a message field', () => {
    // A rejected object literal is not an Error, so its `message` is not read. Worth
    // knowing when a backend rejects with a bare JSON body: the useful text is dropped
    // and the consumer has to map the response to an Error before it reaches the table.
    expect(getErrorMessage({message: 'Validation failed'})).toBe('Something went wrong');
  });

  it('returns the empty string for an Error with no message', () => {
    // Current behaviour, asserted because it is a sharp edge rather than because it is
    // desirable: the caller gets `''`, which is falsy, so an `if (error)` check upstream
    // reads a real failure as no failure.
    expect(getErrorMessage(new Error(''))).toBe('');
  });
});
