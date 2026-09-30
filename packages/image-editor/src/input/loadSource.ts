import {EditorError} from '../errors';
import type {ImageEditorErrorCode, ImageEditorInput} from '../types';

/** iOS Safari caps canvas memory; a larger working copy fails to draw there. */
export const MAX_WORKING_EDGE = 4096;

export const DEFAULT_ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export interface LoadedImage {
  /** An object URL for the working copy. The engine shows it; `revoke` releases it. */
  url: string;
  image: CanvasImageSource;
  width: number;
  height: number;
  /** The source's MIME type. */
  type: string;
  revoke: () => void;
}

/** The browser-dependent half of loading, swapped for a fake in tests. */
export interface Decoder {
  decode: (url: string) => Promise<{width: number; height: number; image: CanvasImageSource}>;
  downscale: (image: CanvasImageSource, width: number, height: number, type: string) => Promise<Blob>;
}

export const browserDecoder: Decoder = {
  decode: async (url) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    return {width: image.naturalWidth, height: image.naturalHeight, image};
  },
  downscale: (image, width, height, type) =>
    new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('No 2d context'));
        return;
      }
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, width, height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Encode failed'))), type);
    }),
};

export function accepts(accept: string[], type: string): boolean {
  return accept.some(
    (pattern) => pattern === type || (pattern.endsWith('/*') && type.startsWith(pattern.slice(0, -1))),
  );
}

export function checkBlob(blob: Blob, input: ImageEditorInput): ImageEditorErrorCode | null {
  if (!accepts(input.accept ?? DEFAULT_ACCEPT, blob.type)) return 'unsupported-type';
  if (input.maxBytes !== undefined && blob.size > input.maxBytes) return 'too-large';
  return null;
}

async function fetchBlob(url: string): Promise<Blob> {
  try {
    const response = await fetch(url, {mode: 'cors'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.blob();
  } catch (error) {
    throw new EditorError('load-failed', error);
  }
}

/**
 * Turns a source into a decoded working copy no larger than {@link MAX_WORKING_EDGE}. A URL
 * is fetched first, so every source has a type and a size to check; a cross-origin URL
 * must allow CORS, or the canvas would be tainted at export.
 */
export async function loadSource(
  source: Blob | string,
  input: ImageEditorInput,
  decoder: Decoder = browserDecoder,
): Promise<LoadedImage> {
  const blob = typeof source === 'string' ? await fetchBlob(source) : source;
  const problem = checkBlob(blob, input);
  if (problem) throw new EditorError(problem);

  let url = URL.createObjectURL(blob);
  try {
    let decoded = await decoder.decode(url).catch((error: unknown) => {
      throw new EditorError('load-failed', error);
    });
    if (decoded.width < (input.minWidth ?? 0) || decoded.height < (input.minHeight ?? 0)) {
      throw new EditorError('too-small');
    }
    const longEdge = Math.max(decoded.width, decoded.height);
    if (longEdge > MAX_WORKING_EDGE) {
      const factor = MAX_WORKING_EDGE / longEdge;
      const width = Math.round(decoded.width * factor);
      const height = Math.round(decoded.height * factor);
      const smaller = await decoder.downscale(decoded.image, width, height, blob.type);
      const next = URL.createObjectURL(smaller);
      URL.revokeObjectURL(url);
      url = next;
      decoded = {...(await decoder.decode(url)), width, height};
    }
    const working = url;
    return {
      url: working,
      image: decoded.image,
      width: decoded.width,
      height: decoded.height,
      type: blob.type,
      revoke: () => URL.revokeObjectURL(working),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error instanceof EditorError ? error : new EditorError('load-failed', error);
  }
}
