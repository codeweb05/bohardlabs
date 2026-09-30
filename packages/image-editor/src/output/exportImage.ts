import type {EditorState} from '../state/editorState.js';
import type {CropShape, ImageEditorOutput, ImageEditorResult, OutputType} from '../types.js';
import {
  DEFAULT_QUALITY,
  encodeWithFallback,
  extensionFor,
  fitToBytes,
  needsAlpha,
  resolveOutputType,
  supportsAlpha,
} from './encode.js';
import {outputSize, renderState} from './render.js';

const DEFAULT_BACKGROUND = '#ffffff';

function toBlob(canvas: HTMLCanvasElement, type: OutputType, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Encode failed'))), type, quality);
  });
}

/** State → canvas → encode → fit → `File`. */
export async function exportImage(options: {
  image: CanvasImageSource;
  state: EditorState;
  shape: CropShape;
  sourceType: string;
  output: ImageEditorOutput;
}): Promise<ImageEditorResult> {
  const {image, state, shape, sourceType, output} = options;
  const type = resolveOutputType(output.type, sourceType, shape);
  const quality = output.quality ?? DEFAULT_QUALITY;
  const alpha = needsAlpha(sourceType, shape);
  const base = outputSize(state.crop, output.maxWidth, output.maxHeight);
  const sizeAt = (scale: number) => ({
    width: Math.max(1, Math.round(base.width * scale)),
    height: Math.max(1, Math.round(base.height * scale)),
  });
  const encodeAt = (scale: number, q: number) =>
    encodeWithFallback(
      (t, qq) =>
        toBlob(
          renderState(image, state, {
            shape,
            ...sizeAt(scale),
            background: supportsAlpha(t) ? null : (output.background ?? DEFAULT_BACKGROUND),
          }),
          t,
          qq,
        ),
      type,
      q,
      alpha,
    );

  const {blob, scale} =
    output.maxBytes === undefined
      ? {blob: await encodeAt(1, quality), scale: 1}
      : await fitToBytes({
          encode: encodeAt,
          quality,
          maxBytes: output.maxBytes,
          longEdge: Math.max(base.width, base.height),
        });
  const size = sizeAt(scale);
  const file = new File([blob], `${output.fileName ?? 'image'}${extensionFor(blob.type)}`, {type: blob.type});
  return {file, width: size.width, height: size.height, type: blob.type};
}
