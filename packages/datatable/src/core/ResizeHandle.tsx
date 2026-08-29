import {Box} from '@mui/material';

import {useLabels} from '../i18n';

/** How much one arrow-key press moves the edge, and how much it moves with Shift held. */
const KEYBOARD_STEP = 8;
const KEYBOARD_STEP_LARGE = 32;

interface ResizeHandleProps {
  readonly isResizing: boolean;
  readonly onMouseDown: (e: React.MouseEvent) => void;
  readonly onTouchStart: (e: React.TouchEvent) => void;
  readonly onDoubleClick: () => void;
  /** Applies a width delta in px. Wired to the arrow keys; without it the handle is pointer-only. */
  readonly onResizeBy?: (delta: number) => void;
  /** Current width and the permitted range, announced as the splitter's value. */
  readonly width?: number;
  readonly minWidth?: number;
  readonly maxWidth?: number;
}

export function ResizeHandle({
  isResizing,
  onMouseDown,
  onTouchStart,
  onDoubleClick,
  onResizeBy,
  width,
  minWidth,
  maxWidth,
}: ResizeHandleProps) {
  const labels = useLabels();

  // A focusable separator is the window-splitter pattern: arrows move the edge, Home
  // puts it back to the column's own width. Without this the only way to resize a column
  // is a drag, and the only way to reset one is a double-click, so a keyboard user has
  // neither.
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Home') {
      event.preventDefault();
      onDoubleClick();
      return;
    }

    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();

    const step = event.shiftKey ? KEYBOARD_STEP_LARGE : KEYBOARD_STEP;
    onResizeBy?.(event.key === 'ArrowLeft' ? -step : step);
  };

  return (
    <Box
      role="separator"
      aria-orientation="vertical"
      aria-label={labels.resizeColumn}
      aria-valuenow={width}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      tabIndex={0}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onDoubleClick={onDoubleClick}
      onKeyDown={handleKeyDown}
      sx={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 8,
        height: '100%',
        cursor: 'col-resize',
        userSelect: 'none',
        touchAction: 'none',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        '&::after': {
          content: '""',
          width: 2,
          height: '60%',
          bgcolor: isResizing ? 'primary.main' : 'divider',
          borderRadius: 1,
          transition: 'background-color 0.15s ease',
        },
        '&:hover::after': {
          bgcolor: 'primary.main',
        },
        '&:focus-visible': {
          outline: (theme) => `2px solid ${theme.palette.primary.main}`,
          outlineOffset: -1,
        },
      }}
    />
  );
}
