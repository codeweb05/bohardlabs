import type {AutocompleteRenderInputParams} from '@mui/material/Autocomplete';
import MuiTextField from '@mui/material/TextField';

import type {FieldBinding} from './useFieldBinding';

interface Extra {
  readonly autoFocus?: boolean;
  readonly placeholder?: string;
  /** `aria-label` for the input, when no `<label>` names it. */
  readonly inputLabel?: string;
}

/**
 * The `renderInput` body every Autocomplete-based field shares: forwards MUI's own params,
 * merges the field's aria/data attributes onto the real `<input>` through MUI 9's
 * `slotProps.htmlInput` (never the old `inputProps`), and turns the field's error into the
 * boolean `TextField` wants.
 */
export function renderAutocompleteInput(
  params: AutocompleteRenderInputParams,
  binding: Pick<FieldBinding<unknown>, 'error' | 'inputProps'>,
  extra?: Extra,
) {
  return (
    <MuiTextField
      {...params}
      autoFocus={extra?.autoFocus}
      placeholder={extra?.placeholder}
      error={binding.error !== null}
      slotProps={{
        ...params.slotProps,
        htmlInput: {...params.slotProps.htmlInput, ...binding.inputProps, 'aria-label': extra?.inputLabel},
      }}
    />
  );
}
