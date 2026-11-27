import {describe, expect, it} from 'vitest';

import {createTestedStore} from './testedStore.js';

const KEY = 'np:tested';

/** A Storage that keeps nothing and throws on every call, as a blocked one does. */
const blocked = (): Storage =>
  new Proxy({} as Storage, {
    get: () => () => {
      throw new Error('blocked');
    },
  });

describe('the tested store', () => {
  it('knows an entry nobody ticked as untested', () => {
    expect(createTestedStore(null, KEY).stateOf('welcome', 'en', 'h1')).toBe('untested');
  });

  it('is tested for the render that was ticked and retest for another', () => {
    const store = createTestedStore(null, KEY);
    store.tick('welcome', 'en', 'h1');
    expect(store.stateOf('welcome', 'en', 'h1')).toBe('tested');
    expect(store.stateOf('welcome', 'en', 'h2')).toBe('retest');
  });

  it('gives the stored state as it is when no hash is known', () => {
    const store = createTestedStore(null, KEY);
    expect(store.stateOf('welcome', 'en', null)).toBe('untested');
    store.tick('welcome', 'en', 'h1');
    expect(store.stateOf('welcome', 'en', null)).toBe('tested');
  });

  it('keeps a tick for each entry and locale', () => {
    const store = createTestedStore(null, KEY);
    store.tick('welcome', 'en', 'h1');
    expect(store.stateOf('welcome', 'es', 'h1')).toBe('untested');
    expect(store.stateOf('invoice-due', 'en', 'h1')).toBe('untested');
  });

  it('takes a tick away, and clears them all', () => {
    const store = createTestedStore(null, KEY);
    store.tick('welcome', 'en', 'h1');
    store.tick('invoice-due', 'en', 'h1');
    store.untick('welcome', 'en');
    expect(store.stateOf('welcome', 'en', 'h1')).toBe('untested');
    expect(store.stateOf('invoice-due', 'en', 'h1')).toBe('tested');
    store.clear();
    expect(store.stateOf('invoice-due', 'en', 'h1')).toBe('untested');
  });

  it('writes to storage under its key, and a new store reads it back', () => {
    localStorage.clear();
    createTestedStore(localStorage, KEY).tick('welcome', 'en', 'h1');
    expect(localStorage.getItem(KEY)).not.toBeNull();
    expect(createTestedStore(localStorage, KEY).stateOf('welcome', 'en', 'h1')).toBe('tested');
    createTestedStore(localStorage, KEY).clear();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('stores hashes and ids only', () => {
    localStorage.clear();
    createTestedStore(localStorage, KEY).tick('welcome', 'en', 'abcd1234');
    expect(localStorage.getItem(KEY)).toBe(JSON.stringify([['welcome', 'en', 'abcd1234']]));
  });

  it('starts empty when what is stored is not a record', () => {
    localStorage.setItem(KEY, '{not json');
    expect(createTestedStore(localStorage, KEY).stateOf('welcome', 'en', 'h1')).toBe('untested');
    localStorage.setItem(KEY, JSON.stringify([['welcome', 'en'], 'x', ['a', 'b', 3]]));
    expect(createTestedStore(localStorage, KEY).stateOf('welcome', 'en', 'h1')).toBe('untested');
  });

  it('still ticks, for the session, when storage throws', () => {
    const store = createTestedStore(blocked(), KEY);
    store.tick('welcome', 'en', 'h1');
    expect(store.stateOf('welcome', 'en', 'h1')).toBe('tested');
    store.untick('welcome', 'en');
    expect(store.stateOf('welcome', 'en', 'h1')).toBe('untested');
  });
});
