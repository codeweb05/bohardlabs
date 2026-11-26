import AddAPhotoOutlinedIcon from '@mui/icons-material/AddAPhotoOutlined';
import CachedIcon from '@mui/icons-material/Cached';
import CloseIcon from '@mui/icons-material/Close';
import CropIcon from '@mui/icons-material/Crop';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import {alpha} from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import {useStore} from '@tanstack/react-form';
import {useEffect, useRef, useState} from 'react';
import type {CSSProperties, DragEvent} from 'react';

import {useFieldSize, useFormConfig} from '../config/FormConfigContext.js';
import type {FormLabels} from '../config/labels.js';
import {useFieldContext} from '../context.js';
import {FieldShell} from '../core/FieldShell.js';
import type {CommonFieldProps} from '../core/types.js';
import {useFieldBinding} from '../core/useFieldBinding.js';
import {NULLABLE_FILES} from '../core/valueChecks.js';

export interface FileFieldProps extends CommonFieldProps {
  /**
   * `file` (default): a drop zone with a button, and the chosen file listed by name and size.
   * `photo`: a square button, then a preview of the chosen image.
   */
  readonly variant?: 'file' | 'photo';
  /**
   * What the picker offers and what a chosen or dropped file is checked against, in the
   * `<input accept>` format: `image/*`, `.pdf,image/png`. Default `image/*` for the photo
   * variant, anything for `file`. A file that does not match is refused with `fileWrongType`.
   */
  readonly accept?: string;
  /** The largest file kept, in bytes. A larger one is refused with `fileTooLarge`. */
  readonly maxBytes?: number;
  /**
   * File variant only: the value becomes `File[]` and each choice or drop adds to it. The
   * photo variant always holds one `File`.
   */
  readonly multiple?: boolean;
  /**
   * Photo variant only. Shows an Edit button on the preview that calls this with the current
   * file. Resolve the edited file to keep it, or `null` to keep the current one. The edited
   * file is checked against `accept` and `maxBytes` like a chosen one. This is where an image
   * editor such as `@vt-labs/image-editor` plugs in.
   */
  readonly onEdit?: (file: File) => Promise<File | null>;
}

/** What the field holds: one file, a list with `multiple`, or nothing yet. */
type FileValue = File | File[] | null;

const PHOTO_SIZE = 180;

/** Off screen but still in the accessibility tree, so the field's label names it. */
const VISUALLY_HIDDEN: CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: 0,
  border: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
};

const PREVIEW_IMAGE: CSSProperties = {display: 'block', width: '100%', height: '100%', objectFit: 'cover'};

function toFiles(value: unknown): File[] {
  if (value instanceof File) return [value];
  if (Array.isArray(value)) return value.filter((item): item is File => item instanceof File);
  return [];
}

function accepts(file: File, accept: string | undefined): boolean {
  if (!accept?.trim()) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept.split(',').some((raw) => {
    const token = raw.trim().toLowerCase();
    if (token === '') return false;
    if (token.startsWith('.')) return name.endsWith(token);
    if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1));
    return type === token;
  });
}

function problemWith(file: File, accept: string | undefined, maxBytes: number | undefined, labels: FormLabels) {
  if (!accepts(file, accept)) return labels.fileWrongType(file.name);
  if (maxBytes !== undefined && file.size > maxBytes) {
    return labels.fileTooLarge(file.name, labels.fileSize(file.size), labels.fileSize(maxBytes));
  }
  return null;
}

/** The object URL lives exactly as long as this file is on screen, and is revoked after. */
function PhotoImage({file}: Readonly<{file: File}>) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    /* v8 ignore start: the ref is attached before any effect runs */
    if (ref.current) ref.current.src = url;
    /* v8 ignore stop */
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <img ref={ref} alt={file.name} style={PREVIEW_IMAGE} />;
}

/**
 * A file or a photo, held in the form as a `File` (or `File[]` with `multiple`). The user
 * chooses or drops it; `accept` and `maxBytes` are checked on the way in, and a refused file
 * never reaches the value. The field never uploads: send the file in your submit handler.
 */
export function FileField({
  label,
  description,
  required,
  tooltip,
  disabled,
  autoFocus,
  size,
  variant = 'file',
  accept,
  maxBytes,
  multiple = false,
  onEdit,
}: Readonly<FileFieldProps>) {
  const {labels} = useFormConfig();
  const fieldSize = useFieldSize(size);
  const field = useFieldContext<FileValue>();
  const binding = useFieldBinding<FileValue>({required, expect: NULLABLE_FILES});
  const isTouched = useStore(field.store, (state) => state.meta.isTouched);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const isPhoto = variant === 'photo';
  const isList = multiple && !isPhoto;
  const allowed = accept ?? (isPhoto ? 'image/*' : undefined);
  const files = toFiles(binding.value);
  const current = files[0] ?? null;

  // A refused file belongs to the value it was refused against. A value set from outside the
  // field (a load) clears the message, and so does a reset, which leaves the field untouched.
  const [held, setHeld] = useState<{source: unknown; message: string | null}>({
    source: binding.value,
    message: null,
  });
  let refusal = held.message;
  if (held.source !== binding.value || (!isTouched && refusal !== null)) {
    refusal = null;
    setHeld({source: binding.value, message: null});
  }
  const error = refusal ?? binding.error;

  const write = (next: FileValue, message: string | null) => {
    // Touched first, so the render that shows the message never mistakes it for a reset.
    if (message !== null) field.setMeta((meta) => ({...meta, isTouched: true}));
    const changed = next !== binding.value;
    setHeld({source: changed ? next : binding.value, message});
    if (changed) binding.setValue(next);
  };

  const take = (incoming: readonly File[]) => {
    if (incoming.length === 0) return;
    const accepted: File[] = [];
    let message: string | null = null;
    for (const file of isList ? incoming : incoming.slice(0, 1)) {
      const problem = problemWith(file, allowed, maxBytes, labels);
      if (problem === null) accepted.push(file);
      else message ??= problem;
    }
    if (accepted.length === 0) write(binding.value, message);
    /* v8 ignore start: `accepted` is not empty here, so `accepted[0]` is never undefined */
    else write(isList ? [...files, ...accepted] : (accepted[0] ?? null), message);
    /* v8 ignore stop */
  };

  const remove = (index: number) => write(isList ? files.filter((_, at) => at !== index) : null, null);

  /* v8 ignore start: the input renders beside every button that calls this, so the ref is always attached */
  const choose = () => inputRef.current?.click();
  /* v8 ignore stop */

  const edit = async (file: File) => {
    const edited = await onEdit?.(file);
    if (edited) take([edited]);
  };

  // The button that opens the picker carries the field's aria wiring and takes focus first.
  const primary = {
    'aria-describedby': binding.inputProps['aria-describedby'],
    'aria-invalid': error !== null,
    'data-form-id': binding.formId,
    autoFocus,
    disabled,
    onBlur: binding.onBlur,
    onClick: choose,
  };

  const outline = () => {
    if (dragging) return 'primary.main';
    return error === null ? 'text.disabled' : 'error.main';
  };

  const dropHandlers = {
    onDragOver: (event: DragEvent) => {
      if (disabled) return;
      event.preventDefault();
      setDragging(true);
    },
    onDragLeave: (event: DragEvent) => {
      const into = event.relatedTarget;
      if (into instanceof Node && event.currentTarget.contains(into)) return;
      setDragging(false);
    },
    onDrop: (event: DragEvent) => {
      if (disabled) return;
      event.preventDefault();
      setDragging(false);
      take(Array.from(event.dataTransfer.files));
    },
  };

  const dropZone = (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 1.5,
        p: fieldSize === 'small' ? 1 : 1.75,
        border: 1,
        borderStyle: 'dashed',
        borderColor: outline(),
        borderRadius: 1,
      }}
    >
      <Button variant="outlined" size={fieldSize} startIcon={<FileUploadOutlinedIcon />} {...primary}>
        {labels.chooseFile}
      </Button>
      <Typography variant="body2" sx={{color: 'text.secondary'}}>
        {labels.dropFile}
      </Typography>
    </Box>
  );

  const fileRow = (file: File, index: number) => (
    <Box
      key={`${index}-${file.name}`}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: fieldSize === 'small' ? 0.5 : 1,
        pl: 1.75,
        pr: 1,
        border: 1,
        borderColor: dragging && !isList ? 'primary.main' : 'divider',
        borderRadius: 1,
      }}
    >
      <InsertDriveFileOutlinedIcon sx={{color: 'action.active'}} />
      <Box sx={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column'}}>
        <Typography variant="body2" noWrap>
          {file.name}
        </Typography>
        <Typography variant="caption" sx={{color: 'text.secondary'}}>
          {labels.fileSize(file.size)}
        </Typography>
      </Box>
      {isList ? null : (
        <Button size={fieldSize} {...primary}>
          {labels.replaceFile}
        </Button>
      )}
      <IconButton
        aria-label={labels.removeFile(file.name)}
        size={fieldSize}
        disabled={disabled}
        onClick={() => remove(index)}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );

  const overlayButton = {size: 'small', disabled, sx: {color: 'common.white'}} as const;

  const photo =
    current === null ? (
      <Button
        variant="outlined"
        color="inherit"
        size={fieldSize}
        {...primary}
        sx={{
          width: PHOTO_SIZE,
          height: PHOTO_SIZE,
          flexDirection: 'column',
          gap: 1,
          borderStyle: 'dashed',
          borderColor: outline(),
          borderRadius: 2,
          color: 'text.secondary',
          bgcolor: 'action.hover',
        }}
      >
        <AddAPhotoOutlinedIcon fontSize="large" />
        {labels.choosePhoto}
      </Button>
    ) : (
      <Box>
        <Box
          sx={{
            position: 'relative',
            width: PHOTO_SIZE,
            height: PHOTO_SIZE,
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: 'action.hover',
            outline: (theme) => (dragging ? `2px solid ${theme.palette.primary.main}` : 'none'),
          }}
        >
          <PhotoImage file={current} />
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 0.5,
              p: 0.75,
              bgcolor: (theme) => alpha(theme.palette.common.black, 0.55),
            }}
          >
            {onEdit ? (
              <IconButton aria-label={labels.editPhoto} {...overlayButton} onClick={() => void edit(current)}>
                <CropIcon fontSize="small" />
              </IconButton>
            ) : null}
            <IconButton aria-label={labels.replacePhoto} {...overlayButton} {...primary}>
              <CachedIcon fontSize="small" />
            </IconButton>
            <IconButton aria-label={labels.removePhoto} {...overlayButton} onClick={() => remove(0)}>
              <DeleteOutlinedIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        <Typography variant="caption" sx={{display: 'block', mt: 0.5, color: 'text.secondary'}}>
          {current.name} · {labels.fileSize(current.size)}
        </Typography>
      </Box>
    );

  const body = () => {
    if (isPhoto) return photo;
    if (!isList) return current === null ? dropZone : fileRow(current, 0);
    return (
      <Box sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
        {files.map(fileRow)}
        {dropZone}
      </Box>
    );
  };

  return (
    <FieldShell
      binding={{...binding, error}}
      label={label}
      description={description}
      required={required}
      tooltip={tooltip}
      disabled={disabled}
    >
      <Box sx={{position: 'relative'}} {...dropHandlers}>
        <input
          ref={inputRef}
          id={binding.inputId}
          type="file"
          tabIndex={-1}
          accept={allowed}
          multiple={isList}
          disabled={disabled}
          style={VISUALLY_HIDDEN}
          onChange={(event) => {
            /* v8 ignore start: a file input's `files` is never null */
            take(Array.from(event.target.files ?? []));
            /* v8 ignore stop */
            // Cleared so choosing the same file again still fires a change.
            event.target.value = '';
          }}
        />
        {body()}
      </Box>
    </FieldShell>
  );
}
