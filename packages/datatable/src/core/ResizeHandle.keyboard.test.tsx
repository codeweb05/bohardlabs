/**
 * Keyboard resizing on `ResizeHandle`: the window-splitter pattern.
 *
 * Arrow keys move the column edge by a small step, Shift makes the step large, and Home
 * puts the column back to its own width (the keyboard twin of the double-click reset).
 * The handle also announces its current width and range, which is how a screen reader
 * user knows the key press did anything.
 */
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {render, screen} from '../test/test-utils';
import {ResizeHandle} from './ResizeHandle';

function setup(withResizeBy = true) {
  const user = userEvent.setup();
  const onDoubleClick = vi.fn();
  const onResizeBy = vi.fn<(delta: number) => void>();
  const onMouseDown = vi.fn();
  const onTouchStart = vi.fn();
  const props = {
    isResizing: false,
    onMouseDown,
    onTouchStart,
    onDoubleClick,
    onResizeBy: withResizeBy ? onResizeBy : undefined,
    width: 160,
    minWidth: 50,
    maxWidth: 500,
  };
  const view = render(<ResizeHandle {...props} />);
  const handle = screen.getByRole('separator');
  handle.focus();
  return {user, handle, props, onDoubleClick, onResizeBy, ...view};
}

/** The width a resize handle announces. A separator is not a role `toHaveValue` reads. */
function announcedWidth(handle: HTMLElement): number {
  return Number(handle.getAttribute('aria-valuenow'));
}

describe('ResizeHandle, keyboard', () => {
  it('announces the current width and its range', () => {
    const {handle} = setup();

    expect(announcedWidth(handle)).toBe(160);
    expect(handle).toHaveAttribute('aria-valuemin', '50');
    expect(handle).toHaveAttribute('aria-valuemax', '500');
  });

  it('narrows the column with ArrowLeft and widens it with ArrowRight', async () => {
    const {user, onResizeBy} = setup();

    await user.keyboard('{ArrowLeft}');
    await user.keyboard('{ArrowRight}');

    expect(onResizeBy.mock.calls).toEqual([[-8], [8]]);
  });

  it('takes a larger step with Shift held', async () => {
    const {user, onResizeBy} = setup();

    await user.keyboard('{Shift>}{ArrowLeft}{ArrowRight}{/Shift}');

    expect(onResizeBy.mock.calls).toEqual([[-32], [32]]);
  });

  it('resets the width on Home', async () => {
    const {user, onDoubleClick, onResizeBy} = setup();

    await user.keyboard('{Home}');

    expect(onDoubleClick).toHaveBeenCalledTimes(1);
    expect(onResizeBy).not.toHaveBeenCalled();
  });

  it('leaves every other key alone', async () => {
    // Tab has to keep moving focus and Enter has to stay free for the sortable header
    // the handle sits in, so anything that is not an arrow or Home must pass through.
    const {user, handle, onDoubleClick, onResizeBy} = setup();

    await user.keyboard('{Enter}{ArrowUp}{ArrowDown}a');
    expect(onResizeBy).not.toHaveBeenCalled();
    expect(onDoubleClick).not.toHaveBeenCalled();

    await user.tab();
    expect(handle).not.toHaveFocus();
  });

  it('stays pointer-only, without throwing, when no keyboard handler is wired', async () => {
    const {user, handle, onDoubleClick} = setup(false);

    await user.keyboard('{ArrowLeft}{ArrowRight}');

    expect(handle).toHaveFocus();
    expect(onDoubleClick).not.toHaveBeenCalled();
  });

  it('keeps focus through a re-render that changes nothing', async () => {
    // The header re-renders on every sort and selection change. If that replaced the
    // handle, a keyboard user mid-resize would be thrown back to the top of the page.
    const {user, handle, props, rerender, onResizeBy} = setup();

    rerender(<ResizeHandle {...props} />);

    expect(screen.getByRole('separator')).toBe(handle);
    expect(handle).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(onResizeBy).toHaveBeenCalledExactlyOnceWith(8);
  });
});
