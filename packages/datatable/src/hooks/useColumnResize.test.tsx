/**
 * Coverage for `useColumnResize`, previously 56%.
 *
 * Everything inside the document-level listeners was unreached: the clamping, the
 * touch path, and the teardown that puts `document.body` back the way it found it. A
 * drag that ends without cleaning up leaves the whole page stuck with a col-resize
 * cursor and no text selection, so the teardown is the part most worth pinning.
 *
 * The block at the bottom records an issue found while writing these.
 */
import type {ColumnDef, ColumnSizingState} from '@tanstack/react-table';
import {getCoreRowModel, useReactTable} from '@tanstack/react-table';
import {fireEvent, screen} from '@testing-library/react';
import {useState} from 'react';
import {describe, expect, it, vi} from 'vitest';

import {render} from '../test/test-utils';
import {useColumnResize} from './useColumnResize';

interface Item {
  readonly id: string;
  readonly name: string;
  readonly [key: string]: unknown;
}

const data: Item[] = [{id: 'row-1', name: 'Detergent'}];
const columns: ColumnDef<Item>[] = [{id: 'name', accessorKey: 'name'}];

interface HarnessProps {
  /** Omitted entirely on most tests so the hook's own defaults are exercised. */
  readonly limits?: {readonly min: number; readonly max: number};
  readonly startWidth?: number;
}

/**
 * Renders a resize handle wired to the hook, echoing the hook's state and the table's
 * column sizing into the DOM. The handle is a plain div, like the real `ResizeHandle`.
 */
function Harness({limits, startWidth = 100}: Readonly<HarnessProps>) {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const table = useReactTable({
    data,
    columns,
    state: {columnSizing},
    onColumnSizingChange: setColumnSizing,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });
  const {isResizing, resizingColumnId, handleResizeStart} = useColumnResize(
    limits ? {table, minWidth: limits.min, maxWidth: limits.max} : {table},
  );
  const start = handleResizeStart('name', startWidth);

  return (
    <>
      {/* A button rather than the real component's div, so the handle is reachable
          without tripping the a11y lint rules this file has no reason to bend. */}
      <button type="button" data-testid="handle" onMouseDown={start} onTouchStart={start} />
      <p>{`resizing: ${resizingColumnId ?? 'none'}`}</p>
      <p>{`isResizing: ${String(isResizing)}`}</p>
      <p>{`width: ${columnSizing.name ?? 'unset'}`}</p>
    </>
  );
}

function handle(): HTMLElement {
  return screen.getByTestId('handle');
}

/**
 * The inline styles the hook writes on `document.body`, read directly: jest-dom's
 * `toHaveStyle({userSelect: ''})` treats an empty expected value as a match, so it
 * cannot tell "restored" from "still applied".
 */
function bodyStyles(): {cursor: string; userSelect: string} {
  return {
    cursor: document.body.style.getPropertyValue('cursor'),
    userSelect: document.body.style.getPropertyValue('user-select'),
  };
}

/** Presses the handle at `clientX` and drags to `to`, without releasing. */
function dragMouse(from: number, to: number) {
  fireEvent.mouseDown(handle(), {clientX: from});
  fireEvent.mouseMove(document, {clientX: to});
}

describe('useColumnResize', () => {
  it('starts idle', () => {
    render(<Harness />);

    expect(screen.getByText('isResizing: false')).toBeInTheDocument();
    expect(screen.getByText('resizing: none')).toBeInTheDocument();
  });

  it('ignores pointer movement before a drag starts', () => {
    // The listeners are only subscribed while a resize is active; if they were global,
    // every mouse move across the page would write to column sizing.
    render(<Harness />);

    fireEvent.mouseMove(document, {clientX: 400});

    expect(screen.getByText('width: unset')).toBeInTheDocument();
  });

  it('enters the resizing state on mouse down', () => {
    render(<Harness />);

    fireEvent.mouseDown(handle(), {clientX: 100});

    expect(screen.getByText('isResizing: true')).toBeInTheDocument();
    expect(screen.getByText('resizing: name')).toBeInTheDocument();
  });

  it('keeps the press off the surrounding header cell', () => {
    // The header cell is draggable for column reordering, so a resize that bubbles
    // starts a column drag at the same time. A listener on document.body measures real
    // bubbling rather than a wrapper's own handler.
    const onOuterMouseDown = vi.fn();
    render(<Harness />);
    document.body.addEventListener('mousedown', onOuterMouseDown);

    fireEvent.mouseDown(handle(), {clientX: 100});

    document.body.removeEventListener('mousedown', onOuterMouseDown);
    expect(onOuterMouseDown).not.toHaveBeenCalled();
  });

  it('widens the column by the distance dragged', () => {
    render(<Harness />);

    dragMouse(100, 160);

    expect(screen.getByText('width: 160')).toBeInTheDocument();
  });

  it('narrows the column when dragged back', () => {
    render(<Harness />);

    dragMouse(100, 80);

    expect(screen.getByText('width: 80')).toBeInTheDocument();
  });

  it('clamps at the minimum width', () => {
    // Without the floor a column collapses to zero and cannot be grabbed again.
    render(<Harness />);

    dragMouse(100, -500);

    expect(screen.getByText('width: 50')).toBeInTheDocument();
  });

  it('clamps at the maximum width', () => {
    render(<Harness />);

    dragMouse(100, 5000);

    expect(screen.getByText('width: 500')).toBeInTheDocument();
  });

  it('honours caller-supplied limits', () => {
    render(<Harness limits={{min: 120, max: 200}} />);

    dragMouse(100, 0);

    expect(screen.getByText('width: 120')).toBeInTheDocument();
  });

  it('leaves the resizing state on mouse up', () => {
    render(<Harness />);
    dragMouse(100, 160);

    fireEvent.mouseUp(document);

    expect(screen.getByText('isResizing: false')).toBeInTheDocument();
    expect(screen.getByText('width: 160')).toBeInTheDocument();
  });

  it('stops tracking the pointer after the release', () => {
    // The listener has to be torn down, not just ignored, or the column keeps
    // following the cursor after the button is up.
    render(<Harness />);
    dragMouse(100, 160);
    fireEvent.mouseUp(document);

    fireEvent.mouseMove(document, {clientX: 400});

    expect(screen.getByText('width: 160')).toBeInTheDocument();
  });

  it('resizes from a touch drag', () => {
    render(<Harness />);

    fireEvent.touchStart(handle(), {touches: [{clientX: 100}]});
    fireEvent.touchMove(document, {touches: [{clientX: 170}]});

    expect(screen.getByText('width: 170')).toBeInTheDocument();
  });

  it('ends a touch drag on touch end', () => {
    render(<Harness />);
    fireEvent.touchStart(handle(), {touches: [{clientX: 100}]});

    fireEvent.touchEnd(document);

    expect(screen.getByText('isResizing: false')).toBeInTheDocument();
  });

  it('ignores a touch move that carries no touch point', () => {
    render(<Harness />);
    fireEvent.touchStart(handle(), {touches: [{clientX: 100}]});

    fireEvent.touchMove(document, {touches: []});

    expect(screen.getByText('width: unset')).toBeInTheDocument();
  });

  it('starts from zero when a touch carries no coordinates', () => {
    // `touches[0]?.clientX ?? 0` — a touch start without a point would otherwise make
    // startX NaN and every later width NaN with it.
    render(<Harness />);

    fireEvent.touchStart(handle(), {touches: []});

    expect(screen.getByText('resizing: name')).toBeInTheDocument();
  });

  it('takes over the page cursor for the duration of the drag', () => {
    render(<Harness />);

    fireEvent.mouseDown(handle(), {clientX: 100});

    expect(bodyStyles()).toEqual({cursor: 'col-resize', userSelect: 'none'});
  });

  it('gives the page cursor back when the drag ends', () => {
    render(<Harness />);
    fireEvent.mouseDown(handle(), {clientX: 100});

    fireEvent.mouseUp(document);

    expect(bodyStyles()).toEqual({cursor: '', userSelect: ''});
  });

  it('gives the page cursor back when the table unmounts mid-drag', () => {
    // Navigating away with the button still held would otherwise leave the whole app
    // unselectable until a reload.
    const {unmount} = render(<Harness />);
    fireEvent.mouseDown(handle(), {clientX: 100});

    unmount();

    expect(bodyStyles()).toEqual({cursor: '', userSelect: ''});
  });
});

// ===========================================================================
// KNOWN ISSUE — hooks/useColumnResize.ts:94
//
//   document.addEventListener('touchmove', handleTouchMove);
//   document.addEventListener('touchend', handleEnd);
//
// `touchcancel` is not listened for. The browser fires it instead of `touchend`
// whenever the gesture is taken away from the page — an incoming call, a system
// gesture, the finger leaving the touch surface, or a `touchmove` the browser decides
// to turn into a scroll. When that happens `handleEnd` never runs, so:
//
//   - `resizingColumnId` stays set, and the resize handle stays highlighted;
//   - `document.body` keeps `cursor: col-resize` and `userSelect: none`, which on a
//     touch device means nothing on the page can be selected again until a reload;
//   - the document listeners stay subscribed, so the next touch anywhere on the page
//     resizes the column.
//
// EXPECTED TO FAIL until `touchcancel` is wired to `handleEnd` alongside `touchend`.
// ===========================================================================
describe('KNOWN ISSUE — a cancelled touch must end the resize', () => {
  it('leaves the resizing state when the gesture is cancelled', () => {
    render(<Harness />);
    fireEvent.touchStart(handle(), {touches: [{clientX: 100}]});

    fireEvent.touchCancel(document);

    expect(screen.getByText('isResizing: false')).toBeInTheDocument();
  });

  it('gives the page cursor back when the gesture is cancelled', () => {
    render(<Harness />);
    fireEvent.touchStart(handle(), {touches: [{clientX: 100}]});

    fireEvent.touchCancel(document);

    expect(bodyStyles()).toEqual({cursor: '', userSelect: ''});
  });
});
