import {TextField, Tooltip} from '@mui/material';
import {useEffect, useRef} from 'react';

interface EditTextFieldProps {
  readonly value: string | number;
  readonly onChange: (value: string | number) => void;
  readonly type?: 'text' | 'number';
  readonly disabled?: boolean;
  readonly error?: string;
  readonly placeholder?: string;
  readonly autoFocus?: boolean;
}

export function EditTextField({
  value,
  onChange,
  type = 'text',
  disabled = false,
  error,
  placeholder,
  autoFocus = true,
}: Readonly<EditTextFieldProps>) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (type === 'number') {
      onChange(newValue === '' ? '' : Number(newValue));
    } else {
      onChange(newValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent row click events from triggering
    e.stopPropagation();
  };

  const textField = (
    <TextField
      inputRef={inputRef}
      size="small"
      fullWidth
      type={type}
      value={value ?? ''}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      disabled={disabled}
      error={Boolean(error)}
      placeholder={placeholder}
      sx={{
        '& .MuiInputBase-input': {
          fontSize: '0.8125rem',
          py: 0.5,
          px: 1,
        },
        '& .MuiOutlinedInput-root': {
          '& fieldset': {
            borderColor: error ? 'error.main' : undefined,
          },
        },
      }}
    />
  );

  if (error) {
    return (
      <Tooltip title={error} placement="top" arrow>
        {textField}
      </Tooltip>
    );
  }

  return textField;
}
