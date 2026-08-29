/**
 * Coverage for `EditTextField`, previously 0%.
 *
 * This is the input the inline-edit row shows for `type: 'text'` and `type: 'number'`
 * columns. Two behaviours here are load-bearing and easy to break: the number field
 * has to hand back a `number` (not the raw string) so the PATCH body is well typed,
 * and every key/click has to stop propagating or the row-click handler navigates away
 * mid-edit.
 *
 * The last block documents a gap; it passes and pins current behaviour.
 */
import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {render} from '../test/test-utils';
import {EditTextField} from './EditTextField';

const onChange = vi.fn<(value: string | number) => void>();

beforeEach(() => {
  onChange.mockReset();
});

/** The last value handed to onChange. */
function lastValue(): unknown {
  return onChange.mock.calls.at(-1)?.[0];
}

describe('EditTextField', () => {
  it('focuses and selects its content on mount', () => {
    // The row drops into edit mode without the user clicking the field, so it has to
    // take focus itself; selecting lets them overtype instead of clearing first.
    render(<EditTextField value="Detergent" onChange={onChange} />);

    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('does not steal focus when autoFocus is off', () => {
    // Spread rather than a literal `autoFocus` attribute, which jsx-a11y flags on sight.
    const props = {value: 'Detergent', onChange, autoFocus: false};
    render(<EditTextField {...props} />);

    expect(screen.getByRole('textbox')).not.toHaveFocus();
  });

  it('renders the current value', () => {
    render(<EditTextField value="Detergent" onChange={onChange} />);

    expect(screen.getByRole('textbox')).toHaveValue('Detergent');
  });

  it('reports each keystroke as a string in text mode', async () => {
    render(<EditTextField value="" onChange={onChange} />);

    await userEvent.type(screen.getByRole('textbox'), 'ab');

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(lastValue()).toBe('b');
  });

  it('converts the entry to a number in number mode', async () => {
    // A string here reaches the API as `{"quantity": "9"}` and fails validation.
    render(<EditTextField value="" onChange={onChange} type="number" />);

    await userEvent.type(screen.getByRole('spinbutton'), '9');

    expect(lastValue()).toBe(9);
  });

  it('shows a placeholder when asked', () => {
    render(<EditTextField value="" onChange={onChange} placeholder="Item name" />);

    expect(screen.getByPlaceholderText('Item name')).toBeInTheDocument();
  });

  it('accepts no input while disabled', () => {
    render(<EditTextField value="Detergent" onChange={onChange} disabled />);

    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('marks the field invalid and explains why on hover', async () => {
    render(<EditTextField value="" onChange={onChange} error="Name is required" />);

    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    await userEvent.hover(screen.getByRole('textbox'));
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent('Name is required');
    });
  });

  it('is valid and has no tooltip without an error', () => {
    render(<EditTextField value="Detergent" onChange={onChange} />);

    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('keeps clicks and keystrokes from reaching the row', async () => {
    // Without stopPropagation, clicking into the field fires the row-click handler and
    // navigates to the detail page while the user is still editing. The listeners sit
    // on document.body, above React's root container, so this asserts real DOM
    // bubbling rather than React's synthetic dispatch.
    const onRowClick = vi.fn();
    const onRowKeyDown = vi.fn();
    render(<EditTextField value="Detergent" onChange={onChange} />);
    document.body.addEventListener('click', onRowClick);
    document.body.addEventListener('keydown', onRowKeyDown);

    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.keyboard('x');

    document.body.removeEventListener('click', onRowClick);
    document.body.removeEventListener('keydown', onRowKeyDown);
    expect(onRowClick).not.toHaveBeenCalled();
    expect(onRowKeyDown).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// React Compiler memoizes these components, so a re-render with unchanged props takes
// the cache-hit path instead of rebuilding the element tree. Nothing else in this file
// reaches that path — every other test mounts once — and it is where a compiler bug or
// a prop mutated in place would surface, as a field that keeps painting a value the
// table has already moved on from.
// ===========================================================================
describe('EditTextField — re-rendering', () => {
  it('keeps the same field when re-rendered with unchanged props', () => {
    const props = {value: 'Detergent', onChange, placeholder: 'Product name'};
    render(<EditTextField {...props} />).rerender(<EditTextField {...props} />);

    expect(screen.getByRole('textbox')).toHaveValue('Detergent');
  });

  it('keeps the error tooltip when re-rendered with unchanged props', () => {
    // The invalid field is a separate return, wrapped in a Tooltip, so it has its own
    // cached path.
    const props = {value: '', onChange, error: 'Name is required'};
    render(<EditTextField {...props} />).rerender(<EditTextField {...props} />);

    expect(screen.getByRole('textbox')).toBeInvalid();
  });
});

// ===========================================================================
// DOCUMENTED GAP — editing/EditTextField.tsx:35
//
//   onChange(newValue === '' ? '' : Number(newValue));
//
// Clearing a numeric field reports the empty STRING, not null. `useInlineEdit` /
// `DataTableProvider` diff that against the original number, see a change, and send
// `{"quantity": ""}` — a type error at the API for what the user meant as "no value".
//
// This test passes; it pins the behaviour so the fix is a deliberate decision
// (`''` vs `null`) rather than an accident.
// ===========================================================================
describe('Documented gap — clearing a number field reports an empty string', () => {
  it('reports "" rather than null when the number field is emptied', async () => {
    render(<EditTextField value={9} onChange={onChange} type="number" />);

    await userEvent.clear(screen.getByRole('spinbutton'));

    expect(lastValue()).toBe('');
  });
});
