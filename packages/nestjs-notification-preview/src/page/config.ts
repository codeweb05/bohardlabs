import {DEFAULT_PAGE_STRINGS} from './strings.js';
import type {FailureStrings, PageStrings} from './strings.js';

/** What the module writes into the page, in `<script type="application/json" id="np-config">`. */
export interface PageConfig {
  /** Where the three routes live, such as `/notification-preview/api`. */
  readonly apiBase: string;
  /** The app's name, on the brand, the inbox header and the phone. */
  readonly appName: string;
  /** The badge beside the title, such as `DEV`; `null` for none. */
  readonly environment: string | null;
  /** Merged over the English defaults. Only plain strings arrive this way: JSON holds no function. */
  readonly strings: Partial<PageStrings>;
  /** The prefix for what the page keeps in this browser: the theme and the recent targets. */
  readonly storageKey: string;
}

const CONFIG_ID = 'np-config';

const malformed = (): Error => new Error('Notification preview settings are malformed');

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The failure sentences: `default` is required, and every other entry must be a string to be kept. */
function failureOf(raw: unknown): FailureStrings {
  if (!isRecord(raw) || typeof raw['default'] !== 'string') throw malformed();
  return Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  ) as unknown as FailureStrings;
}

/** The words the page knows as plain strings; an unknown key, a non-string or a function entry is dropped. */
function stringsOf(raw: unknown): Partial<PageStrings> {
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
  return kept as Partial<PageStrings>;
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
