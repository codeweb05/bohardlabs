import type {RegistryEntry, Values, VariableSpec} from '../core/types.js';

export type Preset = 'sample' | 'long' | 'empty' | 'escaping' | 'longUrl';

export const PRESETS: readonly Preset[] = ['sample', 'long', 'empty', 'escaping', 'longUrl'];

/**
 * A preset's value for a variable, or `null` when the preset does not fill that type. Only
 * free text takes any string; a link, an instant, a number or an enum keeps the value it has,
 * which its notification accepts.
 */
const FILLS: Readonly<Record<Preset, (variable: VariableSpec) => string | null>> = {
  sample: (variable) => variable.sample,
  long: (variable) => (variable.type === 'text' ? 'A long value that keeps going '.repeat(7).slice(0, 200) : null),
  empty: (variable) => (variable.type === 'text' ? '' : null),
  escaping: (variable) => (variable.type === 'text' ? `<b>x</b> & "quoted" 'text'` : null),
  longUrl: (variable) =>
    variable.type === 'url' ? `https://example.com/${'segment/'.repeat(30)}?token=${'x'.repeat(120)}` : null,
};

/** Each variable's sample, by name: the values an entry opens with and Reset returns to. */
export const samples = (entry: RegistryEntry): Values =>
  Object.fromEntries(entry.variables.map((variable) => [variable.name, variable.sample]));

/** The values with a preset applied to every variable of the type it fills; the others keep theirs. */
export function withPreset(preset: Preset, variables: readonly VariableSpec[], values: Values): Values {
  return Object.fromEntries(
    variables.map((variable) => [variable.name, FILLS[preset](variable) ?? values[variable.name] ?? '']),
  );
}

/** Words a label writes in capitals. */
const ACRONYMS: ReadonlySet<string> = new Set(['url', 'id']);

/** "verificationUrl" as "Verification URL": a variable's name, as words. */
export function variableLabel(name: string): string {
  const words = name
    .replaceAll(/(?<lower>[a-z\d])(?<upper>[A-Z])/gu, '$<lower> $<upper>')
    .split(/[\s_-]+/u)
    .map((word) => (ACRONYMS.has(word.toLowerCase()) ? word.toUpperCase() : word.toLowerCase()));
  const sentence = words.join(' ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/** An ISO instant as a `datetime-local` value, which has no zone; the page reads it as UTC. */
export function toLocal(iso: string): string {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? '' : new Date(time).toISOString().slice(0, 19);
}

/** A `datetime-local` value, read as UTC, as an ISO instant. */
export function fromLocal(local: string): string {
  const time = Date.parse(`${local}Z`);
  return local === '' || Number.isNaN(time) ? local : new Date(time).toISOString();
}
