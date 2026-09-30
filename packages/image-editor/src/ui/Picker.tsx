import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import Box from '@mui/material/Box';
import Button, {type ButtonProps} from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import {useRef, useState, type ChangeEvent, type DragEvent} from 'react';

import {useLabels} from './LabelsContext';

interface FileButtonProps {
  readonly accept: readonly string[];
  readonly label: string;
  readonly onPick: (file: File) => void;
  readonly variant?: ButtonProps['variant'];
  readonly disabled?: boolean;
}

/**
 * A button that opens the file dialog. The input is hidden and clicked for the button, so
 * the control keyboard users reach is a real button; the input carries the same name for
 * anything that needs to set files on it directly.
 */
export function FileButton({accept, label, onPick, variant = 'outlined', disabled}: Readonly<FileButtonProps>) {
  const input = useRef<HTMLInputElement>(null);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared so that choosing the same file again still fires a change.
    event.target.value = '';
    if (file) onPick(file);
  };

  return (
    <>
      <Button variant={variant} disabled={disabled} onClick={() => input.current?.click()}>
        {label}
      </Button>
      <input ref={input} hidden type="file" accept={accept.join(',')} aria-label={label} onChange={onChange} />
    </>
  );
}

interface PickerProps {
  readonly accept: readonly string[];
  readonly onPick: (file: File) => void;
}

/** The drop zone shown when there is no source, or when a picked file failed. */
export function Picker({accept, onPick}: Readonly<PickerProps>) {
  const labels = useLabels();
  const [over, setOver] = useState(false);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    const file = event.dataTransfer.files[0];
    if (file) onPick(file);
  };

  return (
    <Box
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        minHeight: 280,
        p: 3,
        border: 2,
        borderStyle: 'dashed',
        borderRadius: 1,
        borderColor: over ? 'primary.main' : 'divider',
        bgcolor: over ? 'action.hover' : 'transparent',
      }}
    >
      <AddPhotoAlternateOutlinedIcon fontSize="large" sx={{color: 'text.secondary'}} />
      <Typography color="text.secondary">{labels.pickerPrompt}</Typography>
      <FileButton accept={accept} label={labels.pickerChoose} onPick={onPick} variant="contained" />
    </Box>
  );
}
