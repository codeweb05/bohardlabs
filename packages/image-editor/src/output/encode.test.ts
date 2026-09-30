import {describe, expect, it, vi} from 'vitest';

import {EditorError} from '../errors.js';
import {
  encodeWithFallback,
  extensionFor,
  fitToBytes,
  MAX_QUALITY_ENCODES,
  needsAlpha,
  resolveOutputType,
} from './encode.js';

function blobOf(size: number, type: string): Blob {
  return new Blob([new Uint8Array(size)], {type});
}

describe('resolveOutputType', () => {
  it('uses the requested type first', () => {
    expect(resolveOutputType('image/webp', 'image/jpeg', 'circle')).toBe('image/webp');
  });

  it('uses PNG for a circle so the corners stay transparent', () => {
    expect(resolveOutputType(undefined, 'image/jpeg', 'circle')).toBe('image/png');
  });

  it('keeps an encodable source type and falls back to PNG otherwise', () => {
    expect(resolveOutputType(undefined, 'image/webp', 'rect')).toBe('image/webp');
    expect(resolveOutputType(undefined, 'image/gif', 'rect')).toBe('image/png');
  });
});

describe('needsAlpha', () => {
  it('is true for a circle or a source that can be transparent', () => {
    expect(needsAlpha('image/jpeg', 'circle')).toBe(true);
    expect(needsAlpha('image/gif', 'rect')).toBe(true);
    expect(needsAlpha('image/jpeg', 'rect')).toBe(false);
  });
});

describe('extensionFor', () => {
  it('names each output type', () => {
    expect(['image/jpeg', 'image/png', 'image/webp', 'image/bmp'].map(extensionFor)).toEqual([
      '.jpg',
      '.png',
      '.webp',
      '',
    ]);
  });
});

describe('encodeWithFallback', () => {
  it('returns the blob when the browser honoured the type', async () => {
    const encode = vi.fn(async (type: string) => blobOf(1, type));
    await expect(encodeWithFallback(encode, 'image/webp', 0.9, false)).resolves.toHaveProperty('type', 'image/webp');
    expect(encode).toHaveBeenCalledTimes(1);
  });

  it('re-encodes as JPEG when WebP came back as PNG and no alpha is needed', async () => {
    const encode = vi.fn(async (type: string) => blobOf(1, type === 'image/webp' ? 'image/png' : type));
    const blob = await encodeWithFallback(encode, 'image/webp', 0.9, false);
    expect(blob.type).toBe('image/jpeg');
  });

  it('keeps the PNG when alpha is needed', async () => {
    const encode = vi.fn(async () => blobOf(1, 'image/png'));
    const blob = await encodeWithFallback(encode, 'image/webp', 0.9, true);
    expect(blob.type).toBe('image/png');
    expect(encode).toHaveBeenCalledTimes(1);
  });
});

describe('fitToBytes', () => {
  it('returns the first encode when it already fits', async () => {
    const encode = vi.fn(async () => blobOf(100, 'image/jpeg'));
    await expect(fitToBytes({encode, quality: 0.92, maxBytes: 200, longEdge: 1000})).resolves.toMatchObject({scale: 1});
    expect(encode).toHaveBeenCalledTimes(1);
  });

  it('searches quality between the floor and the request within the budget', async () => {
    // Size grows with quality: 1000 bytes at q=1.
    const encode = vi.fn(async (_scale: number, quality: number) => blobOf(Math.round(quality * 1000), 'image/jpeg'));
    const {blob, scale} = await fitToBytes({encode, quality: 0.92, maxBytes: 800, longEdge: 1000});
    expect(scale).toBe(1);
    expect(blob.size).toBeLessThanOrEqual(800);
    expect(blob.size).toBeGreaterThan(700);
    expect(encode).toHaveBeenCalledTimes(MAX_QUALITY_ENCODES);
  });

  it('shrinks the dimensions when even the quality floor is too big', async () => {
    const encode = vi.fn(async (scale: number) => blobOf(Math.round(scale * scale * 10_000), 'image/jpeg'));
    const {blob, scale} = await fitToBytes({encode, quality: 0.92, maxBytes: 2500, longEdge: 1000});
    expect(blob.size).toBeLessThanOrEqual(2500);
    expect(scale).toBeLessThan(1);
  });

  it('shrinks a PNG without trying other qualities', async () => {
    const encode = vi.fn(async (scale: number, _quality: number) =>
      blobOf(Math.round(scale * scale * 10_000), 'image/png'),
    );
    const {scale} = await fitToBytes({encode, quality: 0.92, maxBytes: 2500, longEdge: 1000});
    expect(scale).toBeLessThan(0.5);
    expect(new Set(encode.mock.calls.map(([, quality]) => quality))).toEqual(new Set([0.92]));
  });

  it('fails with output-too-large instead of going under 64 px', async () => {
    const encode = vi.fn(async () => blobOf(10_000, 'image/png'));
    const error = await fitToBytes({encode, quality: 0.92, maxBytes: 10, longEdge: 1000}).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(EditorError);
    expect(error).toHaveProperty('code', 'output-too-large');
  });
});
