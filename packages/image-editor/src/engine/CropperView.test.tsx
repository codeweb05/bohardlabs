import {act, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {resolveFeatures} from '../features';
import {initialEditorState, type EditorState} from '../state/editorState';
import {layoutStage, type Rect} from '../state/geometry';
import {CropperView, type CropperViewProps} from './CropperView';

// Stand-ins for the cropperjs elements with just the surface the adapter uses. The real
// ones run in the Storybook project, in Chromium.
class FakeElement extends HTMLElement {
  $addStyles = vi.fn();
}

class FakeImage extends FakeElement {
  $setTransform = vi.fn();
  $ready() {
    return Promise.resolve(new Image());
  }
}

class FakeSelection extends FakeElement {
  x = 0;
  y = 0;
  width = 0;
  height = 0;
  aspectRatio = Number.NaN;
  resizable = false;
  $change(x: number, y: number, width = this.width, height = this.height) {
    const detail = {x, y, width, height};
    if (this.dispatchEvent(new CustomEvent('change', {detail, bubbles: true, cancelable: true}))) {
      Object.assign(this, detail);
    }
    return this;
  }
}

vi.mock('./loadCropper', () => ({
  loadCropper: vi.fn(async () => {
    const define = (name: string, element: CustomElementConstructor) => {
      if (!customElements.get(name)) customElements.define(name, element);
    };
    define('cropper-canvas', class extends FakeElement {});
    define('cropper-image', FakeImage);
    define('cropper-shade', class extends FakeElement {});
    define('cropper-selection', FakeSelection);
    define('cropper-grid', class extends FakeElement {});
    define('cropper-handle', class extends FakeElement {});
  }),
}));

const STAGE = {width: 600, height: 400};

function setup(overrides: Partial<CropperViewProps> = {}) {
  const state: EditorState = initialEditorState({width: 400, height: 300}, resolveFeatures(undefined));
  const layout = layoutStage(STAGE, 24, state.image, state.orientation, state.straighten, state.crop);
  const props: CropperViewProps = {
    src: 'blob:image',
    state,
    stage: STAGE,
    layout,
    shape: 'rect',
    filter: 'none',
    editable: true,
    onAction: vi.fn(),
    onCommit: vi.fn(),
    ...overrides,
  };
  const view = render(<CropperView {...props} />);
  const query = <E extends Element>(selector: string) => view.container.querySelector<E>(selector);
  return {props, layout, view, query};
}

function action(target: Element, detail: object) {
  const event = new CustomEvent('action', {detail, bubbles: true, cancelable: true});
  target.dispatchEvent(event);
  return event;
}

function selectionRect(selection: FakeSelection): Rect {
  return {x: selection.x, y: selection.y, width: selection.width, height: selection.height};
}

async function ready(query: ReturnType<typeof setup>['query']) {
  await waitFor(() => expect(query('cropper-selection')).not.toBeNull());
  const selection = query<FakeSelection>('cropper-selection');
  const image = query<FakeImage>('cropper-image');
  const canvas = query<HTMLElement>('cropper-canvas');
  if (!selection || !image || !canvas) throw new Error('not built');
  return {selection, image, canvas};
}

describe('CropperView', () => {
  beforeEach(() => {
    vi.useFakeTimers({shouldAdvanceTime: true});
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lays the image and the selection out from state', async () => {
    const {query, layout} = setup({filter: 'saturate(0)'});
    const {selection, image, canvas} = await ready(query);
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
    expect(image).toHaveAttribute('src', 'blob:image');
    await waitFor(() => expect(image.$setTransform).toHaveBeenLastCalledWith([...layout.matrix]));
    expect(image).toHaveStyle({filter: 'saturate(0)'});
    expect(selectionRect(selection)).toEqual(layout.selection);
  });

  it('turns a drag into a transient crop move in frame pixels and cancels it', async () => {
    const {query, props, layout} = setup();
    const {canvas} = await ready(query);
    const event = action(canvas, {action: 'move', startX: 100, startY: 100, endX: 110, endY: 95});
    expect(event.defaultPrevented).toBe(true);
    expect(props.onAction).toHaveBeenCalledWith(
      {type: 'moveCrop', dx: -10 / layout.k, dy: 5 / layout.k},
      {transient: true},
    );
  });

  it('turns the wheel into a transient zoom and commits after a pause', async () => {
    const {query, props} = setup();
    const {canvas} = await ready(query);
    const event = action(canvas, {action: 'scale', scale: 0.1, relatedEvent: new WheelEvent('wheel')});
    expect(event.defaultPrevented).toBe(true);
    expect(props.onAction).toHaveBeenCalledWith({type: 'zoomBy', factor: 1.1}, {transient: true});
    expect(props.onCommit).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(props.onCommit).toHaveBeenCalledTimes(1);
  });

  it('keeps a resize inside the image', async () => {
    const {query, layout} = setup();
    const {selection} = await ready(query);
    const {frame} = layout;
    selection.$change(frame.x - 50, frame.y, 100, 100);
    expect(selectionRect(selection)).toEqual({x: frame.x, y: frame.y, width: 100, height: 100});
  });

  it('refuses a selection smaller than a handle', async () => {
    const {query, layout} = setup();
    const {selection} = await ready(query);
    selection.$change(layout.frame.x, layout.frame.y, 4, 4);
    expect(selectionRect(selection)).toEqual(layout.selection);
  });

  it('reports the selection back as a crop at the end of a gesture', async () => {
    const {query, props, layout} = setup();
    const {selection, canvas} = await ready(query);
    selection.$change(layout.frame.x, layout.frame.y, 100, 50);
    canvas.dispatchEvent(new CustomEvent('actionend', {bubbles: true}));
    expect(props.onAction).toHaveBeenCalledWith(
      {type: 'setCrop', crop: {x: 0, y: 0, width: 100 / layout.k, height: 50 / layout.k}},
      {transient: true},
    );
    expect(props.onCommit).toHaveBeenCalledTimes(1);
  });

  it('hides the resize handles when the crop is not editable', async () => {
    const {query, view} = setup({editable: false});
    await ready(query);
    const handles = view.container.querySelectorAll<HTMLElement>('cropper-handle[action$="-resize"]');
    expect(handles).toHaveLength(8);
    expect(Array.from(handles).every((handle) => handle.hidden)).toBe(true);
  });

  it('marks the selection and shade as circles for the circle shape', async () => {
    const {query} = setup({shape: 'circle'});
    const {selection} = await ready(query);
    expect(selection.dataset.shape).toBe('circle');
    expect(query<HTMLElement>('cropper-shade')?.dataset.shape).toBe('circle');
  });

  it('tears the elements down on unmount', async () => {
    const {query, view} = setup();
    await ready(query);
    const stage = screen.getByTestId('image-editor-stage');
    view.unmount();
    expect(stage.childElementCount).toBe(0);
  });
});
