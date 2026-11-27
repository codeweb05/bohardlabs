import type {FailureStringsInput, PageConfig, PageTextStrings} from '../pageSettings.js';
import {DEFAULT_PAGE_STRINGS} from './strings.js';

export type {PageConfig} from '../pageSettings.js';

const CONFIG_ID = 'np-config';

const malformed = (): Error => new Error('Notification preview settings are malformed');

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The failure sentences the module gave, any of them: an entry must be a string to be kept, and
 * `mergeStrings` fills in the rest, `default` among them.
 */
function failureOf(raw: unknown): FailureStringsInput {
  if (!isRecord(raw)) throw malformed();
  return Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  ) as FailureStringsInput;
}

/** The words the page knows as plain strings; an unknown key, a non-string or a function entry is dropped. */
function stringsOf(raw: unknown): PageTextStrings {
  if (!isRecord(raw)) throw malformed();
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'failure') kept[key] = failureOf(value);
    else if (
      typeof value === 'string' &&
      Object.hasOwn(DEFAULT_PAGE_STRINGS, key) &&
      typeof Reflect.get(DEFAULT_PAGE_STRINGS, key) === 'string'
    )
      kept[key] = value;
  }
  return kept as PageTextStrings;
}

/** The settings the module wrote into `doc`. Throws when the block is missing or not the settings. */
export function readPageConfig(doc: Document): PageConfig {
  const element = doc.getElementById(CONFIG_ID);
  if (element === null) throw new Error('Notification preview settings are missing');
  // Typed wide on purpose: lib.dom has typed `textContent` both ways across versions.
  const text: string | null = element.textContent;
  let raw: unknown;
  try {
    raw = JSON.parse(text ?? '');
  } catch {
    throw malformed();
  }
  if (!isRecord(raw)) throw malformed();
  const {apiBase, appName, environment, strings, storageKey} = raw;
  if (typeof apiBase !== 'string' || typeof appName !== 'string' || typeof storageKey !== 'string') throw malformed();
  if (environment !== null && typeof environment !== 'string') throw malformed();
  return {apiBase, appName, environment, strings: stringsOf(strings ?? {}), storageKey};
}
