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
import type {ImageEditorLabels} from '../labels';
import {exportImage} from '../output/exportImage';
import {filterString} from '../output/filters';
import {
  currentZoom,
  editorReducer,
  initialEditorState,
  type EditorAction,
  type EditorState,
} from '../state/editorState';
import {createHistory, historyReducer} from '../state/history';
import type {ImageEditorProps} from '../types';
import {CanvasArea, visuallyHidden} from './CanvasArea';
import {CropControls} from './CropControls';
import {errorMessage, useLabels} from './LabelsContext';
import {FileButton, Picker} from './Picker';
import {useLoadedImage} from './useLoadedImage';

const reducer = historyReducer(editorReducer);

/** What the live region says after an action, given the state it produced. */
function describe(labels: ImageEditorLabels, action: EditorAction, next: EditorState): string | null {
  switch (action.type) {
    case 'rotate':
      return labels.rotated(action.direction * 90);
    case 'flip':
      return labels.flipped;
    case 'straighten':
      return labels.straightened(action.degrees);
    case 'setCrop':
    case 'moveCrop':
    case 'resizeCrop':
    case 'setRatio':
      return labels.cropChanged(Math.round(next.crop.width), Math.round(next.crop.height));
    case 'zoomBy':
    case 'zoomTo':
      return labels.zoomChanged(Math.round(currentZoom(next) * 100));
    case 'adjust':
    case 'replace':
      return null;
  }
}

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
  const [announcement, announce] = useState('');
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
    // A gesture is announced once, where it ends; a single step is announced as it lands.
    if (options?.transient) return;
    const message = describe(labels, action, editorReducer(state, action));
    if (message) announce(message);
  };
  const onCommit = () => dispatch({type: 'commit'});
  const undo = () => {
    if (history.past.length === 0 && history.pending === null) return;
    dispatch({type: 'undo'});
    announce(labels.undone);
  };
  const redo = () => {
    if (history.future.length === 0) return;
    dispatch({type: 'redo'});
    announce(labels.redone);
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
          features={features}
          onAction={onAction}
          onCommit={onCommit}
          onUndo={features.history ? undo : null}
          onRedo={features.history ? redo : null}
        />
        <CropControls
          state={state}
          features={features}
          onAction={onAction}
          onCommit={onCommit}
          announce={announce}
          disabled={applying}
        />
        <Box role="status" aria-live="polite" sx={visuallyHidden}>
          {announcement}
        </Box>
        {failure && (
          <Alert severity="error" sx={{mb: 1}}>
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
