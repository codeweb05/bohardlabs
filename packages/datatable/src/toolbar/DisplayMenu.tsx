import CheckIcon from '@mui/icons-material/Check';
import DisplaySettingsIcon from '@mui/icons-material/DisplaySettings';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import WidthWideIcon from '@mui/icons-material/WidthWide';
import WrapTextIcon from '@mui/icons-material/WrapText';
import {ListItemIcon, ListItemText, MenuItem} from '@mui/material';
import {useState} from 'react';

import {AnchoredMenu} from '../AnchoredMenu';
import {useLabels} from '../i18n';
import {ToolbarIconButton} from '../ToolbarIconButton';

interface DisplayMenuProps {
  readonly wrapCells: boolean;
  readonly onWrapCellsChange: (wrapCells: boolean) => void;
  readonly isFullscreen: boolean;
  readonly onFullscreenToggle: () => void;
  /** Absent where the table does not apply column widths: no resizing, or the card view */
  readonly onFitColumns?: () => void;
}

export function DisplayMenu({
  wrapCells,
  onWrapCellsChange,
  isFullscreen,
  onFullscreenToggle,
  onFitColumns,
}: Readonly<DisplayMenuProps>) {
  const labels = useLabels();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  // Read only while the menu is open, so a server render never touches `document`.
  const canFullscreen = anchorEl !== null && document.fullscreenEnabled;

  const run = (action: () => void) => {
    action();
    setAnchorEl(null);
  };

  return (
    <>
      <ToolbarIconButton label={labels.display} onClick={(e) => setAnchorEl(e.currentTarget)}>
        <DisplaySettingsIcon sx={{fontSize: {xs: '1.25rem', sm: '1.5rem'}}} />
      </ToolbarIconButton>

      <AnchoredMenu anchorEl={anchorEl} onClose={() => setAnchorEl(null)} paperSx={{minWidth: 200, mt: 0.5}}>
        <MenuItem
          role="menuitemcheckbox"
          aria-checked={wrapCells}
          onClick={() => run(() => onWrapCellsChange(!wrapCells))}
        >
          <ListItemIcon>
            <WrapTextIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{labels.wrapCells}</ListItemText>
          {wrapCells && <CheckIcon fontSize="small" sx={{ml: 2, color: 'primary.main'}} />}
        </MenuItem>
        {canFullscreen && (
          <MenuItem onClick={() => run(onFullscreenToggle)}>
            <ListItemIcon>
              {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
            </ListItemIcon>
            <ListItemText>{isFullscreen ? labels.exitFullscreen : labels.fullscreen}</ListItemText>
          </MenuItem>
        )}
        {onFitColumns && (
          <MenuItem onClick={() => run(onFitColumns)}>
            <ListItemIcon>
              <WidthWideIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{labels.fitColumns}</ListItemText>
          </MenuItem>
        )}
      </AnchoredMenu>
    </>
  );
}
