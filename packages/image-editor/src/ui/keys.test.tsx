import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import type {CropperViewProps} from '../engine/CropperView';
import type {LoadedImage} from '../input/loadSource';
import {DEFAULT_IMAGE_EDITOR_LABELS as L} from '../labels';
import type {EditorState} from '../state/editorState';
import type {ImageEditorFeatures} from '../types';
import {ImageEditor} from './ImageEditor';

const view = vi.hoisted(() => ({state: null as EditorState | null, k: 0}));

vi.mock(import('../input/loadSource'), async (original) => ({
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
vi.mock('../engine/CropperView', () => ({
  CropperView: ({state, layout}: CropperViewProps) => {
    view.state = state;
    view.k = layout.k;
    return null;
  },
}));

// Reports a 648 × 448 stage on observe, as a browser does, so the layout has a scale.
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
  const stage = await screen.findByRole('group', {name: L.canvas});
  await waitFor(() => expect(view.state).not.toBeNull());
  return {user, stage};
}

function crop() {
  if (!view.state) throw new Error('No state');
  return view.state.crop;
}

describe('the key layer', () => {
  it('describes itself to assistive technology', async () => {
    const {stage} = await setup();
    expect(stage).toHaveAccessibleDescription(L.keyHelp);
    expect(stage).toHaveAttribute('tabindex', '0');
  });

  it('does nothing unless the stage has focus', async () => {
    const {user} = await setup({crop: {ratios: ['1:1']}});
    const before = crop();
    await user.keyboard('{ArrowRight}r');
    expect(crop()).toEqual(before);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('moves the crop by 10 screen pixels, 1 with Alt', async () => {
    const {user, stage} = await setup({crop: {ratios: ['1:1']}, zoom: {min: 2}});
    stage.focus();
    const start = crop().x;
    await user.keyboard('{ArrowRight}');
    expect(crop().x).toBeCloseTo(start + 10 / view.k);
    await user.keyboard('{Alt>}{ArrowLeft}{/Alt}');
    expect(crop().x).toBeCloseTo(start + 9 / view.k);
  });

  it('resizes with Shift and announces the new size', async () => {
    const {user, stage} = await setup({zoom: {min: 1}});
    stage.focus();
    const before = crop();
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(crop().width).toBeCloseTo(before.width - 10 / view.k);
    expect(screen.getByRole('status')).toHaveTextContent(
      L.cropChanged(Math.round(crop().width), Math.round(crop().height)),
    );
  });

  it('rotates with R and zooms with plus, announcing each', async () => {
    const {user, stage} = await setup();
    stage.focus();
    await user.keyboard('r');
    expect(view.state?.orientation).toEqual([0, -1, 1, 0]);
    expect(screen.getByRole('status')).toHaveTextContent(L.rotated(90));
    await user.keyboard('+');
    expect(screen.getByRole('status')).toHaveTextContent(L.zoomChanged(110));
  });

  it('ignores rotate and zoom keys for tools that are off', async () => {
    const {user, stage} = await setup({rotate: false, zoom: false});
    stage.focus();
    const before = view.state;
    await user.keyboard('r+');
    expect(view.state).toBe(before);
  });

  it('undoes and redoes with Ctrl+Z and Ctrl+Shift+Z when history is on', async () => {
    const {user, stage} = await setup({history: true});
    stage.focus();
    await user.keyboard('r');
    await user.keyboard('{Control>}z{/Control}');
    expect(view.state?.orientation).toEqual([1, 0, 0, 1]);
    expect(screen.getByRole('status')).toHaveTextContent(L.undone);
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(view.state?.orientation).toEqual([0, -1, 1, 0]);
    expect(screen.getByRole('status')).toHaveTextContent(L.redone);
  });
});
