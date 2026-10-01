import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import type {CropperViewProps} from '../engine/CropperView.js';
import type {LoadedImage} from '../input/loadSource.js';
import {DEFAULT_IMAGE_EDITOR_LABELS as L} from '../labels.js';
import type {EditorState} from '../state/editorState.js';
import type {StageLayout} from '../state/geometry.js';
import type {ImageEditorFeatures} from '../types.js';
import {ImageEditor} from './ImageEditor.js';

const view = vi.hoisted(() => ({
  state: null as EditorState | null,
  k: 0,
  layout: null as StageLayout | null,
  renders: 0,
  onAction: null as CropperViewProps['onAction'] | null,
}));

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
vi.mock('../engine/CropperView.js', () => ({
  CropperView: ({state, layout, onAction}: CropperViewProps) => {
    view.state = state;
    view.k = layout.k;
    view.layout = layout;
    view.renders += 1;
    view.onAction = onAction;
    return null;
  },
}));

/** Reports a new stage size, as the browser does when the dialog is resized. */
let measure = (width: number, height: number): void => {
  throw new Error(`Nothing observes a stage to report ${width} × ${height} for`);
};

// Reports a 648 × 448 stage on observe, as a browser does, so the layout has a scale.
class SizedResizeObserver implements ResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(target: Element) {
    measure = (width, height) => {
      const entry = {target, contentRect: {width, height}} as ResizeObserverEntry;
      this.callback([entry], this);
    };
    measure(648, 448);
  }
  unobserve() {}
  disconnect() {}
}

const original = globalThis.ResizeObserver;
beforeEach(() => {
  globalThis.ResizeObserver = SizedResizeObserver;
  view.state = null;
  view.renders = 0;
});
afterEach(() => {
  globalThis.ResizeObserver = original;
});

async function open(features: ImageEditorFeatures = {}) {
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
}

async function setup(features: ImageEditorFeatures = {}) {
  const user = userEvent.setup();
  await open(features);
  const stage = await screen.findByRole('group', {name: L.canvas});
  await waitFor(() => expect(view.state).not.toBeNull());
  return {user, stage};
}

function crop() {
  if (!view.state) throw new Error('No state');
  return view.state.crop;
}

describe('the stage', () => {
  it('lays the crop out again when its size changes, and only then', async () => {
    await setup();
    const before = {k: view.k, renders: view.renders};
    act(() => measure(648, 448));
    expect(view.renders).toBe(before.renders);
    act(() => measure(648, 224));
    expect(view.k).toBeLessThan(before.k);
    const shorter = view.k;
    act(() => measure(162, 224));
    expect(view.k).toBeLessThan(shorter);
  });

  it('hands the cropper the same layout when a re-render changes nothing', async () => {
    const props = {source: new Blob(['x'], {type: 'image/jpeg'}), onClose: vi.fn(), onApply: vi.fn()};
    const {rerender} = render(<ImageEditor open {...props} />);
    await waitFor(() => expect(view.layout).not.toBeNull());
    const before = view.layout;
    // A parent re-rendering mid-drag: a new layout would put the selection back where it was.
    rerender(<ImageEditor open {...props} />);
    expect(view.layout).toBe(before);
  });

  it('shows no cropper while the observer has nothing to report', async () => {
    // Not something a browser does, but a stand-in observer in a consumer's test setup might.
    globalThis.ResizeObserver = class implements ResizeObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe() {
        this.callback([], this);
      }
      unobserve() {}
      disconnect() {}
    };
    await open();
    expect(screen.getByRole('group', {name: L.canvas})).toBeInTheDocument();
    expect(view.state).toBeNull();
  });

  it('ignores a wheel or pinch zoom from the canvas when zoom is off', async () => {
    const {user} = await setup({zoom: false});
    const before = view.state;
    // What the cropper sends for a wheel: it does not know which tools are on.
    act(() => view.onAction?.({type: 'zoomBy', factor: 2}, {transient: true}));
    expect(view.state).toBe(before);
    expect(screen.getByRole('button', {name: L.reset})).toBeDisabled();
    await user.click(screen.getByRole('button', {name: L.rotateRight}));
    expect(view.state?.orientation).toEqual([0, -1, 1, 0]);
  });
});

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

  it('does nothing until the stage has been measured', async () => {
    // The observer from the test setup never reports, like a stage that is not laid out yet.
    globalThis.ResizeObserver = original;
    const user = userEvent.setup();
    await open();
    const stage = screen.getByRole('group', {name: L.canvas});
    stage.focus();
    await user.keyboard('r{ArrowRight}');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(screen.getByRole('button', {name: L.reset})).toBeDisabled();
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

  it('zooms out with minus and rotates back with Shift+R', async () => {
    const {user, stage} = await setup();
    stage.focus();
    await user.keyboard('++-');
    expect(screen.getByRole('status')).toHaveTextContent(L.zoomChanged(110));
    await user.keyboard('R');
    expect(view.state?.orientation).toEqual([0, 1, -1, 0]);
    expect(screen.getByRole('status')).toHaveTextContent(L.rotated(-90));
  });

  it('leaves Ctrl shortcuts, and Ctrl+Z without history, to the page', async () => {
    const {user, stage} = await setup({history: false});
    stage.focus();
    const before = view.state;
    await user.keyboard('{Control>}rz{/Control}');
    expect(view.state).toBe(before);
  });

  it('does not resize with Shift when the crop is fixed', async () => {
    const {user, stage} = await setup({crop: false});
    stage.focus();
    const before = crop();
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(crop()).toEqual(before);
  });

  it('ignores rotate and zoom keys for tools that are off', async () => {
    const {user, stage} = await setup({rotate: false, zoom: false});
    stage.focus();
    const before = view.state;
    await user.keyboard('r+');
    expect(view.state).toBe(before);
  });

  it('does nothing on Ctrl+Z or Ctrl+Shift+Z with nothing to undo or redo', async () => {
    const {user, stage} = await setup();
    stage.focus();
    const before = view.state;
    await user.keyboard('{Control>}z{/Control}{Control>}{Shift>}z{/Shift}{/Control}');
    expect(view.state).toBe(before);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('records a held key as one step, and announces where it ends', async () => {
    const {user, stage} = await setup({history: true, crop: {ratios: ['1:1']}});
    stage.focus();
    const start = crop();
    fireEvent.keyDown(stage, {key: 'ArrowRight'});
    const first = crop();
    for (let repeat = 0; repeat < 5; repeat += 1) fireEvent.keyDown(stage, {key: 'ArrowRight', repeat: true});
    fireEvent.keyUp(stage, {key: 'ArrowRight'});
    const end = crop();
    expect(end.x).toBeGreaterThan(first.x);
    expect(screen.getByRole('status')).toHaveTextContent(L.cropChanged(Math.round(end.width), Math.round(end.height)));

    await user.keyboard('{Control>}z{/Control}');
    expect(crop()).toEqual(first);
    await user.keyboard('{Control>}z{/Control}');
    expect(crop()).toEqual(start);
  });

  it('ends a held key when the stage loses focus', async () => {
    const {user, stage} = await setup({history: true, crop: {ratios: ['1:1']}});
    stage.focus();
    fireEvent.keyDown(stage, {key: 'ArrowRight'});
    const first = crop();
    fireEvent.keyDown(stage, {key: 'ArrowRight', repeat: true});
    expect(crop().x).toBeGreaterThan(first.x);
    fireEvent.blur(stage);
    // A key released with nothing held is nothing to end.
    fireEvent.keyUp(stage, {key: 'ArrowRight'});
    stage.focus();
    await user.keyboard('{Control>}z{/Control}');
    expect(crop()).toEqual(first);
  });

  it('keeps a held R as one rotation per repeat, each announced', async () => {
    const {user, stage} = await setup({history: true});
    stage.focus();
    fireEvent.keyDown(stage, {key: 'r'});
    fireEvent.keyDown(stage, {key: 'r', repeat: true});
    fireEvent.keyUp(stage, {key: 'r'});
    const turned = view.state?.orientation;
    await user.keyboard('{Control>}z{/Control}');
    expect(view.state?.orientation).not.toEqual(turned);
    await user.keyboard('{Control>}z{/Control}');
    expect(view.state?.orientation).toEqual([1, 0, 0, 1]);
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
