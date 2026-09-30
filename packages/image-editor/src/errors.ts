import type {ImageEditorError, ImageEditorErrorCode} from './types.js';

/** Thrown inside the package; reported to the consumer as a plain `ImageEditorError`. */
export class EditorError extends Error {
  readonly code: ImageEditorErrorCode;

  constructor(code: ImageEditorErrorCode, cause?: unknown) {
    super(code, {cause});
    this.name = 'EditorError';
    this.code = code;
  }
}

export function toEditorError(error: unknown, fallback: ImageEditorErrorCode): ImageEditorError {
  if (error instanceof EditorError)
    return error.cause === undefined ? {code: error.code} : {code: error.code, cause: error.cause};
  return {code: fallback, cause: error};
}
