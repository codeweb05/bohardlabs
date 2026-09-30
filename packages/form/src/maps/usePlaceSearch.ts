import {useRef, useState} from 'react';

import {useFormConfig} from '../config/FormConfigContext';
import type {FieldBinding} from '../core/useFieldBinding';
import type {AsyncAutocompleteInputProps} from '../fields/AsyncAutocompleteInput';
import type {PlaceSuggestion, PlacesProvider, ResolvedPlace} from './types';
import {usePlacesSession} from './usePlacesSession';

interface PlaceSearchHandlers {
  readonly onResolved: (place: ResolvedPlace) => void;
  /** The user cleared the search box. */
  readonly onCleared?: () => void;
}

type SearchInputProps = Pick<
  AsyncAutocompleteInputProps<PlaceSuggestion>,
  'onChange' | 'loadOptions' | 'getOptionValue' | 'getOptionLabel'
>;

/**
 * The search box both maps fields share: suggestions inside one billing session, and a
 * pick resolved through the provider. Only the latest pick lands. A failed lookup stores
 * nothing and shows `labels.placeLookupFailed` under the field until the next pick.
 */
export function usePlaceSearch(provider: PlacesProvider, {onResolved, onCleared}: PlaceSearchHandlers) {
  const {labels} = useFormConfig();
  const session = usePlacesSession(provider);
  const latestPick = useRef(0);
  const [failed, setFailed] = useState(false);

  const pick = async (suggestion: PlaceSuggestion | null) => {
    const pickId = ++latestPick.current;
    setFailed(false);
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
      if (pickId === latestPick.current) setFailed(true);
    }
  };

  const inputProps: SearchInputProps = {
    onChange: (next) => void pick(Array.isArray(next) ? (next[0] ?? null) : next),
    loadOptions: (query, {signal}) => provider.suggest(query, {signal, session: session.current()}),
    getOptionValue: (suggestion) => suggestion.id,
    getOptionLabel: (suggestion) => suggestion.label,
  };

  /** The binding with the lookup failure as its error, unless a validation error already shows. */
  const withLookupError = <T>(binding: FieldBinding<T>): FieldBinding<T> =>
    failed && binding.error === null
      ? {
          ...binding,
          error: labels.placeLookupFailed,
          inputProps: {...binding.inputProps, 'aria-invalid': true},
        }
      : binding;

  return {inputProps, withLookupError};
}
