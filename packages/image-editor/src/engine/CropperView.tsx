import Box from '@mui/material/Box';
import {alpha, useTheme} from '@mui/material/styles';
import type {CropperCanvas, CropperImage, CropperSelection, CropperShade} from 'cropperjs';
import {useLayoutEffect, useRef, useState} from 'react';

import type {EditorAction, EditorState} from '../state/editorState';
import {clampRect, stageToCrop, type Rect, type Size, type StageLayout} from '../state/geometry';
import type {CropShape} from '../types';
import {loadCropper} from './loadCropper';

export interface CropperViewProps {
  src: string;
  state: EditorState;
  stage: Size;
  layout: StageLayout;
  shape: CropShape;
  filter: string;
  editable: boolean;
  onAction: (action: EditorAction, options?: {transient?: boolean}) => void;
  onCommit: () => void;
}

/** A wheel has no end event; the gesture ends after this much quiet. */
const WHEEL_COMMIT_MS = 300;
/** A resize never makes the selection smaller than this many stage pixels a side. */
const MIN_SELECTION = 16;

const RESIZE_HANDLES = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw']
  .map((edge) => `<cropper-handle action="${edge}-resize"></cropper-handle>`)
  .join('');

// Static markup, no interpolated input. The stage is decoration for pointer users; the
// keyboard layer around it is what assistive technology sees.
const TEMPLATE =
  '<cropper-canvas aria-hidden="true">' +
  '<cropper-image rotatable scalable skewable translatable></cropper-image>' +
  '<cropper-handle action="move" plain></cropper-handle>' +
  '<cropper-shade></cropper-shade>' +
  '<cropper-selection outlined precise>' +
  '<cropper-grid covered></cropper-grid>' +
  '<cropper-handle action="move" plain></cropper-handle>' +
  RESIZE_HANDLES +
  '</cropper-selection>' +
  '</cropper-canvas>';

const CIRCLE_STYLE = ':host([data-shape="circle"]){border-radius:50%}';
const HANDLE_STYLE = ':host([action$=-resize]):after{width:9px;height:9px;border-radius:2px}';

interface Elements {
  canvas: CropperCanvas;
  image: CropperImage;
  shade: CropperShade;
  selection: CropperSelection;
  resizeHandles: HTMLElement[];
  grid: HTMLElement;
}

function build(host: HTMLElement): Elements | null {
  host.innerHTML = TEMPLATE;
  const canvas = host.querySelector<CropperCanvas>('cropper-canvas');
  const image = host.querySelector<CropperImage>('cropper-image');
  const shade = host.querySelector<CropperShade>('cropper-shade');
  const selection = host.querySelector<CropperSelection>('cropper-selection');
  const grid = host.querySelector<HTMLElement>('cropper-grid');
  if (!canvas || !image || !shade || !selection || !grid) return null;
  const resizeHandles = Array.from(host.querySelectorAll<HTMLElement>('cropper-handle[action$="-resize"]'));
  shade.$addStyles(CIRCLE_STYLE);
  selection.$addStyles(CIRCLE_STYLE);
  for (const handle of resizeHandles) {
    if ('$addStyles' in handle && typeof handle.$addStyles === 'function') handle.$addStyles(HANDLE_STYLE);
  }
  return {canvas, image, shade, selection, resizeHandles, grid};
}

interface ActionDetail {
  action: string;
  scale?: number;
  dx: number;
  dy: number;
  wheel: boolean;
}

function numberOf(source: object, key: string): number | undefined {
  const value: unknown = (source as Record<string, unknown>)[key];
  return typeof value === 'number' ? value : undefined;
}

function readAction(event: Event): ActionDetail | null {
  if (!(event instanceof CustomEvent)) return null;
  const detail: unknown = event.detail;
  if (typeof detail !== 'object' || detail === null || !('action' in detail)) return null;
  if (typeof detail.action !== 'string') return null;
  const related: unknown = 'relatedEvent' in detail ? detail.relatedEvent : null;
  return {
    action: detail.action,
    scale: numberOf(detail, 'scale'),
    dx: (numberOf(detail, 'endX') ?? 0) - (numberOf(detail, 'startX') ?? 0),
    dy: (numberOf(detail, 'endY') ?? 0) - (numberOf(detail, 'startY') ?? 0),
    wheel: typeof WheelEvent !== 'undefined' && related instanceof WheelEvent,
  };
}

function readRect(event: Event): Rect | null {
  if (!(event instanceof CustomEvent)) return null;
  const detail: unknown = event.detail;
  if (typeof detail !== 'object' || detail === null) return null;
  const x = numberOf(detail, 'x');
  const y = numberOf(detail, 'y');
  const width = numberOf(detail, 'width');
  const height = numberOf(detail, 'height');
  if (x === undefined || y === undefined || width === undefined || height === undefined) return null;
  return {x, y, width, height};
}

/**
 * cropperjs as a view. State is the truth: every render lays the image and the selection
 * out from `layout`, and every gesture comes back as an `EditorAction`. cropperjs never
 * moves or scales the image itself; the adapter cancels those actions and dispatches its own.
 */
export function CropperView(props: CropperViewProps) {
  const {src, state, stage, layout, shape, filter, editable} = props;
  const theme = useTheme();
  const hostRef = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const elements = useRef<Elements | null>(null);
  // Bumped when the elements are built and again when the image has loaded (cropperjs
  // centres it on load), so the layout effect runs again at both moments.
  const [built, setBuilt] = useState(0);

  useLayoutEffect(() => {
    latest.current = props;
  });

  // Build once per source. The import happens here, so the server never reaches it.
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let cancelled = false;
    let wheelTimer: ReturnType<typeof setTimeout> | undefined;

    const commit = () => {
      clearTimeout(wheelTimer);
      wheelTimer = undefined;
      latest.current.onCommit();
    };

    const onActionCapture = (event: Event) => {
      const detail = readAction(event);
      if (!detail) return;
      const {layout: current, onAction} = latest.current;
      if (detail.action === 'move') {
        event.preventDefault();
        if (detail.dx !== 0 || detail.dy !== 0) {
          onAction({type: 'moveCrop', dx: -detail.dx / current.k, dy: -detail.dy / current.k}, {transient: true});
        }
      } else if (detail.action === 'scale' || detail.action === 'transform' || detail.action === 'rotate') {
        event.preventDefault();
        if (detail.scale !== undefined && detail.scale !== 0) {
          onAction({type: 'zoomBy', factor: 1 + detail.scale}, {transient: true});
          if (detail.wheel) {
            clearTimeout(wheelTimer);
            wheelTimer = setTimeout(commit, WHEEL_COMMIT_MS);
          }
        }
      }
    };

    const onActionEnd = () => {
      const live = elements.current;
      if (!live) return;
      const {layout: current, onAction} = latest.current;
      const {x, y, width, height} = live.selection;
      onAction({type: 'setCrop', crop: stageToCrop(current, {x, y, width, height})}, {transient: true});
      commit();
    };

    const onSelectionChange = (event: Event) => {
      const live = elements.current;
      if (!live || event.target !== live.selection) return;
      const rect = readRect(event);
      if (!rect) return;
      if (rect.width < MIN_SELECTION || rect.height < MIN_SELECTION) {
        event.preventDefault();
        return;
      }
      const {frame} = latest.current.layout;
      const inside = clampRect({...rect, x: rect.x - frame.x, y: rect.y - frame.y}, frame);
      const clamped = {...inside, x: inside.x + frame.x, y: inside.y + frame.y};
      if (
        Math.abs(clamped.x - rect.x) + Math.abs(clamped.y - rect.y) > 1e-6 ||
        Math.abs(clamped.width - rect.width) + Math.abs(clamped.height - rect.height) > 1e-6
      ) {
        event.preventDefault();
        live.selection.$change(clamped.x, clamped.y, clamped.width, clamped.height);
      }
    };

    const bump = () => {
      if (!cancelled) setBuilt((count) => count + 1);
    };

    const start = async () => {
      await loadCropper();
      if (cancelled) return;
      const created = build(host);
      if (!created) return;
      const {image, canvas, selection} = created;
      elements.current = created;
      host.addEventListener('action', onActionCapture, {capture: true});
      canvas.addEventListener('actionend', onActionEnd);
      selection.addEventListener('change', onSelectionChange);
      image.setAttribute('src', src);
      bump();
      await image.$ready();
      bump();
    };
    // A failed import or decode leaves the stage empty; the session has already checked
    // that the image decodes, so this is a lost chunk, and the next source retries it.
    start().catch(() => undefined);

    return () => {
      cancelled = true;
      clearTimeout(wheelTimer);
      host.removeEventListener('action', onActionCapture, {capture: true});
      host.replaceChildren();
      elements.current = null;
    };
  }, [src]);

  const shade = alpha(theme.palette.common.black, 0.55);
  const accent = theme.palette.primary.main;
  const grid = alpha(theme.palette.common.white, 0.4);

  useLayoutEffect(() => {
    const current = elements.current;
    if (!current) return;
    const {canvas, image, selection, resizeHandles} = current;
    canvas.style.width = `${stage.width}px`;
    canvas.style.height = `${stage.height}px`;
    image.$setTransform([...layout.matrix]);
    image.style.filter = filter;
    current.shade.style.setProperty('--theme-color', shade);
    current.shade.dataset.shape = shape;
    current.grid.style.setProperty('--theme-color', grid);
    selection.style.setProperty('--theme-color', accent);
    selection.dataset.shape = shape;
    selection.resizable = editable;
    selection.aspectRatio = state.ratio ?? Number.NaN;
    for (const handle of resizeHandles) {
      handle.toggleAttribute('hidden', !editable);
      handle.style.setProperty('--theme-color', accent);
    }
    const {x, y, width, height} = layout.selection;
    selection.$change(x, y, width, height, state.ratio ?? Number.NaN, true);
  }, [built, stage, layout, shape, filter, editable, state.ratio, shade, accent, grid]);

  return (
    <Box
      ref={hostRef}
      data-testid="image-editor-stage"
      sx={{width: stage.width, height: stage.height, bgcolor: 'grey.900', overflow: 'hidden'}}
    />
  );
}
