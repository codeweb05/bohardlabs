import Box from '@mui/material/Box';
import {useField} from '@tanstack/react-form';
import type {AnyFieldApi} from '@tanstack/react-form';

import {useFormConfig} from '../config/FormConfigContext.js';
import type {FormLabels} from '../config/labels.js';
import {fieldContext, useFieldContext} from '../context.js';
import {FieldShell} from '../core/FieldShell.js';
import type {CommonFieldProps} from '../core/types.js';
import {useFieldBinding} from '../core/useFieldBinding.js';
import type {ValueExpectation} from '../core/valueChecks.js';
import {AsyncAutocompleteInput} from '../fields/AsyncAutocompleteInput.js';
import {TextField} from '../fields/TextField.js';
import {clearServerError} from '../serverErrors.js';
import type {Address, PlaceSuggestion, PlacesProvider} from './types.js';
import {usePlaceSearch} from './usePlaceSearch.js';

export interface AddressFieldProps extends CommonFieldProps {
  /**
   * Create it once, at module level or in `useMemo`. A new provider on every render starts
   * a new billing session each time and loses the suggestions `resolve` relies on.
   */
  readonly provider: PlacesProvider;
  readonly searchPlaceholder?: string;
  /** Characters typed before the first request. Each request costs money. */
  readonly minQueryLength?: number;
  readonly debounceMs?: number;
}

const PARTS = [
  {key: 'line1', label: 'addressLine1', required: true, autoComplete: 'address-line1'},
  {key: 'line2', label: 'addressLine2', required: false, autoComplete: 'address-line2'},
  {key: 'city', label: 'city', required: true, autoComplete: 'address-level2'},
  {key: 'region', label: 'region', required: false, autoComplete: 'address-level1'},
  {key: 'postalCode', label: 'postalCode', required: true, autoComplete: 'postal-code'},
  {key: 'country', label: 'country', required: true, autoComplete: 'country'},
] as const satisfies readonly {key: keyof Address; label: keyof FormLabels; required: boolean; autoComplete: string}[];

const ADDRESS: ValueExpectation = {
  test: (value) => typeof value === 'object' && value !== null && PARTS.every(({key}) => key in value),
  description: 'an Address object (EMPTY_ADDRESS is a valid start)',
};

/**
 * A postal address: a search box that fills the parts, and the parts as ordinary text
 * fields the user can correct. Each part is its own TanStack field at `<name>.city` and
 * so on, so a schema or a server error on `address.city` shows under City.
 */
export function AddressField({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  provider,
  searchPlaceholder,
  minQueryLength = 3,
  debounceMs,
}: Readonly<AddressFieldProps>) {
  const field = useFieldBinding<Address>({expect: ADDRESS});
  const parent = useFieldContext<Address>();
  const {labels} = useFormConfig();
  const search = usePlaceSearch(provider, {
    onResolved: (place) => {
      field.setValue(place.address);
      // The pick replaced every part, so a server error on one no longer applies.
      for (const {key} of PARTS) {
        const name = `${parent.name}.${key}`;
        if (parent.form.getFieldMeta(name)?.errorMap.onServer === undefined) continue;
        parent.form.setFieldMeta(name, (meta) => ({...meta, errorMap: {...meta.errorMap, onServer: undefined}}));
      }
    },
  });
  const binding = search.withLookupError(field);

  return (
    <FieldShell
      binding={binding}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
      as="fieldset"
    >
      <Box sx={{display: 'grid', gap: 1, gridTemplateColumns: {xs: '1fr', sm: '1fr 1fr'}}}>
        <Box sx={{gridColumn: '1 / -1'}}>
          <AsyncAutocompleteInput<PlaceSuggestion>
            {...search.inputProps}
            binding={binding}
            inputLabel={labels.searchAddress}
            value={null}
            minQueryLength={minQueryLength}
            debounceMs={debounceMs}
            placeholder={searchPlaceholder}
            autoFocus={autoFocus}
            disabled={disabled}
          />
        </Box>
        {PARTS.map((part) => (
          <Box key={part.key} sx={part.key === 'line1' || part.key === 'line2' ? {gridColumn: '1 / -1'} : undefined}>
            <AddressPart
              parent={parent}
              name={part.key}
              label={labels[part.label]}
              required={required === true && part.required}
              autoComplete={part.autoComplete}
              disabled={disabled}
            />
          </Box>
        ))}
      </Box>
    </FieldShell>
  );
}

interface AddressPartProps {
  readonly parent: AnyFieldApi;
  readonly name: keyof Address;
  readonly label: string;
  readonly required: boolean;
  readonly autoComplete: string;
  readonly disabled?: boolean;
}

/** Mounts `<parent>.<name>` as a real field and renders `TextField` inside it. */
function AddressPart({parent, name, label, required, autoComplete, disabled}: Readonly<AddressPartProps>) {
  const field = useField({
    form: parent.form,
    name: `${parent.name}.${name}`,
    // A server error on the address as a whole answers the parts that were submitted.
    listeners: {onChange: () => clearServerError(parent)},
  });
  return (
    <fieldContext.Provider value={field}>
      <TextField label={label} required={required} autoComplete={autoComplete} disabled={disabled} />
    </fieldContext.Provider>
  );
}
