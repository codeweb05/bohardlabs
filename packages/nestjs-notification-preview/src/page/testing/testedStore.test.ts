import {describe, expect, it} from 'vitest';

import {createTestedStore, readFlag, shows, writeFlag} from './testedStore.js';

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

  it('judges a fingerprint the server could not render as a value of its own, never as tested', () => {
    const store = createTestedStore(null, KEY);
    expect(store.stateOf('welcome', 'en', null)).toBe('untested');
    store.tick('welcome', 'en', 'h1');
    expect(store.stateOf('welcome', 'en', null)).toBe('retest');
    store.tick('welcome', 'en', null);
    expect(store.stateOf('welcome', 'en', null)).toBe('tested');
    expect(store.stateOf('welcome', 'en', 'h1')).toBe('retest');
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

describe('the test mode flag', () => {
  it('is off when nothing is stored, and reads back what was written', () => {
    localStorage.clear();
    expect(readFlag(localStorage, 'np:testMode')).toBe(false);
    writeFlag(localStorage, 'np:testMode', true);
    expect(readFlag(localStorage, 'np:testMode')).toBe(true);
    writeFlag(localStorage, 'np:testMode', false);
    expect(localStorage.getItem('np:testMode')).toBeNull();
    expect(readFlag(localStorage, 'np:testMode')).toBe(false);
  });

  it('is off with no storage or a storage that throws, and writing does not throw', () => {
    expect(readFlag(null, 'k')).toBe(false);
    expect(readFlag(blocked(), 'k')).toBe(false);
    expect(() => {
      writeFlag(null, 'k', true);
      writeFlag(blocked(), 'k', true);
    }).not.toThrow();
  });
});

describe('the list filter', () => {
  it('shows everything, what is left to test, or what is tested', () => {
    expect(['untested', 'tested', 'retest'].map((state) => shows('all', state as 'tested'))).toEqual([
      true,
      true,
      true,
    ]);
    expect(shows('todo', 'untested')).toBe(true);
    expect(shows('todo', 'retest')).toBe(true);
    expect(shows('todo', 'tested')).toBe(false);
    expect(shows('tested', 'tested')).toBe(true);
    expect(shows('tested', 'retest')).toBe(false);
  });
});
