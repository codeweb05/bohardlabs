import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import type {CropperViewProps} from '../engine/CropperView.js';
import type {LoadedImage} from '../input/loadSource.js';
import {DEFAULT_IMAGE_EDITOR_LABELS as L} from '../labels.js';
import {exportImage} from '../output/exportImage.js';
import type {EditorState} from '../state/editorState.js';
import type {ImageEditorFeatures} from '../types.js';
import {ImageEditor} from './ImageEditor.js';

const view = vi.hoisted(() => ({state: null as EditorState | null}));

vi.mock('@mui/material/useMediaQuery', () => ({default: () => true}));
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
vi.mock(import('../output/exportImage.js'), async (original) => ({
  ...(await original()),
  exportImage: vi.fn(),
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
    const entry = {target, contentRect: {width: 343, height: 400}} as ResizeObserverEntry;
    this.callback([entry], this);
  }
  unobserve() {}
  disconnect() {}
}

const original = globalThis.ResizeObserver;
beforeEach(() => {
  globalThis.ResizeObserver = SizedResizeObserver;
  view.state = null;
});
afterEach(() => {
  globalThis.ResizeObserver = original;
});

async function setup(features: ImageEditorFeatures = {}) {
  const user = userEvent.setup();
  const onApply = vi.fn();
  const onClose = vi.fn();
  render(
    <ImageEditor
      open
      source={new Blob(['x'], {type: 'image/jpeg'})}
      onClose={onClose}
      onApply={onApply}
      features={features}
    />,
  );
  const toolbar = await screen.findByRole('toolbar', {name: L.toolbar});
  return {user, toolbar, onApply, onClose};
}

describe('the mobile layout', () => {
  it('fills the screen with Cancel, the title and Done across the top', async () => {
    const {user, onApply, onClose} = await setup();
    expect(screen.getByRole('dialog')).toHaveClass('MuiDialog-paperFullScreen');
    expect(screen.queryByRole('button', {name: L.apply})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: L.close})).not.toBeInTheDocument();

    const file = new File(['y'], 'out.jpg', {type: 'image/jpeg'});
    vi.mocked(exportImage).mockResolvedValue({file, width: 800, height: 600, type: 'image/jpeg'});
    await user.click(screen.getByRole('button', {name: L.done}));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({file}));
    await user.click(screen.getByRole('button', {name: L.cancel}));
    expect(onClose).toHaveBeenCalled();
  });

  it('floats undo, rotate, flip and reset over the canvas, each only when on', async () => {
    const {toolbar} = await setup({history: true});
    for (const name of [L.undo, L.rotateRight, L.flipHorizontal, L.flipVertical, L.reset]) {
      expect(within(toolbar).getByRole('button', {name})).toBeInTheDocument();
    }
    // Once, in the pill: the dock does not repeat them.
    expect(screen.getAllByRole('button', {name: L.rotateRight})).toHaveLength(1);
  });

  it('leaves out the tools that are off', async () => {
    const {toolbar} = await setup({rotate: false, flip: {vertical: false}, history: false});
    expect(within(toolbar).queryByRole('button', {name: L.undo})).not.toBeInTheDocument();
    expect(within(toolbar).queryByRole('button', {name: L.rotateRight})).not.toBeInTheDocument();
    expect(within(toolbar).queryByRole('button', {name: L.flipVertical})).not.toBeInTheDocument();
    expect(within(toolbar).getByRole('button', {name: L.flipHorizontal})).toBeInTheDocument();
  });

  it('acts from the pill and resets back to the start', async () => {
    const {user, toolbar} = await setup({history: true});
    const reset = within(toolbar).getByRole('button', {name: L.reset});
    expect(reset).toBeDisabled();
    await user.click(within(toolbar).getByRole('button', {name: L.rotateRight}));
    expect(view.state?.orientation).toEqual([0, -1, 1, 0]);
    await user.click(reset);
    expect(view.state?.orientation).toEqual([1, 0, 0, 1]);
    await user.click(within(toolbar).getByRole('button', {name: L.undo}));
    expect(view.state?.orientation).toEqual([0, -1, 1, 0]);
  });

  it('flips both ways from the pill', async () => {
    const {user, toolbar} = await setup();
    await user.click(within(toolbar).getByRole('button', {name: L.flipHorizontal}));
    await user.click(within(toolbar).getByRole('button', {name: L.flipVertical}));
    expect(view.state?.orientation).toEqual([-1, 0, 0, -1]);
  });
});
