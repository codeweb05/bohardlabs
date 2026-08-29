/**
 * Coverage for `EditSelectField`, previously 0%.
 *
 * The select shown for `editConfig.type: 'select'` columns. Same contract as
 * `EditTextField`: take focus on mount, report the chosen option value, and keep
 * events off the row.
 *
 * The last block guards a bug that has since been fixed; it is kept as a regression test.
 */
import {fireEvent, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {render} from '../test/test-utils';
import type {FilterOption} from '../types';
import {EditSelectField} from './EditSelectField';

const options: FilterOption[] = [
  {value: 'ACTIVE', label: 'Active'},
  {value: 'PENDING', label: 'Pending'},
];

const onChange = vi.fn<(value: string | number) => void>();

beforeEach(() => {
  onChange.mockReset();
});

describe('EditSelectField', () => {
  it('shows the label of the current value, not the raw value', () => {
    render(<EditSelectField value="PENDING" onChange={onChange} options={options} />);

    expect(screen.getByRole('combobox')).toHaveTextContent('Pending');
  });

  it('renders every option', async () => {
    render(<EditSelectField value="ACTIVE" onChange={onChange} options={options} />);

    await userEvent.click(screen.getByRole('combobox'));

    expect(await screen.findByRole('option', {name: 'Active'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Pending'})).toBeInTheDocument();
  });

  it('reports the option value, not its label', async () => {
    render(<EditSelectField value="ACTIVE" onChange={onChange} options={options} />);

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', {name: 'Pending'}));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('PENDING');
  });

  it('renders an empty selection rather than crashing on an unknown value', () => {
    // Persisted or stale row data can hold a status the options list no longer has.
    render(<EditSelectField value="ARCHIVED" onChange={onChange} options={options} />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('cannot be opened while disabled', async () => {
    render(<EditSelectField value="ACTIVE" onChange={onChange} options={options} disabled />);

    await userEvent.click(screen.getByRole('combobox'));

    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('marks the select invalid and explains why on hover', async () => {
    render(<EditSelectField value="ACTIVE" onChange={onChange} options={options} error="Not allowed here" />);

    await userEvent.hover(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent('Not allowed here');
    });
  });

  it('has no tooltip without an error', () => {
    render(<EditSelectField value="ACTIVE" onChange={onChange} options={options} />);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('renders the same output when re-rendered with unchanged props', () => {
    // React Compiler memoizes this component, so a re-render with identical props takes
    // the cache-hit path rather than rebuilding the element. That path is never
    // exercised by a test that only mounts, and it is where a compiler bug or a mutated
    // prop would show up: the field would keep painting a value the row no longer holds.
    const {rerender} = render(<EditSelectField value="ACTIVE" onChange={onChange} options={options} />);

    rerender(<EditSelectField value="ACTIVE" onChange={onChange} options={options} />);

    expect(screen.getByRole('combobox')).toHaveTextContent('Active');
  });

  it('keeps keystrokes off the row', () => {
    // The row underneath listens for keyboard shortcuts (Escape to cancel, Enter to
    // save the row). Typing inside the select must not reach them, or picking an option
    // with the keyboard cancels the edit that is being made.
    const onRowKeyDown = vi.fn();
    render(<EditSelectField value="ACTIVE" onChange={onChange} options={options} />);
    document.body.addEventListener('keydown', onRowKeyDown);

    // fireEvent rather than userEvent.type: typing first clicks the select open, and the
    // dropdown renders in a portal outside the row, so what happened after that would
    // say nothing about whether the row's own handler was shielded.
    fireEvent.keyDown(screen.getByRole('combobox'), {key: 'Escape'});

    document.body.removeEventListener('keydown', onRowKeyDown);
    expect(onRowKeyDown).not.toHaveBeenCalled();
  });

  it('keeps clicks off the row', async () => {
    // Listener on document.body, above React's root container, so this measures real
    // DOM bubbling.
    const onRowClick = vi.fn();
    render(<EditSelectField value="ACTIVE" onChange={onChange} options={options} />);
    document.body.addEventListener('click', onRowClick);

    await userEvent.click(screen.getByRole('combobox'));

    document.body.removeEventListener('click', onRowClick);
    expect(onRowClick).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// REGRESSION — editing/EditSelectField.tsx:29
//
//   useEffect(() => {
//     if (autoFocus && selectRef.current) {
//       const input = selectRef.current.querySelector('input');
//       input?.focus();
//     }
//   }, [autoFocus]);
//
// The ref is on `<FormControl>`, and the only `<input>` inside a MUI Select is the
// hidden native input that carries the form value — it is not focusable and is not
// what a keyboard user interacts with. The focusable element is the combobox div
// (`[role="combobox"]`). So a row that drops into edit mode on a select column leaves
// focus wherever it was, and `EditTextField` (which does focus correctly) and this
// component behave differently for no reason the user can see.
//
// Failed when written; passes now that the effect targets `[role="combobox"]`.
// ===========================================================================
describe('Regression — the select must take focus on mount', () => {
  it('focuses the select when it opens for editing', () => {
    render(<EditSelectField value="ACTIVE" onChange={onChange} options={options} />);

    expect(screen.getByRole('combobox')).toHaveFocus();
  });
});
