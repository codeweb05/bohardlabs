import {useStore} from '@tanstack/react-form';
import {useEffect, useRef, useState} from 'react';

import {useFormConfig} from '../config/FormConfigContext.js';
import {useFieldContext} from '../context.js';
import type {FieldBinding} from '../core/useFieldBinding.js';
import type {AsyncAutocompleteInputProps} from '../fields/AsyncAutocompleteInput.js';
import type {PlaceSuggestion, PlacesProvider, ResolvedPlace} from './types.js';
import {usePlacesSession} from './usePlacesSession.js';

interface PlaceSearchHandlers {
  readonly onResolved: (place: ResolvedPlace) => void;
  /** The user cleared the search box. */
  readonly onCleared?: () => void;
}

type SearchInputProps = Pick<
  AsyncAutocompleteInputProps<PlaceSuggestion>,
  'onChange' | 'onInputChange' | 'loadOptions' | 'getOptionValue' | 'getOptionLabel'
>;

/**
 * The search box both maps fields share: suggestions inside one billing session, and a
 * pick resolved through the provider. Only the latest pick lands. A failed lookup keeps
 * the previous value and shows `labels.placeLookupFailed` under the field until the value
 * changes, the form is reset, or the user types in the search box again.
 */
export function usePlaceSearch(provider: PlacesProvider, {onResolved, onCleared}: PlaceSearchHandlers) {
  const {labels} = useFormConfig();
  const field = useFieldContext<unknown>();
  const value = useStore(field.store, (state) => state.value);
  const isTouched = useStore(field.store, (state) => state.meta.isTouched);
  const session = usePlacesSession(provider);
  const latestPick = useRef(0);
  // Unmounting counts as a newer pick, so a lookup that answers afterwards writes nothing.
  useEffect(
    () => () => {
      latestPick.current += 1;
    },
    [],
  );
  // The value the failed lookup left in place. The error is about that value only.
  const [failedAt, setFailedAt] = useState<{readonly value: unknown} | null>(null);

  // A reset untouches the field and may bring back the very same value, so both count.
  if (failedAt && (failedAt.value !== value || !isTouched)) setFailedAt(null);

  const pick = async (suggestion: PlaceSuggestion | null) => {
    const pickId = ++latestPick.current;
    setFailedAt(null);
    if (!suggestion) {
      onCleared?.();
      return;
    }
    const current = session.current();
    session.end();
    try {
      const resolved = await provider.resolve(suggestion.id, {session: current});
      if (pickId === latestPick.current) onResolved(resolved);
    } catch {
      if (pickId !== latestPick.current) return;
      // The user acted on the field, so it counts as touched; a reset then clears the error.
      field.setMeta((meta) => ({...meta, isTouched: true}));
      setFailedAt({value: field.state.value});
    }
  };

  const inputProps: SearchInputProps = {
    onChange: (next) => void pick(Array.isArray(next) ? (next[0] ?? null) : next),
    onInputChange: () => setFailedAt(null),
    loadOptions: (query, {signal}) => provider.suggest(query, {signal, session: session.current()}),
    getOptionValue: (suggestion) => suggestion.id,
    getOptionLabel: (suggestion) => suggestion.label,
  };

  /** The binding with the lookup failure as its error, unless a validation error already shows. */
  const withLookupError = <T>(binding: FieldBinding<T>): FieldBinding<T> =>
    failedAt && binding.error === null
      ? {
          ...binding,
          error: labels.placeLookupFailed,
          inputProps: {...binding.inputProps, 'aria-invalid': true},
        }
      : binding;

  return {inputProps, withLookupError};
}
