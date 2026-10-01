import Box from '@mui/material/Box';
import {useEffect, useId, useMemo, useRef, useState, type KeyboardEvent} from 'react';

import {CropperView, type CropperViewProps} from '../engine/CropperView.js';
import type {ResolvedFeatures} from '../features.js';
import type {EditorAction} from '../state/editorState.js';
import {layoutStage, type Size} from '../state/geometry.js';
import {useLabels} from './LabelsContext.js';

/** Room around the crop for the resize handles and a glimpse of what is outside it. */
const STAGE_PADDING = 24;
/** Screen pixels an arrow key moves or resizes the crop by, and with Alt held. */
const KEY_STEP = 10;
const FINE_KEY_STEP = 1;
const KEY_ZOOM = 1.1;
/** The stage's height with room to spare, and the least it shrinks to before the dialog scrolls. */
const STAGE_HEIGHT = 420;
export const STAGE_MIN_HEIGHT = 240;

// Sizes are strings on purpose: `sx` reads a bare `1` as 100%, which makes the hidden box as
// large as its container and lets it hang past the dialog's edge, where it adds scrollbars.
export const visuallyHidden = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  m: '-1px',
  p: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

export interface CanvasAreaProps extends Omit<CropperViewProps, 'stage' | 'layout'> {
  readonly features: ResolvedFeatures;
  /** `null` when history is off, so the keys do nothing. */
  readonly onUndo: (() => void) | null;
  readonly onRedo: (() => void) | null;
  /** A held key was let go: `action` is the step it was repeating. */
  readonly onHoldEnd: (action: EditorAction) => void;
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** An arrow moves the crop, or resizes it with Shift. `k` turns screen pixels into frame pixels. */
function arrowAction(event: KeyboardEvent, arrow: [number, number], features: ResolvedFeatures, k: number) {
  const step = (event.altKey ? FINE_KEY_STEP : KEY_STEP) / k;
  const [x, y] = arrow;
  if (!event.shiftKey) return {type: 'moveCrop', dx: x * step, dy: y * step} as const;
  return features.crop.enabled ? ({type: 'resizeCrop', dw: x * step, dh: y * step} as const) : null;
}

/** What a key does on the stage. */
function keyAction(event: KeyboardEvent, features: ResolvedFeatures, k: number): EditorAction | null {
  const arrow = ARROWS[event.key];
  if (arrow) return arrowAction(event, arrow, features, k);
  if (event.ctrlKey || event.metaKey) return null;
  if (features.zoom && (event.key === '+' || event.key === '=')) return {type: 'zoomBy', factor: KEY_ZOOM};
  if (features.zoom && event.key === '-') return {type: 'zoomBy', factor: 1 / KEY_ZOOM};
  if (features.rotate && event.key === 'r') return {type: 'rotate', direction: 1};
  if (features.rotate && event.key === 'R') return {type: 'rotate', direction: -1};
  return null;
}

/**
 * Measures the space it is given and lays the crop out to fit it. It is also the focusable
 * stand-in for the canvas: the cropper itself is hidden from assistive technology, and
 * every pointer gesture has a key here.
 */
export function CanvasArea({features, onUndo, onRedo, onHoldEnd, ...props}: Readonly<CanvasAreaProps>) {
  const labels = useLabels();
  const helpId = useId();
  const box = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Size | null>(null);
  // The step a held key is repeating, until the key is let go.
  const held = useRef<EditorAction | null>(null);

  useEffect(() => {
    const element = box.current;
    /* v8 ignore start -- an effect runs after the ref is attached */
    if (!element) return;
    /* v8 ignore stop */
    // A ResizeObserver reports once on observe, so this also takes the first measurement.
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const {width, height} = entry.contentRect;
      setStage((previous) => (previous?.width === width && previous.height === height ? previous : {width, height}));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const {image, orientation, straighten, crop} = props.state;
  // The same object until something it is made from changes. The cropper lays the selection
  // out again whenever the layout does, and a re-render that changed nothing (a consumer's
  // timer, say) must not put a selection that is being dragged back where it started.
  const layout = useMemo(
    () =>
      stage !== null && stage.width > 0 && stage.height > 0
        ? layoutStage(stage, STAGE_PADDING, image, orientation, straighten, crop)
        : null,
    [stage, image, orientation, straighten, crop],
  );

  const onKeyDown = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      const step = event.shiftKey ? onRedo : onUndo;
      if (!step) return;
      event.preventDefault();
      step();
      return;
    }
    if (!layout) return;
    const action = keyAction(event, features, layout.k);
    if (!action) return;
    event.preventDefault();
    // A key held down repeats many times a second. Its repeats are one gesture, so they are
    // one step to undo and one announcement. A rotation stays a step of its own each time.
    if (event.repeat && action.type !== 'rotate') {
      held.current = action;
      props.onAction(action, {transient: true});
    } else {
      props.onAction(action);
    }
  };

  const endHold = () => {
    const action = held.current;
    if (!action) return;
    held.current = null;
    onHoldEnd(action);
  };

  return (
    <Box
      ref={box}
      tabIndex={0}
      role="group"
      aria-label={labels.canvas}
      aria-describedby={helpId}
      onKeyDown={onKeyDown}
      onKeyUp={endHold}
      onBlur={endHold}
      sx={{
        position: 'relative',
        width: '100%',
        // The height it would like, given up to the controls under it in a short window.
        flex: `0 1 ${STAGE_HEIGHT}px`,
        maxHeight: '60vh',
        minHeight: STAGE_MIN_HEIGHT,
        bgcolor: 'grey.900',
        outline: 'none',
        '&:focus-visible': {outline: 2, outlineColor: 'primary.main', outlineOffset: 2},
      }}
    >
      <Box id={helpId} sx={visuallyHidden}>
        {labels.keyHelp}
      </Box>
      {stage && layout && <CropperView {...props} stage={stage} layout={layout} />}
    </Box>
  );
}
