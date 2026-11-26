/**
 * The Display menu on its own. Each item is offered only where it can work: fullscreen
 * where the browser allows it, fitting where the table applies column widths.
 */
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {DEFAULT_LABELS} from '../i18n';
import {render, screen, waitFor} from '../test/test-utils';
import {DisplayMenu} from './DisplayMenu';

const onWrapCellsChange = vi.fn();
const onFullscreenToggle = vi.fn();
const onFitColumns = vi.fn();

function allowFullscreen(enabled: boolean) {
  Object.defineProperty(document, 'fullscreenEnabled', {configurable: true, value: enabled});
}

beforeEach(() => {
  onWrapCellsChange.mockReset();
  onFullscreenToggle.mockReset();
  onFitColumns.mockReset();
  allowFullscreen(true);
});

afterEach(() => {
  Reflect.deleteProperty(document, 'fullscreenEnabled');
});

async function openMenu() {
  await userEvent.click(screen.getByRole('button', {name: DEFAULT_LABELS.display}));
  return screen.findByRole('menu');
}

describe('DisplayMenu', () => {
  it('offers all three controls', async () => {
    render(
      <DisplayMenu
        wrapCells={false}
        onWrapCellsChange={onWrapCellsChange}
        isFullscreen={false}
        onFullscreenToggle={onFullscreenToggle}
        onFitColumns={onFitColumns}
      />,
    );
    await openMenu();

    expect(screen.getByRole('menuitemcheckbox', {name: DEFAULT_LABELS.wrapCells})).not.toBeChecked();
    expect(screen.getByRole('menuitem', {name: DEFAULT_LABELS.fullscreen})).toBeInTheDocument();
    expect(screen.getByRole('menuitem', {name: DEFAULT_LABELS.fitColumns})).toBeInTheDocument();
  });

  it('turns wrapping on, and closes', async () => {
    render(
      <DisplayMenu
        wrapCells={false}
        onWrapCellsChange={onWrapCellsChange}
        isFullscreen={false}
        onFullscreenToggle={onFullscreenToggle}
      />,
    );
    await openMenu();

    await userEvent.click(screen.getByRole('menuitemcheckbox', {name: DEFAULT_LABELS.wrapCells}));

    expect(onWrapCellsChange).toHaveBeenCalledWith(true);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('shows wrapping as checked, and turns it off', async () => {
    render(
      <DisplayMenu
        wrapCells
        onWrapCellsChange={onWrapCellsChange}
        isFullscreen
        onFullscreenToggle={onFullscreenToggle}
      />,
    );
    await openMenu();
    const wrap = screen.getByRole('menuitemcheckbox', {name: DEFAULT_LABELS.wrapCells});
    expect(wrap).toBeChecked();

    await userEvent.click(wrap);

    expect(onWrapCellsChange).toHaveBeenCalledWith(false);
  });

  it('offers the way out while fullscreen', async () => {
    render(
      <DisplayMenu
        wrapCells={false}
        onWrapCellsChange={onWrapCellsChange}
        isFullscreen
        onFullscreenToggle={onFullscreenToggle}
      />,
    );
    await openMenu();

    await userEvent.click(screen.getByRole('menuitem', {name: DEFAULT_LABELS.exitFullscreen}));

    expect(onFullscreenToggle).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menuitem', {name: DEFAULT_LABELS.fitColumns})).not.toBeInTheDocument();
  });

  it('hides fullscreen where the browser refuses it', async () => {
    allowFullscreen(false);
    render(
      <DisplayMenu
        wrapCells={false}
        onWrapCellsChange={onWrapCellsChange}
        isFullscreen={false}
        onFullscreenToggle={onFullscreenToggle}
        onFitColumns={onFitColumns}
      />,
    );
    await openMenu();

    expect(screen.queryByRole('menuitem', {name: DEFAULT_LABELS.fullscreen})).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', {name: DEFAULT_LABELS.fitColumns}));
    expect(onFitColumns).toHaveBeenCalledOnce();
  });

  it('keeps its menu when the toolbar re-renders with nothing changed', async () => {
    const {rerender} = render(
      <DisplayMenu
        wrapCells={false}
        onWrapCellsChange={onWrapCellsChange}
        isFullscreen={false}
        onFullscreenToggle={onFullscreenToggle}
        onFitColumns={onFitColumns}
      />,
    );
    await openMenu();

    // The same props again, so the compiled component reuses everything it drew last time.
    rerender(
      <DisplayMenu
        wrapCells={false}
        onWrapCellsChange={onWrapCellsChange}
        isFullscreen={false}
        onFullscreenToggle={onFullscreenToggle}
        onFitColumns={onFitColumns}
      />,
    );

    expect(screen.getByRole('menuitem', {name: DEFAULT_LABELS.fitColumns})).toBeInTheDocument();
  });

  it('closes on Escape without changing anything', async () => {
    render(
      <DisplayMenu
        wrapCells={false}
        onWrapCellsChange={onWrapCellsChange}
        isFullscreen={false}
        onFullscreenToggle={onFullscreenToggle}
      />,
    );
    await openMenu();

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(onWrapCellsChange).not.toHaveBeenCalled();
  });
});
