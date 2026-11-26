import {useEffect, useState} from 'react';

import type {Catalog, RegistryEntry, Values} from '../types.js';
import type {PreviewClient} from './client.js';
import type {RenderState} from './useRender.js';
import {useRender} from './useRender.js';
import type {Preset} from './values.js';
import {samples, withPreset} from './values.js';

export interface PreviewState {
  /** Every entry in list order: email first, then push, each in registry order. */
  readonly entries: readonly RegistryEntry[];
  readonly entry: RegistryEntry | undefined;
  readonly index: number;
  readonly values: Values;
  readonly lang: string;
  readonly render: RenderState;
  readonly select: (id: string) => void;
  readonly step: (by: 1 | -1) => void;
  readonly edit: (name: string, value: string) => void;
  readonly preset: (preset: Preset) => void;
  readonly reset: () => void;
  readonly language: (lang: string) => void;
}

const ordered = (catalog: Catalog): RegistryEntry[] => [
  ...catalog.entries.filter((entry) => entry.channel === 'email'),
  ...catalog.entries.filter((entry) => entry.channel === 'push'),
];

/** The open notification, its values and language, and its render. */
export function usePreview(client: PreviewClient, catalog: Catalog): PreviewState {
  const [entries] = useState(() => ordered(catalog));
  const render = useRender(client);
  const [index, setIndex] = useState(0);
  const entry = entries[index];
  const [values, setValues] = useState<Values>(() => (entry === undefined ? {} : samples(entry)));
  const [lang, setLang] = useState(catalog.languages[0] ?? 'en');

  // The first notification renders as the page opens.
  useEffect(() => {
    const first = entries[0];
    if (first !== undefined) render.render({id: first.id, lang, values: samples(first)});
    // Once, on mount: every later render is asked for by the action that changes it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = (next: number): void => {
    const target = entries[next];
    if (target === undefined) return;
    const fresh = samples(target);
    setIndex(next);
    setValues(fresh);
    render.clearFailure();
    render.render({id: target.id, lang, values: fresh});
  };

  const change = (next: Values, debounce: boolean): void => {
    if (entry === undefined) return;
    setValues(next);
    render.render({id: entry.id, lang, values: next}, debounce);
  };

  return {
    entries,
    entry,
    index,
    values,
    lang,
    render,
    select: (id) => {
      open(entries.findIndex((candidate) => candidate.id === id));
    },
    step: (by) => {
      if (entries.length > 0) open((index + by + entries.length) % entries.length);
    },
    edit: (name, value) => {
      change({...values, [name]: value}, true);
    },
    preset: (preset) => {
      if (entry !== undefined) change(withPreset(preset, entry.variables, values), false);
    },
    reset: () => {
      if (entry !== undefined) change(samples(entry), false);
    },
    language: (next) => {
      setLang(next);
      if (entry !== undefined) render.render({id: entry.id, lang: next, values});
    },
  };
}
