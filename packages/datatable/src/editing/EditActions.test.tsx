/**
 * Coverage for `EditActions`, previously 0%.
 *
 * The save/cancel pair a row shows while it is being edited. It renders nothing for
 * any other row, which is the part most likely to regress into "every row has a tick
 * button". The `onSave`/`onCancel` overrides exist so a page can intercept the
 * commit, so both the override and the fall-through to the context are pinned.
 *
 * The last two blocks guard bugs that have since been fixed; they are kept as
 * regression tests.
 */
import userEvent from '@testing-library/user-event';
import type {ReactNode} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import type {TableEditingContextValue} from '../DataTableContext.hooks';
import {TableEditingContext} from '../DataTableContext.hooks';
import {DEFAULT_LABELS, DataTableLabelsProvider} from '../i18n';
import {render, screen} from '../test/test-utils';
import type {RowData} from '../types';
import {EditActions} from './EditActions';

const saveEdit = vi.fn<() => Promise<void>>();
const cancelEdit = vi.fn();

function editingContext(overrides: Partial<TableEditingContextValue<RowData>> = {}): TableEditingContextValue<RowData> {
  return {
    editingRowId: 'row-1',
    editingData: {},
    isEditing: (rowId: string) => rowId === 'row-1',
    startEdit: vi.fn(),
    cancelEdit,
    saveEdit,
    updateEditField: vi.fn(),
    isSaving: false,
    editError: null,
    ...overrides,
  };
}

function renderActions(
  ui: ReactNode,
  overrides: Partial<TableEditingContextValue<RowData>> = {},
): ReturnType<typeof render> {
  return render(<TableEditingContext.Provider value={editingContext(overrides)}>{ui}</TableEditingContext.Provider>);
}

beforeEach(() => {
  saveEdit.mockReset().mockResolvedValue(undefined);
  cancelEdit.mockReset();
});

/**
 * Save is the first of the two buttons. It is found by position rather than by name
 * so the query keeps working while the accessible name is under test at the bottom.
 */
function saveButton(): HTMLElement {
  return screen.getAllByRole('button')[0];
}

function cancelButton(): HTMLElement {
  return screen.getByRole('button', {name: 'Discard changes'});
}

describe('EditActions', () => {
  it('renders nothing for a row that is not being edited', () => {
    // Otherwise every row in the table sprouts a tick and a cross.
    renderActions(<EditActions rowId="row-2" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders save and cancel for the row being edited', () => {
    renderActions(<EditActions rowId="row-1" />);

    expect(saveButton()).toBeInTheDocument();
    expect(cancelButton()).toBeInTheDocument();
  });

  it('commits through the context when no override is given', async () => {
    renderActions(<EditActions rowId="row-1" />);

    await userEvent.click(saveButton());

    expect(saveEdit).toHaveBeenCalledOnce();
  });

  it('cancels through the context when no override is given', async () => {
    renderActions(<EditActions rowId="row-1" />);

    await userEvent.click(cancelButton());

    expect(cancelEdit).toHaveBeenCalledOnce();
  });

  it('prefers the onSave override and leaves the context alone', async () => {
    const onSave = vi.fn();
    renderActions(<EditActions rowId="row-1" onSave={onSave} />);

    await userEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledOnce();
    expect(saveEdit).not.toHaveBeenCalled();
  });

  it('prefers the onCancel override and leaves the context alone', async () => {
    const onCancel = vi.fn();
    renderActions(<EditActions rowId="row-1" onCancel={onCancel} />);

    await userEvent.click(cancelButton());

    expect(onCancel).toHaveBeenCalledOnce();
    expect(cancelEdit).not.toHaveBeenCalled();
  });

  it('shows a spinner and blocks both buttons while saving', () => {
    // Double-submitting an inline edit fires two PATCHes for one intent.
    renderActions(<EditActions rowId="row-1" />, {isSaving: true});

    // The tick is swapped for the spinner while saving, so the buttons are counted
    // rather than found by icon.
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button).toBeDisabled();
    }
  });

  it('keeps clicks off the row', async () => {
    // The action cell sits inside the row; without stopPropagation, saving also
    // navigates to the detail page. Listener on document.body measures real bubbling.
    const onRowClick = vi.fn();
    renderActions(<EditActions rowId="row-1" />);
    document.body.addEventListener('click', onRowClick);

    await userEvent.click(saveButton());

    document.body.removeEventListener('click', onRowClick);
    expect(saveEdit).toHaveBeenCalledOnce();
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('throws a clear error when rendered outside a provider', () => {
    expect(() => render(<EditActions rowId="row-1" />)).toThrow(/DataTableProvider/);
  });
});

// ===========================================================================
// React Compiler memoizes these components, so a re-render with unchanged props takes
// the cache-hit path instead of rebuilding the element tree. Nothing else in this file
// reaches that path — every other test mounts once — and it is where a compiler bug or
// a prop mutated in place would surface, as a control that keeps painting state the
// table has already moved on from.
// ===========================================================================
describe('EditActions — re-rendering', () => {
  it('keeps both buttons when re-rendered with unchanged props', () => {
    const context = editingContext();
    const {rerender} = render(
      <TableEditingContext.Provider value={context}>
        <EditActions rowId="row-1" />
      </TableEditingContext.Provider>,
    );

    rerender(
      <TableEditingContext.Provider value={context}>
        <EditActions rowId="row-1" />
      </TableEditingContext.Provider>,
    );

    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('keeps the saving state when re-rendered with unchanged props', () => {
    // Saving is a separate render path (spinner in place of the tick), so it caches
    // separately. A stale cache here would leave the row spinning after the save landed.
    const context = editingContext({isSaving: true});
    const {rerender} = render(
      <TableEditingContext.Provider value={context}>
        <EditActions rowId="row-1" />
      </TableEditingContext.Provider>,
    );

    rerender(
      <TableEditingContext.Provider value={context}>
        <EditActions rowId="row-1" />
      </TableEditingContext.Provider>,
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});

// ===========================================================================
// REGRESSION — editing/EditActions.tsx:44-45
//
//   <Tooltip title={t('dataTable.editing.saveChanges') ?? t('common.save')}>
//
// `t()` never returns null or undefined — i18next returns the key itself when a
// translation is missing. So the `??` fallback is dead code: if
// `dataTable.editing.saveChanges` is ever removed from en.json, the button's tooltip
// and accessible name become the literal string "dataTable.editing.saveChanges"
// rather than falling back to "Save".
//
// Failed when written; passes now that the fallback uses `t(key, {defaultValue: …})`.
// ===========================================================================

describe('the tooltip labels come from `labels`', () => {
  it('takes the discard label from the override', () => {
    renderActions(
      <DataTableLabelsProvider labels={{discardChanges: 'Annuler'}}>
        <EditActions rowId="row-1" />
      </DataTableLabelsProvider>,
    );

    expect(screen.getByRole('button', {name: 'Annuler'})).toBeInTheDocument();
  });

  it('uses the English default when nothing is overridden', () => {
    renderActions(<EditActions rowId="row-1" />);

    expect(screen.getByRole('button', {name: DEFAULT_LABELS.discardChanges})).toBeInTheDocument();
  });
});

// ===========================================================================
// REGRESSION — editing/EditActions.tsx:66
//
//   <Tooltip title={…}>
//     <span>
//       <IconButton …><CheckIcon /></IconButton>
//     </span>
//   </Tooltip>
//
// MUI puts the tooltip's `aria-label` on its direct child. The `<span>` (added so the
// tooltip still shows while the button is disabled during a save) absorbs it, so the
// button itself renders with NO accessible name — a screen reader announces the
// primary confirm action of inline editing as an unlabelled "button". The cancel
// button, which has no span, is labelled correctly, so the two are inconsistent.
//
// Failed when written; passes now that the IconButton carries its own `aria-label`.
// ===========================================================================
describe('Regression — the save button must have an accessible name', () => {
  it('names the save button for assistive technology', () => {
    renderActions(<EditActions rowId="row-1" />);

    expect(screen.getByRole('button', {name: 'Save changes'})).toBeInTheDocument();
  });
});
