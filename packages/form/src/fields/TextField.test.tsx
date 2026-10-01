import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {FormConfigProvider} from '../config/FormConfigContext.js';
import {FieldHarness} from '../test/FieldHarness.js';
import {TextArea} from './TextArea.js';
import {TextField} from './TextField.js';

const required = (value: unknown) => (value ? undefined : 'Required');

describe('TextField', () => {
  it('labels the input with a real label element and reports the value on submit', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue="">
        <TextField label="Email" type="email" />
      </FieldHarness>,
    );

    await user.type(screen.getByLabelText('Email'), 'a@b.co');
    await user.click(screen.getByRole('button', {name: 'Submit'}));

    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('"a@b.co"');
  });

  it('keeps the helper row when the description is an empty string', () => {
    render(
      <FieldHarness defaultValue="">
        <TextField label="Email" description="" />
      </FieldHarness>,
    );
    // A zero-width space holds the line, so the form does not jump when an error appears.
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('\u200b');
  });

  it('marks required with aria-required and a hidden asterisk', () => {
    render(
      <FieldHarness defaultValue="">
        <TextField label="Email" required />
      </FieldHarness>,
    );
    const input = screen.getByLabelText(/Email/);
    expect(input).toBeRequired();
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows the description until an error replaces it, and wires aria-describedby to it', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue="" validate={required}>
        <TextField label="Name" description="As on your ID" />
      </FieldHarness>,
    );
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAccessibleDescription('As on your ID');
    expect(input).toHaveAttribute('aria-invalid', 'false');

    await user.click(input);
    await user.tab();

    expect(input).toHaveAccessibleDescription('Required');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows no error before the field is touched', () => {
    render(
      <FieldHarness defaultValue="" validate={required}>
        <TextField label="Name" />
      </FieldHarness>,
    );
    expect(screen.queryByText('Required')).not.toBeInTheDocument();
  });

  it('passes the error through formatError', async () => {
    const user = userEvent.setup();
    render(
      <FormConfigProvider formatError={(issue) => `Sorry: ${issue.message}`}>
        <FieldHarness defaultValue="" validate={required}>
          <TextField label="Name" />
        </FieldHarness>
      </FormConfigProvider>,
    );
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(await screen.findByText('Sorry: Required')).toBeInTheDocument();
  });

  it('gives two fields with the same name different ids', () => {
    render(
      <>
        <FieldHarness defaultValue="">
          <TextField label="First" />
        </FieldHarness>
        <FieldHarness defaultValue="">
          <TextField label="Second" />
        </FieldHarness>
      </>,
    );
    expect(screen.getByLabelText('First').id).not.toBe(screen.getByLabelText('Second').id);
  });

  it('puts the tooltip behind a focusable button with an accessible name', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue="">
        <TextField label="Slug" tooltip="Used in the URL" />
      </FieldHarness>,
    );
    await user.tab();
    expect(screen.getByRole('button', {name: 'More information'})).toHaveFocus();
    // Focus-visible tooltip triggering is unreliable in jsdom; hover it open explicitly.
    await user.hover(screen.getByRole('button', {name: 'More information'}));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Used in the URL');
  });

  it('warns once in development when the value is not a string', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <FieldHarness defaultValue={42}>
        <TextField label="Name" />
      </FieldHarness>,
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('"value"');
  });

  it('renders a stored null as an empty input, and stores what is typed over it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <TextField label="Name" />
      </FieldHarness>,
    );
    const input = screen.getByLabelText('Name');
    expect(input).toHaveValue('');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('holds null'));

    await user.type(input, 'Ada');
    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(screen.getByLabelText('Submitted value')).toHaveTextContent('"Ada"');
  });
});

describe('TextArea', () => {
  it('renders a multiline textbox with at least three rows', () => {
    render(
      <FieldHarness defaultValue="">
        <TextArea label="Notes" />
      </FieldHarness>,
    );
    const box = screen.getByLabelText('Notes');
    expect(box.tagName).toBe('TEXTAREA');
    expect(box).toHaveAttribute('rows', '3');
  });
});
