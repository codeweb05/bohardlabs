import {FieldShell} from '../core/FieldShell.js';
import type {CommonFieldProps} from '../core/types.js';
import {useFieldBinding} from '../core/useFieldBinding.js';
import type {ValueExpectation} from '../core/valueChecks.js';
import {AsyncAutocompleteInput} from '../fields/AsyncAutocompleteInput.js';
import type {Place, PlaceSuggestion, PlacesProvider} from './types.js';
import {usePlaceSearch} from './usePlaceSearch.js';

export interface LocationSearchFieldProps extends CommonFieldProps {
  /**
   * Create it once, at module level or in `useMemo`. A new provider on every render starts
   * a new billing session each time and loses the suggestions `resolve` relies on.
   */
  readonly provider: PlacesProvider;
  readonly placeholder?: string;
  /** Characters typed before the first request. Each request costs money. */
  readonly minQueryLength?: number;
  readonly debounceMs?: number;
}

const NULLABLE_PLACE: ValueExpectation = {
  test: (value) =>
    value === null ||
    (typeof value === 'object' && value !== null && 'id' in value && 'lat' in value && 'lng' in value),
  description: 'a Place ({id, label, lat, lng}) or null',
};

/** Search for a place and store where it is. */
export function LocationSearchField({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  provider,
  placeholder,
  minQueryLength = 3,
  debounceMs,
}: Readonly<LocationSearchFieldProps>) {
  const field = useFieldBinding<Place | null>({required, expect: NULLABLE_PLACE});
  const search = usePlaceSearch(provider, {
    onResolved: ({id, label: placeLabel, lat, lng}) => field.setValue({id, label: placeLabel, lat, lng}),
    onCleared: () => field.setValue(null),
  });
  const binding = search.withLookupError(field);
  const place = NULLABLE_PLACE.test(binding.value) ? binding.value : null;

  return (
    <FieldShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
    >
      <AsyncAutocompleteInput<PlaceSuggestion>
        {...search.inputProps}
        binding={binding}
        // The stored object itself: a new object each render would make MUI reset the text.
        value={place}
        minQueryLength={minQueryLength}
        debounceMs={debounceMs}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
      />
    </FieldShell>
  );
}
