import {describe, expect, it} from 'vitest';

import {readPageConfig} from './config.js';
import {DEFAULT_PAGE_STRINGS, mergeStrings} from './strings.js';

/** A document holding the settings block the module writes, with `text` as its content. */
function documentWith(text: string | undefined): Document {
  const doc = document.implementation.createHTMLDocument('page');
  if (text !== undefined) {
    const script = doc.createElement('script');
    script.type = 'application/json';
    script.id = 'np-config';
    script.textContent = text;
    doc.head.append(script);
  }
  return doc;
}

const SETTINGS = {
  apiBase: '/notification-preview/api',
  appName: 'Acme',
  environment: 'DEV',
  strings: {title: 'Vista previa', failure: {default: 'Falló.', 401: 'Inicia sesión.'}},
  storageKey: 'acme.preview',
};

describe('readPageConfig', () => {
  it('reads the settings the module wrote into the page', () => {
    expect(readPageConfig(documentWith(JSON.stringify(SETTINGS)))).toEqual(SETTINGS);
  });

  it('takes a null environment as no badge', () => {
    const config = readPageConfig(documentWith(JSON.stringify({...SETTINGS, environment: null})));
    expect(config.environment).toBeNull();
  });

  it('keeps only the words it knows, as strings', () => {
    const config = readPageConfig(
      documentWith(
        JSON.stringify({
          ...SETTINGS,
          strings: {title: 'T', nonsense: 'x', loading: 3, position: 'not a function', failure: {default: 'F', 500: 9}},
        }),
      ),
    );
    expect(config.strings).toEqual({title: 'T', failure: {default: 'F'}});
  });

  it('takes some of the failure sentences, and the defaults fill the rest', () => {
    const config = readPageConfig(
      documentWith(JSON.stringify({...SETTINGS, strings: {failure: {401: 'Inicia sesión.'}}})),
    );
    expect(config.strings).toEqual({failure: {401: 'Inicia sesión.'}});
    const failure = mergeStrings(config.strings).failure;
    expect(failure[401]).toBe('Inicia sesión.');
    expect(failure.default).toBe(DEFAULT_PAGE_STRINGS.failure.default);
    expect(failure[500]).toBe(DEFAULT_PAGE_STRINGS.failure[500]);
  });

  it('throws when the block is missing', () => {
    expect(() => readPageConfig(documentWith(undefined))).toThrow('Notification preview settings are missing');
  });

  it('throws when the block is not the settings', () => {
    expect(() => readPageConfig(documentWith('{not json'))).toThrow('Notification preview settings are malformed');
    expect(() => readPageConfig(documentWith('[]'))).toThrow('Notification preview settings are malformed');
    expect(() => readPageConfig(documentWith(JSON.stringify({...SETTINGS, apiBase: 3})))).toThrow(
      'Notification preview settings are malformed',
    );
    expect(() => readPageConfig(documentWith(JSON.stringify({...SETTINGS, environment: 1})))).toThrow(
      'Notification preview settings are malformed',
    );
    expect(() => readPageConfig(documentWith(JSON.stringify({...SETTINGS, strings: 'x'})))).toThrow(
      'Notification preview settings are malformed',
    );
    expect(() => readPageConfig(documentWith(JSON.stringify({...SETTINGS, strings: {failure: 'x'}})))).toThrow(
      'Notification preview settings are malformed',
    );
  });
});
