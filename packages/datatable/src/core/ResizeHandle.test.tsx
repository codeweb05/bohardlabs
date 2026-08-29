/**
 * Coverage for `ResizeHandle`, previously 75%.
 *
 * The component is three event props on a styled `Box`; its mouse and touch paths are
 * exercised through `TableHeader` and `useColumnResize`. What is not exercised
 * anywhere, and cannot be, is using it without a mouse.
 *
 * The whole file is a KNOWN ISSUE and is EXPECTED TO FAIL.
 */
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {DEFAULT_LABELS} from '../i18n';
import {render, screen} from '../test/test-utils';
import {ResizeHandle} from './ResizeHandle';

const handlers = {
  onMouseDown: vi.fn(),
  onTouchStart: vi.fn(),
  onDoubleClick: vi.fn(),
};

// ===========================================================================
// KNOWN ISSUE — core/ResizeHandle.tsx:12
//
//   <Box onMouseDown={…} onTouchStart={…} onDoubleClick={…} sx={{…}} />
//
// The handle is a bare `<div>`: no role, no accessible name, no tab stop, and no key
// handling. Column resizing is therefore mouse- and touch-only — a keyboard user
// cannot reach it at all, and a screen reader user is never told it is there. The
// double-click reset (the only way back to the default width) is unreachable the same
// way.
//
// `dataTable.resizeColumn` ("Resize column") is already in en.json and used by nothing
// in the repo, which suggests the label was meant to be here and was dropped.
//
// The minimum fix is `role="separator"`, `aria-orientation="vertical"`,
// `aria-label={t('dataTable.resizeColumn')}` and `tabIndex={0}`. Keyboard resizing
// itself (ArrowLeft/ArrowRight to nudge the width, Enter or Home to reset) needs a new
// prop, since the component is handed pre-bound mouse handlers today and has no way to
// express a width delta — worth designing before this ships as a package.
//
// Knock-on effect on coverage: `handleResetSize` (core/TableHeader.tsx:527-533, the
// only code that removes a column from `columnSizing`) can only be reached by
// double-clicking this handle. With no role and no name there is no way to select it
// from a test without walking the DOM, which the testing-library lint rules forbid, so
// that function stays uncovered until the fix below lands. It is worth re-checking then.
//
// EXPECTED TO FAIL until the handle is reachable without a pointer.
// ===========================================================================
describe('KNOWN ISSUE — the resize handle must be reachable without a mouse', () => {
  it('exposes itself as a labelled separator', () => {
    render(<ResizeHandle isResizing={false} {...handlers} />);

    expect(screen.getByRole('separator', {name: DEFAULT_LABELS.resizeColumn})).toBeInTheDocument();
  });

  it('takes keyboard focus', async () => {
    // Rendered mid-resize so the active styling branch is covered too.
    render(<ResizeHandle isResizing {...handlers} />);

    await userEvent.tab();

    expect(screen.getByRole('separator')).toHaveFocus();
  });
});
