import type {AnyFormApi} from '@tanstack/react-form';
import {act, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createRef} from 'react';

import {FormConfigProvider} from '../config/FormConfigContext.js';
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

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('renders a stored %s as empty instead of crashing, and warns', (name, stored) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <FieldHarness defaultValue={stored}>
        <NumberField label="Price" />
      </FieldHarness>,
    );
    expect(screen.getByLabelText('Price')).toHaveValue('');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`holds ${name}`));
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

  it('drops a half-typed number on reset, though the value stays null', async () => {
    const user = userEvent.setup();
    const formRef = createRef<AnyFormApi>();
    render(
      <FieldHarness defaultValue={null} formRef={formRef}>
        <NumberField label="Price" />
      </FieldHarness>,
    );
    const input = screen.getByLabelText('Price');
    await user.type(input, '-');
    expect(input).toHaveValue('-');

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

  it('stores null, not Infinity, for digits too long to be a number', async () => {
    const user = userEvent.setup();
    render(
      <FieldHarness defaultValue={null}>
        <NumberField label="Price" />
      </FieldHarness>,
    );
    const input = screen.getByLabelText('Price');
    const digits = '9'.repeat(400);
    await user.click(input);
    await user.paste(digits);
    expect(input).toHaveValue(digits);
    expect(await submitted(user)).toBe('null');
  });

  describe('unit, min, max and step', () => {
    it('shows the unit beside the input', () => {
      render(
        <FieldHarness defaultValue={10}>
          <NumberField label="Grace period" unit="minutes" />
        </FieldHarness>,
      );
      expect(screen.getByText('minutes')).toBeInTheDocument();
    });

    it('announces the bounds and the current value', () => {
      render(
        <FieldHarness defaultValue={10}>
          <NumberField label="Grace period" min={5} max={120} />
        </FieldHarness>,
      );
      const input = screen.getByRole('spinbutton', {name: 'Grace period'});
      expect(input).toHaveAttribute('aria-valuemin', '5');
      expect(input).toHaveAttribute('aria-valuemax', '120');
      expect(input).toHaveValue('10');
    });

    it('stays a plain textbox when no bound or step is set', () => {
      render(
        <FieldHarness defaultValue={null}>
          <NumberField label="Price" />
        </FieldHarness>,
      );
      expect(screen.getByRole('textbox', {name: 'Price'})).not.toHaveAttribute('aria-valuemin');
    });

    it.each([
      [{min: 5, max: 120}, 'Between 5 and 120'],
      [{min: 5}, 'At least 5'],
      [{max: 120}, 'At most 120'],
    ])('describes the range %o as "%s" when there is no description', (bounds, helper) => {
      render(
        <FieldHarness defaultValue={null}>
          <NumberField label="Grace period" {...bounds} />
        </FieldHarness>,
      );
      expect(screen.getByText(helper)).toBeInTheDocument();
    });

    it('keeps the description over the range line', () => {
      render(
        <FieldHarness defaultValue={null}>
          <NumberField label="Grace period" min={5} max={120} description="Before a booking expires" />
        </FieldHarness>,
      );
      expect(screen.getByText('Before a booking expires')).toBeInTheDocument();
      expect(screen.queryByText('Between 5 and 120')).not.toBeInTheDocument();
    });

    it('steps with the arrow keys and stops at the bounds', async () => {
      const user = userEvent.setup();
      render(
        <FieldHarness defaultValue={110}>
          <NumberField label="Grace period" min={5} max={120} step={5} />
        </FieldHarness>,
      );
      const input = screen.getByLabelText('Grace period');
      await user.click(input);
      await user.keyboard('{ArrowUp}');
      expect(input).toHaveValue('115');
      await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
      expect(input).toHaveValue('120');
      expect(await submitted(user)).toBe('120');

      await user.click(input);
      await user.clear(input);
      await user.type(input, '7');
      await user.keyboard('{ArrowDown}{ArrowDown}');
      expect(input).toHaveValue('5');
    });

    it('steps by 1 by default, from the minimum when empty, without float noise', async () => {
      const user = userEvent.setup();
      render(
        <FieldHarness defaultValue={null}>
          <NumberField label="Rate" min={3} />
        </FieldHarness>,
      );
      const input = screen.getByLabelText('Rate');
      await user.click(input);
      await user.keyboard('{ArrowUp}');
      expect(input).toHaveValue('3');
      await user.keyboard('{ArrowUp}');
      expect(input).toHaveValue('4');
    });

    it('steps from 0 when empty and there is no minimum', async () => {
      const user = userEvent.setup();
      render(
        <FieldHarness defaultValue={null}>
          <NumberField label="Rate" max={10} />
        </FieldHarness>,
      );
      const input = screen.getByLabelText('Rate');
      await user.click(input);
      await user.keyboard('{ArrowUp}');
      expect(input).toHaveValue('0');
      await user.keyboard('{ArrowUp}');
      expect(input).toHaveValue('1');
    });

    it('adds decimal steps exactly', async () => {
      const user = userEvent.setup();
      render(
        <FieldHarness defaultValue={0.1}>
          <NumberField label="Rate" step={0.2} decimalSeparator="," />
        </FieldHarness>,
      );
      const input = screen.getByLabelText('Rate');
      await user.click(input);
      await user.keyboard('{ArrowUp}');
      expect(input).toHaveValue('0,3');
    });

    it('keeps a typed value past a bound for the schema to reject', async () => {
      const user = userEvent.setup();
      render(
        <FieldHarness
          defaultValue={null}
          validate={(value) => (typeof value === 'number' && value > 120 ? 'Must be 120 or less' : undefined)}
        >
          <NumberField label="Grace period" min={5} max={120} />
        </FieldHarness>,
      );
      const input = screen.getByLabelText('Grace period');
      await user.type(input, '500');
      await user.tab();
      expect(input).toHaveValue('500');
      expect(screen.getByText('Must be 120 or less')).toBeInTheDocument();
    });

    it('reads its range line from labels', () => {
      render(
        <FormConfigProvider labels={{numberRange: (min, max) => `Zwischen ${min} und ${max}`}}>
          <FieldHarness defaultValue={null}>
            <NumberField label="Dauer" min={1} max={9} />
          </FieldHarness>
        </FormConfigProvider>,
      );
      expect(screen.getByText('Zwischen 1 und 9')).toBeInTheDocument();
    });
  });
});
