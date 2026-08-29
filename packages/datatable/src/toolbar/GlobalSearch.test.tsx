/**
 * Coverage for `GlobalSearch`.
 *
 * The debounce and the controlled-value sync are the two things this component exists
 * for: it holds the keystrokes locally so the table does not refetch on every letter,
 * and it has to follow the parent when the parent resets the filter (the "adjust state
 * during render" branch at GlobalSearch.tsx:31, which nothing else exercises).
 *
 * The block at the bottom records an issue found while writing these.
 */
import {waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {DEFAULT_LABELS} from '../i18n';
import {DataTableLabelsProvider} from '../i18n';
import {render, screen} from '../test/test-utils';
import {GlobalSearch} from './GlobalSearch';

const onChange = vi.fn();

const SEARCH_PLACEHOLDER = DEFAULT_LABELS.globalSearch;

beforeEach(() => {
  onChange.mockReset();
});

describe('GlobalSearch', () => {
  it('uses the translated placeholder', () => {
    render(<GlobalSearch value="" onChange={onChange} />);

    expect(screen.getByPlaceholderText(SEARCH_PLACEHOLDER)).toBeInTheDocument();
  });

  it('prefers an explicit placeholder', () => {
    render(<GlobalSearch value="" onChange={onChange} placeholder="Search orders" />);

    expect(screen.getByPlaceholderText('Search orders')).toBeInTheDocument();
  });

  it('shows the value it was given', () => {
    render(<GlobalSearch value="acme" onChange={onChange} />);

    expect(screen.getByRole('textbox')).toHaveValue('acme');
  });

  it('reports typing once the debounce elapses', async () => {
    render(<GlobalSearch value="" onChange={onChange} debounceMs={0} />);

    await userEvent.type(screen.getByRole('textbox'), 'ac');

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith('ac');
    });
  });

  it('does not report every keystroke', async () => {
    // The whole point of the component: one refetch per pause, not one per letter.
    render(<GlobalSearch value="" onChange={onChange} debounceMs={300} />);

    await userEvent.type(screen.getByRole('textbox'), 'acme');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('follows the parent when the value is reset from outside', async () => {
    // "Clear all filters" resets the parent's state; the input has to empty with it,
    // otherwise the box still reads "acme" while the table shows everything.
    function Harness() {
      const [value, setValue] = useState('acme');
      return (
        <>
          <GlobalSearch value={value} onChange={setValue} debounceMs={0} />
          <button type="button" onClick={() => setValue('')}>
            reset
          </button>
        </>
      );
    }
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', {name: 'reset'}));

    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('offers no clear button while empty', () => {
    render(<GlobalSearch value="" onChange={onChange} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('clears immediately, without waiting for the debounce', async () => {
    // Clearing is an explicit action, so it should not sit behind the typing delay.
    render(<GlobalSearch value="acme" onChange={onChange} debounceMs={300} />);

    await userEvent.click(screen.getByRole('button'));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('');
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('renders no helper text by default', () => {
    render(<GlobalSearch value="" onChange={onChange} />);

    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-describedby');
  });

  it('renders the helper text', () => {
    render(<GlobalSearch value="" onChange={onChange} helperText="Searches name and email" />);

    expect(screen.getByText('Searches name and email')).toBeInTheDocument();
  });

  it('shows no tooltip while the helper text fits', async () => {
    // `checkOverflow` compares scrollWidth to clientWidth on hover; when the text fits
    // the tooltip title is empty and must not open an empty bubble.
    render(<GlobalSearch value="" onChange={onChange} helperText="Searches name and email" />);

    await userEvent.hover(screen.getByText('Searches name and email'));

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// KNOWN ISSUE — toolbar/GlobalSearch.tsx:103
//
//   <IconButton size="small" onClick={handleClear} edge="end" aria-label="Clear search" …>
//
// The clear button's accessible name is a hardcoded English literal in a component
// that translates its own placeholder two lines above. It is the only label in the
// toolbar that never changes language.
//
// `dataTable.clearAll` and `dataTable.resetFilters` both exist but mean something
// wider (they clear every filter); this button clears the search box only, so it needs
// its own key.
//
// The assertion empties the translation bundle, which turns every translated string
// into its own key, and then checks the English literal is gone — so any correct fix
// passes it whichever key name is chosen.
//
// EXPECTED TO FAIL until the label comes from `t()`.
// ===========================================================================

// A consumer's own wording has to reach the button. If the label were hardcoded the
// override would be ignored and the English default would still be on screen.
describe('the clear-search label comes from `labels`', () => {
  it('renders the override instead of the default', () => {
    render(
      <DataTableLabelsProvider labels={{clearSearch: 'Effacer la recherche'}}>
        <GlobalSearch value="acme" onChange={onChange} />
      </DataTableLabelsProvider>,
    );

    expect(screen.getByRole('button', {name: 'Effacer la recherche'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: DEFAULT_LABELS.clearSearch})).not.toBeInTheDocument();
  });
});

// ===========================================================================
// KNOWN ISSUE — toolbar/GlobalSearch.tsx:73
//
//   <TextField
//     …
//     aria-describedby={helperText ? helperTextId : undefined}
//
// MUI's `TextField` forwards unrecognised props to its root `FormControl`, not to the
// `<input>`. So `aria-describedby` ends up on a wrapper `<div>`, where assistive
// technology never reads it, and the input the user is typing into has no description
// at all. The helper text is the only thing telling them WHICH columns the search
// covers, so the component builds the id, renders the text, and then fails to connect
// the two.
//
// The fix is to pass it through the input slot instead:
//   slotProps={{htmlInput: {'aria-describedby': helperText ? helperTextId : undefined}}}
//
// EXPECTED TO FAIL until the input itself carries the attribute.
// ===========================================================================
describe('KNOWN ISSUE — the helper text must be linked to the input', () => {
  it('describes the input with the helper text', () => {
    render(<GlobalSearch value="" onChange={onChange} helperText="Searches name and email" />);

    const describedBy = screen.getByRole('textbox').getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(screen.getByText('Searches name and email')).toHaveAttribute('id', describedBy);
  });
});
