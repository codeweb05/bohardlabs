import Dialog from '@mui/material/Dialog';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {useId} from 'react';

import type {ImageEditorProps} from '../types';
import {EditorSession} from './EditorSession';
import {LabelsProvider} from './LabelsContext';

/**
 * A dialog that crops, rotates, flips and adjusts one image and hands back a `File` that
 * fits `output`. Open and close it through `open`; every edit is discarded on close.
 */
export function ImageEditor({open, labels, ...props}: Readonly<ImageEditorProps>) {
  const titleId = useId();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <LabelsProvider labels={labels}>
      <Dialog open={open} onClose={props.onClose} maxWidth="md" fullWidth fullScreen={mobile} aria-labelledby={titleId}>
        {open && <EditorSession {...props} titleId={titleId} mobile={mobile} />}
      </Dialog>
    </LabelsProvider>
  );
}
