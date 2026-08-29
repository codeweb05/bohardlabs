import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import {Box, IconButton, InputAdornment, TextField, Tooltip, Typography, alpha} from '@mui/material';
import {useEffect, useId, useRef, useState} from 'react';

import {useLabels} from '../i18n';

interface GlobalSearchProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly helperText?: string;
  readonly debounceMs?: number;
}

export function GlobalSearch({
  value,
  onChange,
  placeholder,
  helperText,
  debounceMs = 300,
}: Readonly<GlobalSearchProps>) {
  const labels = useLabels();
  const [localValue, setLocalValue] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const helperTextId = useId();
  const helperTextRef = useRef<HTMLElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  // Sync local value with external value using the "adjusting state during render" pattern.
  if (prevValue !== value) {
    setPrevValue(value);
    setLocalValue(value);
  }

  const checkOverflow = () => {
    const el = helperTextRef.current;
    if (el) {
      setIsOverflowing(el.scrollWidth > el.clientWidth);
    }
  };

  // Debounce the onChange callback
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localValue, value, onChange, debounceMs]);

  const handleClear = () => {
    setLocalValue('');
    onChange('');
  };

  return (
    <Box
      sx={{
        position: 'relative',
        minWidth: {xs: '100%', sm: 220},
        maxWidth: {xs: '100%', sm: 280},
      }}
    >
      <TextField
        size="small"
        fullWidth
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder ?? labels.globalSearch}
        sx={{
          '& .MuiOutlinedInput-root': {
            bgcolor: 'background.paper',
            '& fieldset': {
              borderColor: (theme) => theme.palette.divider,
            },
            '&:hover fieldset': {
              borderColor: (theme) => alpha(theme.palette.text.primary, 0.3),
            },
          },
          '& .MuiInputBase-input': {
            fontSize: '0.8125rem',
            py: 0.875,
          },
        }}
        slotProps={{
          // `TextField` forwards unknown props to the root `FormControl`, so
          // `aria-describedby` on the field itself lands on a wrapper div where no screen
          // reader looks for it. The helper text names the columns being searched, and
          // it only reaches the user from the input.
          htmlInput: {
            'aria-describedby': helperText ? helperTextId : undefined,
            // The field has no visible label, and a placeholder disappears as soon as
            // anything is typed, which leaves the input unnamed at exactly the point the
            // user might want to check what it searches.
            'aria-label': placeholder ?? labels.globalSearch,
          },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon
                  sx={{
                    fontSize: {xs: '1.125rem', sm: '1.25rem'},
                    color: 'text.secondary',
                  }}
                />
              </InputAdornment>
            ),
            endAdornment: localValue ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={handleClear}
                  edge="end"
                  aria-label={labels.clearSearch}
                  sx={{mr: -0.5}}
                >
                  <ClearIcon sx={{fontSize: '1rem'}} />
                </IconButton>
              </InputAdornment>
            ) : null,
          },
        }}
      />
      {helperText && (
        <Tooltip title={isOverflowing ? helperText : ''} placement="bottom-start">
          <Typography
            ref={helperTextRef}
            id={helperTextId}
            variant="caption"
            onMouseEnter={checkOverflow}
            sx={{
              display: 'block',
              position: {xs: 'static', sm: 'absolute'},
              top: {sm: 'calc(100% + 2px)'},
              left: {sm: 4},
              right: {sm: 0},
              mt: {xs: 0.5, sm: 0},
              px: 0.5,
              fontSize: '0.6875rem',
              color: 'text.secondary',
              whiteSpace: {xs: 'normal', sm: 'nowrap'},
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              pointerEvents: 'auto',
              lineHeight: 1.5,
            }}
          >
            {helperText}
          </Typography>
        </Tooltip>
      )}
    </Box>
  );
}
