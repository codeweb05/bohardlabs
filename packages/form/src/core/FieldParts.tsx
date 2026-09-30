import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type {ReactNode} from 'react';

import {FieldShell} from './FieldShell.js';
import type {FieldShellProps} from './FieldShell.js';

/**
 * `FieldShell`'s fieldset with its parts side by side, wrapping when they don't fit: the
 * field's label is the legend, and each `FieldPart` below it has its own caption.
 * DurationField's hours and minutes, DateRangeField's start and end.
 */
export function FieldParts({children, ...shell}: Readonly<Omit<FieldShellProps, 'as'>>) {
  return (
    <FieldShell {...shell} as="fieldset">
      <Box sx={{display: 'flex', gap: 1, flexWrap: 'wrap'}}>{children}</Box>
    </FieldShell>
  );
}

interface FieldPartProps {
  /** Put on the caption; the part's control points `aria-labelledby` at it. */
  readonly captionId: string;
  readonly caption: string;
  /** Below this width the parts wrap onto separate lines. */
  readonly minWidth?: number;
  readonly children: ReactNode;
}

/** One captioned part of a `FieldParts` row. */
export function FieldPart({captionId, caption, minWidth, children}: Readonly<FieldPartProps>) {
  return (
    <Box sx={{flex: 1, minWidth}}>
      <Typography id={captionId} variant="caption" sx={{color: 'text.secondary'}}>
        {caption}
      </Typography>
      {children}
    </Box>
  );
}
