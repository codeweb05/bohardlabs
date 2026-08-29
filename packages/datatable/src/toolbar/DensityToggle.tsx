import DensityLargeIcon from '@mui/icons-material/DensityLarge';
import DensityMediumIcon from '@mui/icons-material/DensityMedium';
import DensitySmallIcon from '@mui/icons-material/DensitySmall';
import {IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip} from '@mui/material';
import {useState} from 'react';

import {useLabels} from '../i18n';
import type {TableDensity} from '../types';

interface DensityToggleProps {
  readonly density: TableDensity;
  readonly onChange: (density: TableDensity) => void;
}

export function DensityToggle({density, onChange}: Readonly<DensityToggleProps>) {
  const labels = useLabels();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  // `t()` returns the key itself when a translation is missing, never null, so `??` can
  // never fire. The fallback has to be `defaultValue` or a locale with a gap in it
  // renders "dataTable.density.compact" in the menu.

  const densityOptions: Array<{value: TableDensity; label: string; icon: React.ReactNode}> = [
    {
      value: 'compact',
      label: labels.densityCompact,
      icon: <DensitySmallIcon fontSize="small" />,
    },
    {
      value: 'comfortable',
      label: labels.densityComfortable,
      icon: <DensityMediumIcon fontSize="small" />,
    },
    {
      value: 'spacious',
      label: labels.densitySpacious,
      icon: <DensityLargeIcon fontSize="small" />,
    },
  ];

  const currentOption = densityOptions.find((opt) => opt.value === density);

  const handleSelect = (value: TableDensity) => {
    onChange(value);
    setAnchorEl(null);
  };

  return (
    <>
      <Tooltip title={labels.densityLabel}>
        <IconButton
          onClick={(e) => setAnchorEl(e.currentTarget)}
          size="small"
          aria-label={labels.densityLabel}
          sx={{
            p: {xs: 0.5, sm: 1},
          }}
        >
          {currentOption?.icon ?? <DensityMediumIcon sx={{fontSize: {xs: '1.25rem', sm: '1.5rem'}}} />}
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 140,
              mt: 0.5,
            },
          },
        }}
      >
        {densityOptions.map((option) => (
          <MenuItem key={option.value} onClick={() => handleSelect(option.value)} selected={option.value === density}>
            <ListItemIcon>{option.icon}</ListItemIcon>
            <ListItemText>{option.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
