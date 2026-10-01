/**
 * `AnchoredMenu` is the shell behind the row-action, density and export menus.
 *
 * The owner of a menu re-renders while it is open (a row re-renders on hover state, the
 * toolbar on every search keystroke), so the menu has to sit still through a render
 * that changes nothing, and follow the anchor when it does change.
 */
import {MenuItem} from '@mui/material';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {AnchoredMenu} from './AnchoredMenu';
import {parentOf, render, screen, waitFor} from './test/test-utils';

function anchor(): HTMLElement {
  const element = document.createElement('button');
  document.body.append(element);
  return element;
}

describe('AnchoredMenu', () => {
  it('stays closed without an anchor', () => {
    render(
      <AnchoredMenu anchorEl={null} onClose={() => {}}>
        <MenuItem>Archive</MenuItem>
      </AnchoredMenu>,
    );

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('keeps the open menu mounted through a re-render that changes nothing', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const anchorEl = anchor();
    const items = <MenuItem>Archive</MenuItem>;
    const {rerender} = render(
      <AnchoredMenu anchorEl={anchorEl} onClose={onClose}>
        {items}
      </AnchoredMenu>,
    );
    const item = screen.getByRole('menuitem', {name: 'Archive'});

    rerender(
      <AnchoredMenu anchorEl={anchorEl} onClose={onClose}>
        {items}
      </AnchoredMenu>,
    );

    // Same DOM node: a remount here would drop keyboard focus out of the menu.
    expect(screen.getByRole('menuitem', {name: 'Archive'})).toBe(item);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the anchor is taken away', async () => {
    const anchorEl = anchor();
    const {rerender} = render(
      <AnchoredMenu anchorEl={anchorEl} onClose={() => {}}>
        <MenuItem>Archive</MenuItem>
      </AnchoredMenu>,
    );
    expect(screen.getByRole('menu')).toBeInTheDocument();

    rerender(
      <AnchoredMenu anchorEl={null} onClose={() => {}}>
        <MenuItem>Archive</MenuItem>
      </AnchoredMenu>,
    );

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('applies the paper sizing its owner asks for', () => {
    render(
      <AnchoredMenu anchorEl={anchor()} onClose={() => {}} paperSx={{minWidth: 160}}>
        <MenuItem>Archive</MenuItem>
      </AnchoredMenu>,
    );

    expect(parentOf(screen.getByRole('menu'))).toHaveStyle({minWidth: '160px'});
  });
});
