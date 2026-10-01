import Stack from '@mui/material/Stack';
import {AdapterDateFns} from '@mui/x-date-pickers/AdapterDateFns';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {StrictMode} from 'react';
import {expect, fn, screen, userEvent, waitFor, within} from 'storybook/test';

import {FormConfigProvider} from '../config/FormConfigContext.js';
import type {FormLabels} from '../config/labels.js';
import {createAppForm} from '../createAppForm.js';
import {DurationField} from '../fields/DurationField.js';
import {MultiSelectField} from '../fields/MultiSelectField.js';
import {RadioGroupField} from '../fields/RadioGroupField.js';
import {SelectField} from '../fields/SelectField.js';
import {TextArea} from '../fields/TextArea.js';
import {TextField} from '../fields/TextField.js';
import {CancelButton} from '../form/CancelButton.js';
import {FormError} from '../form/FormError.js';
import {SubmitButton} from '../form/SubmitButton.js';
import {DateRangeField} from '../pickers/DateRangeField.js';
import {applyServerErrors} from '../serverErrors.js';

const {useAppForm} = createAppForm({
  fieldComponents: {TextField, TextArea, DurationField, DateRangeField},
  formComponents: {SubmitButton, CancelButton, FormError},
});

// Module level, as the provider asks: a new object each render would rebuild the config.
const LABELS: Partial<FormLabels> = {cancel: 'Discard', moreInfo: 'About this field'};

const PRIORITIES = [
  {value: 'low', label: 'Low'},
  {value: 'high', label: 'High'},
];

const TAGS = [
  {value: 'outdoor', label: 'Outdoor'},
  {value: 'ladder', label: 'Needs a ladder'},
  {value: 'keys', label: 'Keys at reception'},
];

const CREW = [
  {value: 1, label: 'Ada'},
  {value: 2, label: 'Grace'},
];

const BILLING = [
  {value: 'fixed', label: 'Fixed price'},
  {value: 'hourly', label: 'Hourly'},
];

interface Job {
  title: string;
  notes: string;
  priority: string | null;
  tags: string[];
  crew: number[];
  estimate: number | null;
  billing: string | null;
  window: {start: string | null; end: string | null};
}

const EMPTY_JOB: Job = {
  title: '',
  notes: '',
  priority: null,
  tags: [],
  crew: [],
  estimate: null,
  billing: null,
  window: {start: '2026-05-01', end: '2026-05-04'},
};

interface JobFormProps {
  /** Receives the values of a submit that passed validation. */
  readonly onSave: (job: Job) => void;
  readonly onCancel: () => void;
}

/** One of each layout the package has, under a provider that renames two labels. */
function JobForm({onSave, onCancel}: JobFormProps) {
  const form = useAppForm({
    defaultValues: EMPTY_JOB,
    onSubmit: async ({value, formApi}) => {
      onSave(value);
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (value.title === 'Deck wash') applyServerErrors(formApi, {form: 'A job with this title already exists.'});
    },
  });

  return (
    <Stack
      component="form"
      spacing={1}
      noValidate
      sx={{maxWidth: 420}}
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="title" validators={{onSubmit: ({value}) => (value ? undefined : 'Enter a title')}}>
        {(field) => <field.TextField label="Title" required tooltip="Shown on the invoice" />}
      </form.AppField>
      <form.AppField name="notes">
        {(field) => <field.TextArea label="Notes" description="Only the crew sees these" />}
      </form.AppField>
      <form.AppField name="priority">
        {() => <SelectField label="Priority" options={PRIORITIES} tooltip="High jobs are scheduled first" />}
      </form.AppField>
      <form.AppField name="tags">
        {() => (
          <MultiSelectField label="Tags" options={TAGS} placeholder="Pick any that apply" tooltip="Used to filter" />
        )}
      </form.AppField>
      <form.AppField name="crew">
        {() => <MultiSelectField label="Crew" options={CREW} searchable placeholder="Search the crew" />}
      </form.AppField>
      <form.AppField name="estimate">{(field) => <field.DurationField label="Estimate" maxHours={8} />}</form.AppField>
      <form.AppField name="billing">{() => <RadioGroupField label="Billing" options={BILLING} />}</form.AppField>
      <form.AppField name="window">{(field) => <field.DateRangeField label="Window" />}</form.AppField>
      <form.AppForm>
        <form.FormError />
        <Stack direction="row" spacing={1}>
          <form.SubmitButton submittingLabel="Saving…">Save job</form.SubmitButton>
          <form.CancelButton onCancel={onCancel} />
        </Stack>
      </form.AppForm>
    </Stack>
  );
}

const meta = {
  title: 'Form/Strict mode',
  component: JobForm,
  args: {onSave: fn(), onCancel: fn()},
  // A consumer's app usually runs under StrictMode, which renders every component twice in
  // development. The preview does not, so this story brings its own.
  decorators: [
    (Story) => (
      <StrictMode>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <FormConfigProvider labels={LABELS}>
            <Story />
          </FormConfigProvider>
        </LocalizationProvider>
      </StrictMode>
    ),
  ],
} satisfies Meta<typeof JobForm>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A whole form under `StrictMode` and a `FormConfigProvider`. The double render must not
 * double anything a user sees: each pick is stored once, a save reaches `onSubmit` once,
 * and the server's message is announced by one alert.
 */
export const WholeForm: Story = {
  play: async ({canvasElement, args}) => {
    const canvas = within(canvasElement);
    const save = canvas.getByRole('button', {name: 'Save job'});

    // The provider's labels reach the cancel button and the info buttons.
    await expect(canvas.getByRole('button', {name: 'Discard'})).toBeInTheDocument();
    await expect(canvas.getAllByRole('button', {name: 'About this field'})).toHaveLength(3);
    await expect(canvas.getByRole('combobox', {name: 'Tags'})).toHaveTextContent('Pick any that apply');

    await userEvent.click(save);
    await waitFor(() => expect(canvas.getByRole('textbox', {name: /Title/})).toHaveFocus());
    await expect(canvas.getByRole('textbox', {name: /Title/})).toHaveAccessibleDescription('Enter a title');
    await expect(args.onSave).not.toHaveBeenCalled();

    await userEvent.type(canvas.getByRole('textbox', {name: /Title/}), 'Gutter clean');
    await userEvent.type(canvas.getByRole('textbox', {name: 'Notes'}), 'Side gate');
    await userEvent.click(canvas.getByRole('combobox', {name: 'Priority'}));
    await userEvent.click(await screen.findByRole('option', {name: 'High'}));
    await userEvent.click(canvas.getByRole('combobox', {name: 'Tags'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Outdoor'}));
    await userEvent.click(screen.getByRole('option', {name: 'Needs a ladder'}));
    await userEvent.keyboard('{Escape}');
    await userEvent.type(canvas.getByRole('combobox', {name: 'Crew'}), 'gra');
    await userEvent.click(await screen.findByRole('option', {name: 'Grace'}));
    await userEvent.click(canvas.getByRole('combobox', {name: /Hours/}));
    await userEvent.click(await screen.findByRole('option', {name: '2'}));
    await userEvent.click(canvas.getByRole('radio', {name: 'Hourly'}));

    await userEvent.click(save);
    await waitFor(() => expect(args.onSave).toHaveBeenCalledTimes(1));
    await expect(args.onSave).toHaveBeenCalledWith({
      title: 'Gutter clean',
      notes: 'Side gate',
      priority: 'high',
      tags: ['outdoor', 'ladder'],
      crew: [2],
      estimate: 120,
      billing: 'hourly',
      window: {start: '2026-05-01', end: '2026-05-04'},
    });
    await waitFor(() => expect(save).toBeEnabled());
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();

    const title = canvas.getByRole('textbox', {name: /Title/});
    await userEvent.clear(title);
    await userEvent.type(title, 'Deck wash');
    await userEvent.click(save);
    await expect(await canvas.findByRole('alert')).toHaveTextContent('A job with this title already exists.');
    await expect(canvas.getAllByRole('alert')).toHaveLength(1);

    await userEvent.click(canvas.getByRole('button', {name: 'Discard'}));
    await waitFor(() => expect(args.onCancel).toHaveBeenCalledTimes(1));
  },
};
