/**
 * The entry points are the contract a consumer codes against, so each list is pinned: a
 * rename or an accidentally dropped export fails here instead of in someone else's build.
 * Types are erased at runtime and are covered by `pnpm typecheck` instead.
 */
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

import {describe, expect, it} from 'vitest';

import * as root from './index.js';
import * as maps from './maps.js';
import * as phone from './phone.js';
import * as pickers from './pickers.js';

const ROOT_API = [
  'AsyncAutocompleteField',
  'CancelButton',
  'CheckboxField',
  'DEFAULT_FORM_LABELS',
  'DurationField',
  'FieldShell',
  'FormConfigProvider',
  'FormError',
  'MultiSelectField',
  'NumberField',
  'PasswordField',
  'RadioGroupField',
  'SearchableSelectField',
  'SelectField',
  'SubmitButton',
  'SwitchField',
  'TextArea',
  'TextField',
  'applyServerErrors',
  'createAppForm',
  'lazyField',
  'useFieldBinding',
  'useFieldContext',
  'useFormContext',
];
const PICKERS_API = ['DateField', 'DateRangeField', 'TimePickerField'];
const PHONE_API = ['PhoneField'];
const MAPS_API = ['AddressField', 'EMPTY_ADDRESS', 'LocationSearchField', 'createGooglePlacesProvider'];

describe('public surface', () => {
  it.each([
    ['@vt-labs/form', root, ROOT_API],
    ['@vt-labs/form/pickers', pickers, PICKERS_API],
    ['@vt-labs/form/phone', phone, PHONE_API],
    ['@vt-labs/form/maps', maps, MAPS_API],
  ])('%s exports exactly the pinned list', (_name, module, expected) => {
    expect(Object.keys(module).sort()).toEqual([...expected].sort());
  });
});

describe('form contexts', () => {
  // A second createFormHookContexts() call makes a second pair of contexts. A field
  // reading one while the form provides the other throws at render, so the package owns
  // exactly one pair and every field reads it.
  it('are created exactly once across the package source', () => {
    const srcDir = dirname(fileURLToPath(import.meta.url));
    const sources = walk(srcDir).filter(
      (file) => /\.tsx?$/.test(file) && !/\.(test|stories|typetest)\.tsx?$/.test(file),
    );
    const calls = sources.flatMap((file) => readFileSync(file, 'utf8').match(/createFormHookContexts\(\)/g) ?? []);
    expect(calls).toHaveLength(1);
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
