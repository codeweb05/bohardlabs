import {describe, expect, it, vi} from 'vitest';

import {resolveFeatures} from '../features.js';
import {initialEditorState} from '../state/editorState.js';
import {exportImage} from './exportImage.js';

// jsdom has no canvas. The pixels are checked in the Storybook project, in Chromium; this
// covers what happens around them, with a context that records its calls.
function fakeContext() {
  const calls = {
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    ellipse: vi.fn(),
    clip: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    transform: vi.fn(),
    drawImage: vi.fn(),
  };
  const context: Partial<CanvasRenderingContext2D> = calls;
  return {context: context as CanvasRenderingContext2D, calls};
}

function encodeAs(blob: Blob | null) {
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(blob));
}

const options = {
  image: {} as CanvasImageSource,
  state: initialEditorState({width: 800, height: 600}, resolveFeatures(undefined)),
  shape: 'rect',
  sourceType: 'image/jpeg',
  output: {},
} as const;

describe('exportImage', () => {
  it('returns a file named and typed after what the browser encoded', async () => {
    const {context, calls} = fakeContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    encodeAs(new Blob(['jpeg'], {type: 'image/jpeg'}));
    const result = await exportImage({...options, output: {fileName: 'avatar', maxWidth: 400}});
    expect(result).toMatchObject({width: 400, height: 300, type: 'image/jpeg'});
    expect(result.file.name).toBe('avatar.jpg');
    // A JPEG cannot be transparent, so the canvas is filled before the image is drawn.
    expect(calls.fillRect).toHaveBeenCalledWith(0, 0, 400, 300);
    expect(calls.drawImage).toHaveBeenCalledWith(options.image, 0, 0, 800, 600);
  });

  it('rejects when the canvas has no 2d context', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(exportImage(options)).rejects.toThrow('No 2d context');
  });

  it('rejects when the browser cannot encode the canvas', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeContext().context);
    encodeAs(null);
    await expect(exportImage(options)).rejects.toThrow('Encode failed');
  });
});
