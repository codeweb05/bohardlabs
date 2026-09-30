import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import {useEffect, useReducer, useRef, useState, type ReactNode} from 'react';

import {EditorError} from '../errors';
import {resolveFeatures, type ResolvedFeatures} from '../features';
import {DEFAULT_ACCEPT, type LoadedImage} from '../input/loadSource';
import {exportImage} from '../output/exportImage';
import {filterString} from '../output/filters';
import {editorReducer, initialEditorState, type EditorAction} from '../state/editorState';
import {createHistory, historyReducer} from '../state/history';
import type {ImageEditorProps} from '../types';
import {CanvasArea} from './CanvasArea';
import {errorMessage, useLabels} from './LabelsContext';
import {FileButton, Picker} from './Picker';
import {useLoadedImage} from './useLoadedImage';

const reducer = historyReducer(editorReducer);

type SessionProps = Omit<ImageEditorProps, 'open' | 'labels'> & {readonly titleId: string};

function Header({titleId, onClose}: Readonly<{titleId: string; onClose: () => void}>) {
  const labels = useLabels();
  return (
    <Box sx={{display: 'flex', alignItems: 'center', pr: 1}}>
      <DialogTitle id={titleId} sx={{flex: 1}}>
        {labels.title}
      </DialogTitle>
      <IconButton aria-label={labels.close} onClick={onClose}>
        <CloseIcon />
      </IconButton>
    </Box>
  );
}

function Footer({start, children}: Readonly<{start?: ReactNode; children: ReactNode}>) {
  return (
    <DialogActions sx={{px: 3, py: 2}}>
      <Box sx={{flex: 1}}>{start}</Box>
      {children}
    </DialogActions>
  );
}

/**
 * One open editor. Mounted only while the dialog is open, so closing discards every edit.
 * A file picked here replaces `source` until `source` itself changes.
 */
export function EditorSession(props: Readonly<SessionProps>) {
  const {source, input, onClose, onError, titleId} = props;
  const labels = useLabels();
  const features = resolveFeatures(props.features);
  const accept = input?.accept ?? DEFAULT_ACCEPT;

  const [picked, setPicked] = useState<File | null>(null);
  const [pickedFor, setPickedFor] = useState(source);
  if (pickedFor !== source) {
    setPickedFor(source);
    setPicked(null);
  }

  const working = picked ?? source;
  const load = useLoadedImage(working, input, onError);
  const canPick = features.replace || picked !== null || source === null;

  if (load.status === 'ready') {
    return <Workspace key={load.image.url} {...props} features={features} image={load.image} onPick={setPicked} />;
  }

  return (
    <>
      <Header titleId={titleId} onClose={onClose} />
      <DialogContent>
        {load.status === 'loading' && (
          <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 280}}>
            <CircularProgress aria-label={labels.loading} />
          </Box>
        )}
        {load.status === 'error' && (
          <Alert severity="error" sx={{mb: canPick ? 2 : 0}}>
            {errorMessage(labels, load.error.code)}
          </Alert>
        )}
        {(load.status === 'idle' || (load.status === 'error' && canPick)) && (
          <Picker accept={accept} onPick={setPicked} />
        )}
      </DialogContent>
      <Footer>
        <Button onClick={onClose}>{labels.cancel}</Button>
      </Footer>
    </>
  );
}

type WorkspaceProps = Omit<SessionProps, 'features'> & {
  readonly features: ResolvedFeatures;
  readonly image: LoadedImage;
  readonly onPick: (file: File) => void;
};

/** A loaded image and its edit history. Keyed by the image, so a new one starts clean. */
function Workspace({
  features,
  image,
  input,
  output,
  onApply,
  onClose,
  onError,
  onPick,
  titleId,
}: Readonly<WorkspaceProps>) {
  const labels = useLabels();
  const [history, dispatch] = useReducer(reducer, null, () =>
    createHistory(initialEditorState({width: image.width, height: image.height}, features)),
  );
  const state = history.present;
  const [applying, setApplying] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // State updates are not synchronous, so a second click in the same frame would still
  // see `applying` false. The ref is what makes Apply run once.
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const onAction = (action: EditorAction, options?: {transient?: boolean}) => {
    if (!features.zoom && (action.type === 'zoomBy' || action.type === 'zoomTo')) return;
    dispatch({type: 'apply', action, transient: options?.transient});
  };

  const apply = async () => {
    if (busy.current) return;
    busy.current = true;
    setApplying(true);
    setFailure(null);
    try {
      const result = await exportImage({
        image: image.image,
        state,
        shape: features.crop.shape,
        sourceType: image.type,
        output: output ?? {},
      }).catch((error: unknown) => {
        if (!(error instanceof EditorError)) throw error;
        setFailure(errorMessage(labels, error.code));
        onError?.({code: error.code});
        return null;
      });
      // Closed while exporting: the consumer has moved on, so the file goes nowhere.
      if (result && mounted.current) await onApply(result);
    } catch {
      if (mounted.current) setFailure(labels.applyFailed);
    } finally {
      busy.current = false;
      if (mounted.current) setApplying(false);
    }
  };

  return (
    <>
      <Header titleId={titleId} onClose={onClose} />
      <DialogContent sx={{px: 3, pb: 0}}>
        <CanvasArea
          src={image.url}
          state={state}
          shape={features.crop.shape}
          filter={filterString(state.adjust)}
          editable={features.crop.enabled}
          onAction={onAction}
          onCommit={() => dispatch({type: 'commit'})}
        />
        {failure && (
          <Alert severity="error" sx={{mt: 2}}>
            {failure}
          </Alert>
        )}
      </DialogContent>
      <Footer
        start={
          features.replace && (
            <FileButton
              accept={input?.accept ?? DEFAULT_ACCEPT}
              label={labels.replace}
              onPick={onPick}
              variant="text"
              disabled={applying}
            />
          )
        }
      >
        <Button onClick={onClose}>{labels.cancel}</Button>
        <Button variant="contained" disabled={applying} onClick={apply}>
          {applying ? labels.applying : labels.apply}
        </Button>
      </Footer>
    </>
  );
}
