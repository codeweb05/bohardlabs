import {createContext, createElement, useContext, useMemo, type ReactNode} from 'react';

import {DATE_API_FORMAT, DATE_PICKER_FORMAT} from '../filters/dateFormats';
import {ConfirmDialog} from '../internal/ConfirmDialog';
import type {DataTableConfirmProps, DataTableDateFormats, DataTableSlots} from '../types';

/**
 * The two things a host app has to be able to override so the table stops looking like a
 * guest in it: the confirmation dialog, and how dates are written.
 *
 * Both arrive as props on `DataTable` and are read several layers down (`BulkActions`,
 * `DateFilter`), so they travel by context rather than through every component in between.
 * The context default is the built-in set, which is what makes both props optional and
 * lets those components still render on their own in a test.
 */
interface ResolvedConfig {
  readonly slots: DataTableSlots;
  readonly dateFormats: Required<DataTableDateFormats>;
}

const DEFAULT_CONFIG: ResolvedConfig = {
  slots: {confirmDialog: ConfirmDialog},
  dateFormats: {display: DATE_PICKER_FORMAT, value: DATE_API_FORMAT},
};

const ConfigContext = createContext<ResolvedConfig>(DEFAULT_CONFIG);

export function DataTableConfigProvider({
  slots,
  dateFormats,
  children,
}: Readonly<{slots?: DataTableSlots; dateFormats?: DataTableDateFormats; children: ReactNode}>) {
  const value = useMemo<ResolvedConfig>(
    () => ({
      slots: {confirmDialog: slots?.confirmDialog ?? ConfirmDialog},
      dateFormats: {
        display: dateFormats?.display ?? DATE_PICKER_FORMAT,
        value: dateFormats?.value ?? DATE_API_FORMAT,
      },
    }),
    [slots?.confirmDialog, dateFormats?.display, dateFormats?.value],
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

/**
 * Renders the confirmation dialog: the consumer's if they passed one through
 * `slots.confirmDialog`, the table's own otherwise.
 *
 * `createElement` rather than JSX because the component type is read at render time, and
 * a capitalised local in JSX reads to a linter (and to a reviewer) as a component being
 * declared inside render, which is the bug this is not. The reference is stable: it comes
 * from a memoized context value.
 */
export function ConfirmSlot(props: Readonly<DataTableConfirmProps>) {
  return createElement(useContext(ConfigContext).slots.confirmDialog ?? ConfirmDialog, props);
}

/** Resolved dayjs format strings for the date filter. Never partial at this point. */
export function useDateFormats() {
  return useContext(ConfigContext).dateFormats;
}
