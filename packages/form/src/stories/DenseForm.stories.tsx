import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {expect, fn, within} from 'storybook/test';

import {FormConfigProvider} from '../config/FormConfigContext.js';
import {createAppForm} from '../createAppForm.js';
import {CheckboxField} from '../fields/CheckboxField.js';
import {DurationField} from '../fields/DurationField.js';
import {NumberField} from '../fields/NumberField.js';
import {SelectField} from '../fields/SelectField.js';
import {TextField} from '../fields/TextField.js';
import {CancelButton} from '../form/CancelButton.js';
import {SubmitButton} from '../form/SubmitButton.js';

const {useAppForm} = createAppForm({
  fieldComponents: {TextField, NumberField, SelectField, DurationField, CheckboxField},
  formComponents: {SubmitButton, CancelButton},
});

const KINDS = [
  {value: 'room', label: 'Room'},
  {value: 'desk', label: 'Desk'},
];

interface PanelProps {
  readonly size: 'small' | 'medium';
  readonly onCancel: () => void;
}

/** A side-panel editor, 360px wide. Every field and both buttons take the provider's size. */
function Panel({size, onCancel}: PanelProps) {
  const form = useAppForm({
    defaultValues: {name: 'Meeting room 2', kind: 'room', capacity: 8, opening: 540, bookable: true},
  });

  return (
    <FormConfigProvider size={size}>
      <Paper variant="outlined" sx={{width: 360, p: 2}}>
        <Stack
          component="form"
          spacing={0.5}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.AppField name="name">{(field) => <field.TextField label="Name" />}</form.AppField>
          <form.AppField name="kind">{(field) => <field.SelectField label="Kind" options={KINDS} />}</form.AppField>
          <form.AppField name="capacity">
            {(field) => <field.NumberField label="Capacity" unit="people" min={1} max={40} />}
          </form.AppField>
          <form.AppField name="opening">
            {(field) => <field.DurationField label="Opens after midnight" />}
          </form.AppField>
          <form.AppField name="bookable">{(field) => <field.CheckboxField label="Bookable" />}</form.AppField>
          <form.AppForm>
            <Stack direction="row" spacing={1}>
              <form.SubmitButton>Save</form.SubmitButton>
              <form.CancelButton onCancel={onCancel} />
            </Stack>
          </form.AppForm>
        </Stack>
      </Paper>
    </FormConfigProvider>
  );
}

const meta = {
  title: 'Form/Dense form',
  component: Panel,
  args: {size: 'small', onCancel: fn()},
  argTypes: {size: {control: 'inline-radio', options: ['small', 'medium']}},
} satisfies Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * `size="small"` on `FormConfigProvider` makes every field below it small, and the submit and
 * cancel buttons with them. A field's own `size` would win over the provider's.
 */
export const Small: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const inputs = canvasElement.querySelectorAll('.MuiInputBase-root');
    await expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) await expect(input).toHaveClass('MuiInputBase-sizeSmall');
    await expect(canvasElement.querySelector('.MuiCheckbox-root')).toHaveClass('MuiCheckbox-sizeSmall');
    await expect(canvas.getByRole('button', {name: 'Save'})).toHaveClass('MuiButton-sizeSmall');
    await expect(canvas.getByRole('button', {name: 'Cancel'})).toHaveClass('MuiButton-sizeSmall');
  },
};

/** The same panel at MUI's default size, for comparison. */
export const Medium: Story = {
  args: {size: 'medium'},
  play: async ({canvasElement}) => {
    for (const input of canvasElement.querySelectorAll('.MuiInputBase-root')) {
      await expect(input).not.toHaveClass('MuiInputBase-sizeSmall');
    }
  },
};
