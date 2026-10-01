import {createContext, useContext, useMemo} from 'react';
import type {ReactNode} from 'react';

import type {ImageEditorLabels} from '../labels.js';
import {DEFAULT_IMAGE_EDITOR_LABELS} from '../labels.js';
import type {ImageEditorErrorCode} from '../types.js';

/** Defaults are the context default, so a part rendered alone under test still reads real strings. */
const LabelsContext = createContext<ImageEditorLabels>(DEFAULT_IMAGE_EDITOR_LABELS);

interface LabelsProviderProps {
  readonly labels?: Partial<ImageEditorLabels>;
  readonly children: ReactNode;
}

export function LabelsProvider({labels, children}: Readonly<LabelsProviderProps>) {
  // `labels` is usually an inline object; merging once per change keeps every reader's
  // context value stable across the parent's renders.
  const value = useMemo<ImageEditorLabels>(() => {
    if (!labels) return DEFAULT_IMAGE_EDITOR_LABELS;
    // A key passed as `undefined` keeps its default; a plain spread would erase it.
    const given = Object.fromEntries(Object.entries(labels).filter(([, label]) => label !== undefined));
    return {...DEFAULT_IMAGE_EDITOR_LABELS, ...given};
  }, [labels]);

  return <LabelsContext.Provider value={value}>{children}</LabelsContext.Provider>;
}

export function useLabels(): ImageEditorLabels {
  return useContext(LabelsContext);
}

export function errorMessage(labels: ImageEditorLabels, code: ImageEditorErrorCode): string {
  switch (code) {
    case 'unsupported-type':
      return labels.errorUnsupportedType;
    case 'too-small':
      return labels.errorTooSmall;
    case 'too-large':
      return labels.errorTooLarge;
    case 'load-failed':
      return labels.errorLoadFailed;
    case 'output-too-large':
      return labels.errorOutputTooLarge;
  }
}
