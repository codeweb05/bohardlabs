import {FieldShell} from '../core/FieldShell';
import type {CommonFieldProps} from '../core/types';
import {useFieldBinding} from '../core/useFieldBinding';
import type {ValueExpectation} from '../core/valueChecks';
import {AsyncAutocompleteInput} from '../fields/AsyncAutocompleteInput';
import type {Place, PlaceSuggestion, PlacesProvider} from './types';
import {usePlaceSearch} from './usePlaceSearch';

export interface LocationSearchFieldProps extends CommonFieldProps {
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
        value={place ? {id: place.id, label: place.label} : null}
        minQueryLength={minQueryLength}
        debounceMs={debounceMs}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
      />
    </FieldShell>
  );
}
