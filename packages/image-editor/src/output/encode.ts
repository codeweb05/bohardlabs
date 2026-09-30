import {EditorError} from '../errors';
import type {CropShape, OutputType} from '../types';

export const DEFAULT_QUALITY = 0.92;
export const QUALITY_FLOOR = 0.6;
export const MAX_QUALITY_ENCODES = 6;
export const MIN_LONG_EDGE = 64;

const LOSSY = new Set(['image/jpeg', 'image/webp']);
const SOURCE_TYPES = new Set<string>(['image/jpeg', 'image/png', 'image/webp']);

function isOutputType(type: string): type is OutputType {
  return SOURCE_TYPES.has(type);
}

export function resolveOutputType(requested: OutputType | undefined, sourceType: string, shape: CropShape): OutputType {
  if (requested) return requested;
  if (shape === 'circle') return 'image/png';
  return isOutputType(sourceType) ? sourceType : 'image/png';
}

export function supportsAlpha(type: string): boolean {
  return type === 'image/png' || type === 'image/webp';
}

/** Whether the output can have transparent pixels: a circle, or a source that had them. */
export function needsAlpha(sourceType: string, shape: CropShape): boolean {
  return shape === 'circle' || sourceType === 'image/png' || sourceType === 'image/webp' || sourceType === 'image/gif';
}

export function extensionFor(type: string): string {
  if (type === 'image/jpeg') return '.jpg';
  if (type === 'image/png') return '.png';
  if (type === 'image/webp') return '.webp';
  return '';
}

/**
 * A browser that cannot encode a type (older Safari with WebP) silently returns PNG. On a
 * mismatch, re-encode as PNG when transparency matters and as JPEG when it does not.
 */
export async function encodeWithFallback(
  encode: (type: OutputType, quality: number) => Promise<Blob>,
  type: OutputType,
  quality: number,
  alpha: boolean,
): Promise<Blob> {
  const blob = await encode(type, quality);
  if (blob.type === type) return blob;
  const fallback = alpha ? 'image/png' : 'image/jpeg';
  return blob.type === fallback ? blob : encode(fallback, quality);
}

async function fitQuality(
  encode: (scale: number, quality: number) => Promise<Blob>,
  scale: number,
  quality: number,
  maxBytes: number,
): Promise<{fit: Blob | null; smallest: Blob}> {
  const first = await encode(scale, quality);
  if (first.size <= maxBytes) return {fit: first, smallest: first};
  if (!LOSSY.has(first.type) || quality <= QUALITY_FLOOR) return {fit: null, smallest: first};
  const floor = await encode(scale, QUALITY_FLOOR);
  if (floor.size > maxBytes) return {fit: null, smallest: floor};
  let low = QUALITY_FLOOR;
  let high = quality;
  let best = floor;
  for (let encodes = 2; encodes < MAX_QUALITY_ENCODES; encodes++) {
    const middle = (low + high) / 2;
    const blob = await encode(scale, middle);
    if (blob.size <= maxBytes) {
      low = middle;
      best = blob;
    } else {
      high = middle;
    }
  }
  return {fit: best, smallest: floor};
}

/**
 * Makes a file fit `maxBytes`: first by lowering a lossy type's quality (never under 0.6,
 * at most six encodes per size), then by shrinking the dimensions and trying again. Stops
 * with `output-too-large` rather than go under 64 px on the long edge; a file over the
 * limit is never returned.
 */
export async function fitToBytes(options: {
  encode: (scale: number, quality: number) => Promise<Blob>;
  quality: number;
  maxBytes: number;
  longEdge: number;
}): Promise<{blob: Blob; scale: number}> {
  const {encode, quality, maxBytes, longEdge} = options;
  let scale = 1;
  for (;;) {
    const {fit, smallest} = await fitQuality(encode, scale, quality, maxBytes);
    if (fit) return {blob: fit, scale};
    scale *= Math.sqrt(maxBytes / smallest.size) * 0.95;
    if (longEdge * scale < MIN_LONG_EDGE) throw new EditorError('output-too-large');
  }
}
