// The date field with its adapter, as one lazily loaded module. An app that mounts
// LocalizationProvider at its root pays for the adapter up front instead; this fixture
// measures the package, so it keeps the adapter out of the main chunk too.
import {AdapterDateFns} from '@mui/x-date-pickers/AdapterDateFns';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {DateField} from '@vt-labs/form/pickers';
import type {DateFieldProps} from '@vt-labs/form/pickers';

export function BirthdayField(props: DateFieldProps) {
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <DateField {...props} />
    </LocalizationProvider>
  );
}
