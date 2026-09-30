import Dialog from '@mui/material/Dialog';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {useId, useState} from 'react';

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
  // The session outlives `open` until the exit transition ends, so the dialog does not fade
  // out empty and nameless. Each opening gets its own key, so reopening mid-fade starts clean.
  const [shown, setShown] = useState({open, present: open, round: 0});
  if (shown.open !== open) {
    setShown(open ? {open, present: true, round: shown.round + 1} : {...shown, open});
  }

  return (
    <LabelsProvider labels={labels}>
      <Dialog
        open={open}
        onClose={props.onClose}
        maxWidth="md"
        fullWidth
        fullScreen={mobile}
        aria-labelledby={titleId}
        slotProps={{transition: {onExited: () => setShown((current) => ({...current, present: current.open}))}}}
      >
        {shown.present && <EditorSession key={shown.round} {...props} titleId={titleId} mobile={mobile} />}
      </Dialog>
    </LabelsProvider>
  );
}
