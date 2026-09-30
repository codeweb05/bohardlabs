import type {AnyFormApi} from '@tanstack/react-form';
import {act, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createRef} from 'react';

import {FieldHarness} from '../test/FieldHarness.js';
import {NumberField} from './NumberField.js';

async function submitted(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', {name: 'Submit'}));
  return screen.getByLabelText('Submitted value').textContent;
}

describe('NumberField', () => {
  it('stores a number, and null when empty', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <NumberField label="Price" />
      </FieldHarness>,
    );
    const input = screen.getByLabelText('Price');
    expect(input).toHaveAttribute('inputmode', 'decimal');

    await user.type(input, '12.50');
    expect(await submitted(user)).toBe('12.5');

    await user.clear(input);
    expect(await submitted(user)).toBe('null');
  });

  it('reads and writes a comma when decimalSeparator is a comma', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={3.25}>
        <NumberField label="Price" decimalSeparator="," />
      </FieldHarness>,
    );
    const input = screen.getByLabelText('Price');
    expect(input).toHaveValue('3,25');

    await user.clear(input);
    await user.type(input, '7,5');
    expect(await submitted(user)).toBe('7.5');
  });

  it('keeps a half-typed number on screen', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <NumberField label="Price" />
      </FieldHarness>,
    );
    const input = screen.getByLabelText('Price');
    await user.type(input, '-');
    expect(input).toHaveValue('-');
    await user.type(input, '4.');
    expect(input).toHaveValue('-4.');
    expect(await submitted(user)).toBe('-4');
  });

  it('ignores keystrokes that cannot be part of a number', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <NumberField label="Quantity" allowDecimals={false} />
      </FieldHarness>,
    );
    const input = screen.getByLabelText('Quantity');
    await user.type(input, '1a2.e3');
    expect(input).toHaveValue('123');
  });

  it('shows a value set from outside, replacing what was typed', async () => {
    const user = userEvent.setup();
    const formRef = createRef<AnyFormApi>();
    render(
      <FieldHarness defaultValue={null} formRef={formRef}>
        <NumberField label="Price" />
      </FieldHarness>,
    );
    const input = screen.getByLabelText('Price');
    await user.type(input, '5.');

    act(() => formRef.current?.setFieldValue('value', 42));
    expect(input).toHaveValue('42');

    act(() => formRef.current?.reset());
    expect(input).toHaveValue('');
  });

  it('replaces a half-typed comma draft on a differing external change, but not on one that matches it', async () => {
    const user = userEvent.setup();
    const formRef = createRef<AnyFormApi>();
    render(
      <FieldHarness defaultValue={null} formRef={formRef}>
        <NumberField label="Price" decimalSeparator="," />
      </FieldHarness>,
    );
    const input = screen.getByLabelText('Price');

    // A draft the user is still typing is replaced once an outside value actually differs from it.
    await user.type(input, '1,');
    expect(input).toHaveValue('1,');
    act(() => formRef.current?.setFieldValue('value', 99));
    expect(input).toHaveValue('99');

    // A fresh draft that already amounts to the same number an outside call sets is left alone:
    // the field only resyncs the text when the numeric value actually changes.
    await user.clear(input);
    await user.type(input, '2,');
    expect(input).toHaveValue('2,');
    act(() => formRef.current?.setFieldValue('value', 2));
    expect(input).toHaveValue('2,');
  });
});
