import {createContext, useContext, useMemo} from 'react';
import type {ReactNode} from 'react';

import type {DataTableLabels} from './labels';
import {DEFAULT_LABELS} from './labels';

/**
 * Defaults are the context default, not `null`, so every component reads real strings even
 * when rendered outside a provider (a leaf under test, a story of one filter).
 */
const LabelsContext = createContext<DataTableLabels>(DEFAULT_LABELS);

interface DataTableLabelsProviderProps {
  readonly labels?: Partial<DataTableLabels>;
  readonly children: ReactNode;
}

export function DataTableLabelsProvider({labels, children}: Readonly<DataTableLabelsProviderProps>) {
  const value = useMemo<DataTableLabels>(() => (labels ? {...DEFAULT_LABELS, ...labels} : DEFAULT_LABELS), [labels]);

  return <LabelsContext.Provider value={value}>{children}</LabelsContext.Provider>;
}

export function useLabels(): DataTableLabels {
  return useContext(LabelsContext);
}
