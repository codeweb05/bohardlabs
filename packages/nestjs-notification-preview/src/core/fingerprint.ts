import type {RenderResponse} from './types.js';

/** The JSON of `value` with every object's keys in sorted order, so key order never shows. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    const members = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`);
    return `{${members.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * A short fingerprint of a render: 32-bit FNV-1a over its canonical JSON, as eight hex digits.
 * The catalog carries one per entry and locale, and test mode keeps it with a tick, so a render
 * that changes afterwards is told from the one that was tested. Plain JS, so the core reaches no
 * Node module; it tells renders apart and is no security hash.
 */
export function fingerprint(rendered: RenderResponse): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(canonical(rendered))) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
