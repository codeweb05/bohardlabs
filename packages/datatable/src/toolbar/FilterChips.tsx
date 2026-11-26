import CloseIcon from '@mui/icons-material/Close';
import {Box, Button, Chip, IconButton, alpha} from '@mui/material';
import type {ColumnFiltersState} from '@tanstack/react-table';

import {useDateFormats} from '../config/ConfigContext';
import {describeFilter} from '../filters/describeFilter';
import {useLabels} from '../i18n';
import type {DataTableColumnDef, RowData} from '../types';

interface FilterChipsProps<TData extends RowData> {
  /** Latest column definitions, for each column's name, filter type and option labels. */
  readonly columns: readonly DataTableColumnDef<TData>[];
  readonly columnFilters: ColumnFiltersState;
  readonly globalFilter: string;
  /** Clears one column's filter. The caller resets the page. */
  readonly onRemove: (columnId: string) => void;
  /** Clears every filter and the search. */
  readonly onClearAll: () => void;
}

/**
 * The row under the toolbar that says what is narrowing the list: one chip per column
 * filter, with the operator the request sends, and one for the search. A column filter's
 * chip removes it; the search chip only reports, since the search box clears it.
 */
export function FilterChips<TData extends RowData>({
  columns,
  columnFilters,
  globalFilter,
  onRemove,
  onClearAll,
}: Readonly<FilterChipsProps<TData>>) {
  const labels = useLabels();
  const dateFormats = useDateFormats();

  const chips = columnFilters.flatMap((filter) => {
    const def = columns.find((column) => column.id === filter.id);
    const name = typeof def?.header === 'string' ? def.header : filter.id;
    const text = describeFilter(filter, name, def?.filterConfig, {labels, dateFormats});
    return text === null ? [] : [{id: filter.id, text}];
  });

  if (chips.length === 0 && globalFilter === '') return null;

  return (
    <Box
      role="group"
      aria-label={labels.activeFilters(chips.length + (globalFilter === '' ? 0 : 1))}
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1,
        px: {xs: 1.5, sm: 2},
        py: 1,
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      {chips.map((chip) => (
        <Chip
          key={chip.id}
          size="small"
          // A container, not a control: the remove button inside is the one thing to press.
          label={
            <Box component="span" sx={{display: 'inline-flex', alignItems: 'center', gap: 0.25}}>
              {chip.text}
              <IconButton
                size="small"
                aria-label={labels.removeFilter(chip.text)}
                onClick={() => onRemove(chip.id)}
                sx={{p: 0.25, mr: -0.75, color: 'text.secondary'}}
              >
                <CloseIcon sx={{fontSize: '0.875rem'}} />
              </IconButton>
            </Box>
          }
          sx={{
            bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.24 : 0.12),
            color: 'text.primary',
          }}
        />
      ))}

      {globalFilter !== '' && <Chip size="small" variant="outlined" label={labels.filterSearch(globalFilter)} />}

      <Button size="small" onClick={onClearAll} sx={{minWidth: 'auto', px: 1}}>
        {labels.clearAllFilters}
      </Button>
    </Box>
  );
}
