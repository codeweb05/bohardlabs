import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import type {CropperViewProps} from '../engine/CropperView.js';
import type {LoadedImage} from '../input/loadSource.js';
import {DEFAULT_IMAGE_EDITOR_LABELS as L} from '../labels.js';
import type {EditorState} from '../state/editorState.js';
import type {ImageEditorFeatures} from '../types.js';
import {ImageEditor} from './ImageEditor.js';

const view = vi.hoisted(() => ({state: null as EditorState | null, filter: true}));

vi.mock(import('../input/loadSource.js'), async (original) => ({
  ...(await original()),
  loadSource: vi.fn(async (): Promise<LoadedImage> => ({
    url: 'blob:working',
    image: {} as CanvasImageSource,
    width: 800,
    height: 600,
    type: 'image/jpeg',
    revoke: () => undefined,
  })),
}));
vi.mock(import('../output/filters.js'), async (original) => ({
  ...(await original()),
  supportsCanvasFilter: () => view.filter,
}));
vi.mock('../engine/CropperView.js', () => ({
  CropperView: ({state}: CropperViewProps) => {
    view.state = state;
    return null;
  },
}));

// Reports a stage size on observe, as a browser does, so the cropper view renders.
class SizedResizeObserver implements ResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(target: Element) {
    const entry = {target, contentRect: {width: 648, height: 448}} as ResizeObserverEntry;
    this.callback([entry], this);
  }
  unobserve() {}
  disconnect() {}
}

const original = globalThis.ResizeObserver;
beforeEach(() => {
  globalThis.ResizeObserver = SizedResizeObserver;
  view.state = null;
  view.filter = true;
});
afterEach(() => {
  globalThis.ResizeObserver = original;
});

async function setup(features: ImageEditorFeatures = {}) {
  const user = userEvent.setup();
  render(
    <ImageEditor
      open
      source={new Blob(['x'], {type: 'image/jpeg'})}
      onClose={vi.fn()}
      onApply={vi.fn()}
      features={features}
    />,
  );
  await screen.findByRole('button', {name: L.apply});
  return user;
}

function orientation() {
  return view.state?.orientation;
}

describe('the tabs', () => {
  it('are absent without adjustments', async () => {
    await setup();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('are absent when the canvas cannot filter', async () => {
    view.filter = false;
    await setup({adjust: true});
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', {name: L.adjustment})).not.toBeInTheDocument();
  });

  it('switch between the crop and adjust tools', async () => {
    const user = await setup({adjust: true});
    expect(screen.getByRole('tab', {name: L.cropTab})).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', {name: L.rotateLeft})).toBeInTheDocument();
    await user.click(screen.getByRole('tab', {name: L.adjustTab}));
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName(L.adjustTab);
    expect(screen.queryByRole('button', {name: L.rotateLeft})).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: L.presetMono}));
    await waitFor(() => expect(view.state?.adjust).toEqual({brightness: 0, contrast: 10, saturation: -100}));
  });
});

describe('history', () => {
  it('has no undo or redo buttons unless history is on', async () => {
    await setup();
    expect(screen.queryByRole('button', {name: L.undo})).not.toBeInTheDocument();
  });

  it('walks the history with the buttons, disabled at each end', async () => {
    const user = await setup({history: true});
    const undo = screen.getByRole('button', {name: L.undo});
    const redo = screen.getByRole('button', {name: L.redo});
    expect(undo).toBeDisabled();
    expect(redo).toBeDisabled();

    await user.click(screen.getByRole('button', {name: L.rotateRight}));
    expect(orientation()).toEqual([0, -1, 1, 0]);
    await user.click(undo);
    expect(orientation()).toEqual([1, 0, 0, 1]);
    expect(undo).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(L.undone);
    await user.click(redo);
    expect(orientation()).toEqual([0, -1, 1, 0]);
    expect(redo).toBeDisabled();
  });

  it('resets to the start, and the reset can be undone', async () => {
    const user = await setup({history: true});
    const reset = screen.getByRole('button', {name: L.reset});
    expect(reset).toBeDisabled();
    await user.click(screen.getByRole('button', {name: L.rotateRight}));
    await user.click(screen.getByRole('button', {name: L.flipHorizontal}));
    expect(screen.getByRole('status')).toHaveTextContent(L.flipped);
    const edited = view.state;

    await user.click(reset);
    expect(orientation()).toEqual([1, 0, 0, 1]);
    expect(reset).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(L.resetDone);

    await user.click(screen.getByRole('button', {name: L.undo}));
    expect(view.state).toEqual(edited);
  });
});
