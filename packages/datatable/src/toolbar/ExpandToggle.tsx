import CollapseIcon from '@mui/icons-material/UnfoldLess';
import ExpandIcon from '@mui/icons-material/UnfoldMore';
import {IconButton, Tooltip} from '@mui/material';
import type {Table} from '@tanstack/react-table';

import {useTableUI} from '../DataTableContext.hooks';
import {useLabels} from '../i18n';
import type {RowData} from '../types';

interface ExpandToggleProps<TData extends RowData> {
  readonly table: Table<TData>;
}

export function ExpandToggle<TData extends RowData>({table}: Readonly<ExpandToggleProps<TData>>) {
  const labels = useLabels();
  const {expanded} = useTableUI();

  // Check if all rows are expanded
  const rows = table.getRowModel().rows;
  const allExpanded = rows.length > 0 && rows.every((row) => row.getIsExpanded());
  const someExpanded = typeof expanded === 'object' ? Object.keys(expanded).some((key) => expanded[key]) : false;

  const handleToggleAll = () => {
    if (allExpanded) {
      // Collapse all
      table.toggleAllRowsExpanded(false);
    } else {
      // Expand all
      table.toggleAllRowsExpanded(true);
    }
  };

  const tooltipText = allExpanded ? labels.collapseAllTooltip : labels.expandAllTooltip;

  const ariaLabel = allExpanded ? labels.collapseAll : labels.expandAll;

  return (
    <Tooltip title={tooltipText}>
      <IconButton
        onClick={handleToggleAll}
        size="small"
        aria-label={ariaLabel}
        sx={{
          p: {xs: 0.5, sm: 1},
          color: someExpanded || allExpanded ? 'primary.main' : 'text.secondary',
          '&:hover': {
            color: 'primary.main',
          },
        }}
      >
        {allExpanded ? (
          <CollapseIcon sx={{fontSize: {xs: '1.25rem', sm: '1.5rem'}}} />
        ) : (
          <ExpandIcon sx={{fontSize: {xs: '1.25rem', sm: '1.5rem'}}} />
        )}
      </IconButton>
    </Tooltip>
  );
}
