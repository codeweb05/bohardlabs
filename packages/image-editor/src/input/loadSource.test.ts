import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {EditorError} from '../errors';
import {accepts, checkBlob, loadSource, type Decoder} from './loadSource';

let created: string[];
let revoked: string[];

beforeEach(() => {
  created = [];
  revoked = [];
  let n = 0;
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => {
      const url = `blob:${++n}`;
      created.push(url);
      return url;
    }),
    revokeObjectURL: vi.fn((url: string) => revoked.push(url)),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function fakeDecoder(width: number, height: number): Decoder {
  return {
    decode: vi.fn(async () => ({width, height, image: {} as HTMLImageElement})),
    downscale: vi.fn(async () => new Blob(['small'], {type: 'image/jpeg'})),
  };
}

const jpeg = new Blob(['x'.repeat(100)], {type: 'image/jpeg'});

async function failure(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof EditorError ? error.code : 'not an EditorError';
  }
  return 'resolved';
}

describe('checkBlob', () => {
  it('accepts the default types and rejects others', () => {
    expect(checkBlob(jpeg, {})).toBeNull();
    expect(checkBlob(new Blob([], {type: 'image/heic'}), {})).toBe('unsupported-type');
    expect(checkBlob(new Blob([]), {})).toBe('unsupported-type');
  });

  it('checks the size limit', () => {
    expect(checkBlob(jpeg, {maxBytes: 99})).toBe('too-large');
    expect(checkBlob(jpeg, {maxBytes: 100})).toBeNull();
  });

  it('understands a wildcard', () => {
    expect(accepts(['image/*'], 'image/avif')).toBe(true);
    expect(accepts(['image/*'], 'video/mp4')).toBe(false);
  });
});

describe('loadSource', () => {
  it('loads a blob into a working copy', async () => {
    const loaded = await loadSource(jpeg, {}, fakeDecoder(800, 600));
    expect(loaded).toMatchObject({url: 'blob:1', width: 800, height: 600, type: 'image/jpeg'});
    loaded.revoke();
    expect(revoked).toEqual(['blob:1']);
  });

  it('rejects a type before creating a URL', async () => {
    expect(await failure(loadSource(new Blob([], {type: 'text/plain'}), {}, fakeDecoder(1, 1)))).toBe(
      'unsupported-type',
    );
    expect(created).toEqual([]);
  });

  it('rejects a file over the byte limit', async () => {
    expect(await failure(loadSource(jpeg, {maxBytes: 10}, fakeDecoder(1, 1)))).toBe('too-large');
  });

  it('rejects an image below the minimum size and revokes its URL', async () => {
    expect(await failure(loadSource(jpeg, {minWidth: 1000}, fakeDecoder(800, 600)))).toBe('too-small');
    expect(await failure(loadSource(jpeg, {minHeight: 700}, fakeDecoder(800, 600)))).toBe('too-small');
    expect(revoked).toEqual(created);
  });

  it('reports a decode failure as load-failed and revokes', async () => {
    const decoder = fakeDecoder(1, 1);
    vi.mocked(decoder.decode).mockRejectedValueOnce(new Error('broken'));
    expect(await failure(loadSource(jpeg, {}, decoder))).toBe('load-failed');
    expect(revoked).toEqual(['blob:1']);
  });

  it('caps a large source at 4096 on the long edge', async () => {
    const decoder = fakeDecoder(6000, 4000);
    const loaded = await loadSource(jpeg, {}, decoder);
    expect([loaded.width, loaded.height]).toEqual([4096, 2731]);
    expect(decoder.downscale).toHaveBeenCalledWith(expect.anything(), 4096, 2731, 'image/jpeg');
    expect(loaded.url).toBe('blob:2');
    expect(revoked).toEqual(['blob:1']);
  });

  it('reports a failed downscale as load-failed', async () => {
    const decoder = fakeDecoder(6000, 4000);
    vi.mocked(decoder.downscale).mockRejectedValueOnce(new Error('memory'));
    expect(await failure(loadSource(jpeg, {}, decoder))).toBe('load-failed');
    expect(revoked).toEqual(['blob:1']);
  });

  it('fetches a URL and takes the type from the response', async () => {
    const fetch = vi.fn(async () => new Response('png', {headers: {'Content-Type': 'image/png'}}));
    vi.stubGlobal('fetch', fetch);
    const loaded = await loadSource('https://example.com/a.png', {}, fakeDecoder(10, 10));
    expect(loaded.type).toBe('image/png');
    expect(fetch).toHaveBeenCalledWith('https://example.com/a.png', {mode: 'cors'});
  });

  it('reports a failed or refused fetch as load-failed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, {status: 404})),
    );
    expect(await failure(loadSource('https://example.com/missing.png', {}, fakeDecoder(1, 1)))).toBe('load-failed');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('CORS')));
    expect(await failure(loadSource('https://elsewhere.com/a.png', {}, fakeDecoder(1, 1)))).toBe('load-failed');
  });
});
