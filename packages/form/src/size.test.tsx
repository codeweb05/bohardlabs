import {AdapterDateFns} from '@mui/x-date-pickers/AdapterDateFns';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {queryHelpers, render, screen} from '@testing-library/react';
import type {ReactNode} from 'react';

import {FormConfigProvider} from './config/FormConfigContext.js';
import type {CommonFieldProps} from './core/types.js';
import {createAppForm} from './createAppForm.js';
import {AsyncAutocompleteField} from './fields/AsyncAutocompleteField.js';
import {CheckboxField} from './fields/CheckboxField.js';
import {DurationField} from './fields/DurationField.js';
import {MultiSelectField} from './fields/MultiSelectField.js';
import {NumberField} from './fields/NumberField.js';
import {PasswordField} from './fields/PasswordField.js';
import {RadioGroupField} from './fields/RadioGroupField.js';
import {SearchableSelectField} from './fields/SearchableSelectField.js';
import {SelectField} from './fields/SelectField.js';
import {SwitchField} from './fields/SwitchField.js';
import {TextArea} from './fields/TextArea.js';
import {TextField} from './fields/TextField.js';
import {CancelButton} from './form/CancelButton.js';
import {SubmitButton} from './form/SubmitButton.js';
import {AddressField} from './maps/AddressField.js';
import {LocationSearchField} from './maps/LocationSearchField.js';
import {PhoneField} from './phone/PhoneField.js';
import {DateField} from './pickers/DateField.js';
import {DateRangeField} from './pickers/DateRangeField.js';
import {TimePickerField} from './pickers/TimePickerField.js';
import {createFakePlaces} from './test/fakePlaces.js';
import {FieldHarness} from './test/FieldHarness.js';

type Size = CommonFieldProps['size'];

const OPTIONS = [
  {value: 'a', label: 'A'},
  {value: 'b', label: 'B'},
];
const {provider: places} = createFakePlaces([]);
const loadOptions = async () => OPTIONS;
const asyncProps = {
  loadOptions,
  getOptionValue: (o: {value: string}) => o.value,
  getOptionLabel: (o: {label: string}) => o.label,
};

// Each family's MUI control root. A small control carries a `…sizeSmall` or `…SizeSmall` class.
const CONTROL = /\bMui(InputBase|PickersInputBase|Checkbox|Switch|Radio)-root\b/;

const FAMILIES: [string, unknown, (size: Size) => ReactNode][] = [
  ['TextField', '', (size) => <TextField label="F" size={size} />],
  ['TextArea', '', (size) => <TextArea label="F" size={size} />],
  ['PasswordField', '', (size) => <PasswordField label="F" size={size} />],
  ['NumberField', null, (size) => <NumberField label="F" size={size} />],
  ['SelectField', null, (size) => <SelectField label="F" options={OPTIONS} size={size} />],
  ['SearchableSelectField', null, (size) => <SearchableSelectField label="F" options={OPTIONS} size={size} />],
  ['MultiSelectField', [], (size) => <MultiSelectField label="F" options={OPTIONS} size={size} />],
  [
    'MultiSelectField searchable',
    [],
    (size) => <MultiSelectField label="F" options={OPTIONS} searchable size={size} />,
  ],
  ['AsyncAutocompleteField', null, (size) => <AsyncAutocompleteField label="F" {...asyncProps} size={size} />],
  ['DurationField', null, (size) => <DurationField label="F" size={size} />],
  ['RadioGroupField', null, (size) => <RadioGroupField label="F" options={OPTIONS} size={size} />],
  ['CheckboxField', false, (size) => <CheckboxField label="F" size={size} />],
  ['SwitchField', false, (size) => <SwitchField label="F" size={size} />],
  ['DateField', null, (size) => <DateField label="F" size={size} />],
  ['TimePickerField', null, (size) => <TimePickerField label="F" size={size} />],
  ['DateRangeField', {start: null, end: null}, (size) => <DateRangeField label="F" size={size} />],
  ['PhoneField', null, (size) => <PhoneField label="F" size={size} />],
  ['LocationSearchField', null, (size) => <LocationSearchField label="F" provider={places} size={size} />],
  [
    'AddressField',
    {line1: '', line2: '', city: '', region: '', postalCode: '', country: ''},
    (size) => <AddressField label="F" provider={places} size={size} />,
  ],
];

/** Every control on the page; each test renders one field, and cleanup removes it after. */
function controls(): HTMLElement[] {
  const found = queryHelpers.queryAllByAttribute('class', document.body, CONTROL);
  if (found.length === 0) throw new Error('No MUI control rendered');
  return found;
}

const isSmall = (element: Element) => /[sS]izeSmall/.test(element.className);

describe.each(FAMILIES)('%s size', (_name, defaultValue, field) => {
  function renderField(fieldSize: Size, providerSize?: Size) {
    return render(
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <FormConfigProvider size={providerSize}>
          <FieldHarness defaultValue={defaultValue}>{field(fieldSize)}</FieldHarness>
        </FormConfigProvider>
      </LocalizationProvider>,
    );
  }

  it("is MUI's default with no size anywhere", () => {
    renderField(undefined);
    expect(controls().some(isSmall)).toBe(false);
  });

  it('follows the provider', () => {
    renderField(undefined, 'small');
    expect(controls().every(isSmall)).toBe(true);
  });

  it("takes the field's own size over the provider's", () => {
    renderField('small');
    expect(controls().every(isSmall)).toBe(true);
  });

  it('lets a medium field override a small provider', () => {
    renderField('medium', 'small');
    expect(controls().some(isSmall)).toBe(false);
  });
});

const {useAppForm} = createAppForm({fieldComponents: {}, formComponents: {SubmitButton, CancelButton}});

function Buttons() {
  const form = useAppForm({defaultValues: {}});
  return (
    <form.AppForm>
      <form.SubmitButton>Save</form.SubmitButton>
      <form.CancelButton onCancel={() => {}} />
    </form.AppForm>
  );
}

describe('form buttons size', () => {
  it('follow the provider', () => {
    render(
      <FormConfigProvider size="small">
        <Buttons />
      </FormConfigProvider>,
    );
    expect(screen.getByRole('button', {name: 'Save'})).toHaveClass('MuiButton-sizeSmall');
    expect(screen.getByRole('button', {name: 'Cancel'})).toHaveClass('MuiButton-sizeSmall');
  });

  it("are MUI's default without one", () => {
    render(<Buttons />);
    expect(screen.getByRole('button', {name: 'Save'})).not.toHaveClass('MuiButton-sizeSmall');
  });
});
