import type {AnyFormApi} from '@tanstack/react-form';
import {act, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createRef} from 'react';

import {FieldHarness} from '../test/FieldHarness.js';
import {IntegerListField} from './IntegerListField.js';
import type {IntegerListFieldProps} from './IntegerListField.js';

function setup(defaultValue: unknown = [], props: Partial<IntegerListFieldProps> = {}) {
  const user = userEvent.setup();
  const formRef = createRef<AnyFormApi>();
  const onSubmit = vi.fn();
  render(
    <FieldHarness defaultValue={defaultValue} formRef={formRef} onSubmit={onSubmit}>
      <IntegerListField label="Reminders" {...props} />
    </FieldHarness>,
  );
  return {user, formRef, onSubmit, input: screen.getByLabelText('Reminders')};
}

const chipNames = () =>
  screen.queryAllByRole('button', {name: /^Remove /}).map((chip) => chip.getAttribute('aria-label'));

async function submitted(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', {name: 'Submit'}));
  return screen.getByLabelText('Submitted value').textContent;
}

describe('IntegerListField', () => {
  it('commits an entry on comma, Enter and blur', async () => {
    const {user, input} = setup();
    await user.type(input, '15,');
    await user.type(input, '30{Enter}');
    await user.type(input, '60');
    await user.tab();

    expect(chipNames()).toEqual(['Remove 15', 'Remove 30', 'Remove 60']);
    expect(input).toHaveValue('');
    expect(await submitted(user)).toBe('[15,30,60]');
  });

  it('does not submit the form when Enter commits an entry', async () => {
    const {user, input, onSubmit} = setup();
    await user.type(input, '15{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('removes the last chip on Backspace in an empty input', async () => {
    const {user, input} = setup([15, 30]);
    await user.click(input);
    await user.keyboard('{Backspace}');
    expect(chipNames()).toEqual(['Remove 15']);
    expect(await submitted(user)).toBe('[15]');
  });

  it('removes an error chip before a valid one on Backspace', async () => {
    const {user, input} = setup([15]);
    await user.type(input, 'x,');
    await user.keyboard('{Backspace}');
    expect(chipNames()).toEqual(['Remove 15']);
    expect(screen.queryByText('x is not a whole number')).not.toBeInTheDocument();
  });

  it('does nothing on Backspace when the list and the input are empty', async () => {
    const {user, input} = setup();
    await user.click(input);
    await user.keyboard('{Backspace}');
    expect(chipNames()).toEqual([]);
    expect(input).toHaveAttribute('aria-invalid', 'false');
  });

  it('lets Enter submit the form when the input is empty', async () => {
    const {user, input, onSubmit} = setup([15]);
    await user.type(input, '{Enter}');
    expect(onSubmit).toHaveBeenCalledWith([15]);
  });

  it('leaves the value alone when the input is blurred empty', async () => {
    const {user, input} = setup([15]);
    await user.click(input);
    await user.tab();
    expect(chipNames()).toEqual(['Remove 15']);
    expect(input).toHaveAttribute('aria-invalid', 'false');
  });

  it('removes a chip when its remove button is pressed', async () => {
    const {user} = setup([15, 30, 60]);
    await user.click(screen.getByRole('button', {name: 'Remove 30'}));
    expect(await submitted(user)).toBe('[15,60]');
  });

  it('turns a pasted list into chips, with an error chip for a bad entry', async () => {
    const {user, input} = setup();
    await user.click(input);
    await user.paste('15, 30,x, 60');

    expect(chipNames()).toEqual(['Remove 15', 'Remove 30', 'Remove 60', 'Remove x']);
    expect(screen.getByText('x is not a whole number')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('keeps a pasted entry with no comma in the input as a draft', async () => {
    const {user, input} = setup();
    await user.click(input);
    await user.paste('15');
    expect(input).toHaveValue('15');
    expect(chipNames()).toEqual([]);
  });

  it('skips empty pieces in a pasted list', async () => {
    const {user, input} = setup();
    await user.click(input);
    await user.paste('15, ,30,');
    expect(chipNames()).toEqual(['Remove 15', 'Remove 30']);
    expect(input).toHaveAttribute('aria-invalid', 'false');
  });

  it('shows no chips when the value is not an array', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setup(null);
    expect(chipNames()).toEqual([]);
    warn.mockRestore();
  });

  it('keeps a bad entry out of the value and blocks submit until it is removed', async () => {
    const {user, input, onSubmit} = setup();
    await user.type(input, '15,1.5,');
    expect(screen.getByText('1.5 is not a whole number')).toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: 'Submit'}));
    expect(onSubmit).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', {name: 'Remove 1.5'}));
    expect(screen.queryByText('1.5 is not a whole number')).not.toBeInTheDocument();
    expect(await submitted(user)).toBe('[15]');
    expect(onSubmit).toHaveBeenCalledWith([15]);
  });

  it('marks an entry outside min and max as an error', async () => {
    const {user, input} = setup([], {min: 5, max: 120});
    expect(screen.getByText('Between 5 and 120')).toBeInTheDocument();
    await user.type(input, '500,');
    expect(screen.getByText('500 is not between 5 and 120')).toBeInTheDocument();
    expect(await submitted(user)).toBe('');
  });

  it.each([
    [{min: 5}, 'At least 5', '2', '2 is below 5'],
    [{max: 120}, 'At most 120', '500', '500 is above 120'],
  ])('marks an entry past a one-sided bound %o as an error', async (bounds, helper, entry, message) => {
    const {user, input} = setup([], bounds);
    expect(screen.getByText(helper)).toBeInTheDocument();
    await user.type(input, `${entry},`);
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('marks a repeat as an error unless duplicates are allowed', async () => {
    const {user, input} = setup([15]);
    await user.type(input, '15,');
    expect(screen.getByText('15 is already in the list')).toBeInTheDocument();
  });

  it('keeps a repeat when allowDuplicates is set', async () => {
    const {user, input} = setup([15], {allowDuplicates: true});
    await user.type(input, '15,');
    expect(await submitted(user)).toBe('[15,15]');
  });

  it('keeps entry order by default', async () => {
    const {user, input} = setup();
    await user.type(input, '60,15,');
    expect(await submitted(user)).toBe('[60,15]');
  });

  it('sorts on commit when sorted is set', async () => {
    const {user, input} = setup([60, 15], {sorted: true});
    await user.type(input, '30,');
    expect(await submitted(user)).toBe('[15,30,60]');
  });

  it('shows the unit on each chip and keeps the value a plain number', async () => {
    const {user} = setup([15, 30], {unit: 'min'});
    expect(screen.getByText('15 min')).toBeInTheDocument();
    expect(chipNames()).toEqual(['Remove 15 min', 'Remove 30 min']);
    expect(await submitted(user)).toBe('[15,30]');
  });

  it('clears error chips when the form resets', async () => {
    const {user, input, formRef} = setup([15]);
    await user.type(input, 'x,');
    expect(chipNames()).toContain('Remove x');

    act(() => formRef.current?.reset());
    expect(chipNames()).toEqual(['Remove 15']);
    expect(await submitted(user)).toBe('[15]');
  });

  it('warns once in development when the value is not an array of numbers', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setup(['15']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('an array of finite numbers'));
    warn.mockRestore();
  });
});
