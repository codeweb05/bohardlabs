import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import {useEffect, useId, useReducer, useRef, useState, type ReactNode} from 'react';

import {EditorError} from '../errors.js';
import {resolveFeatures, type ResolvedFeatures} from '../features.js';
import {DEFAULT_ACCEPT, type LoadedImage} from '../input/loadSource.js';
import type {ImageEditorLabels} from '../labels.js';
import {exportImage} from '../output/exportImage.js';
import {filterString, supportsCanvasFilter} from '../output/filters.js';
import {
  currentZoom,
  editorReducer,
  initialEditorState,
  sameState,
  type EditorAction,
  type EditorState,
} from '../state/editorState.js';
import {createHistory, historyReducer} from '../state/history.js';
import type {ImageEditorProps} from '../types.js';
import {AdjustControls} from './AdjustControls.js';
import {CanvasArea, STAGE_MIN_HEIGHT, visuallyHidden} from './CanvasArea.js';
import {CropControls, type CropControlsProps} from './CropControls.js';
import {HistoryButtons} from './HistoryButtons.js';
import {errorMessage, useLabels} from './LabelsContext.js';
import {MobileToolbar} from './MobileToolbar.js';
import {FileButton, Picker} from './Picker.js';
import {useLoadedImage} from './useLoadedImage.js';

const reducer = historyReducer(editorReducer, sameState);

/** What the live region says after an action, given the state it produced. */
function describe(labels: ImageEditorLabels, action: EditorAction, next: EditorState): string | null {
  /* v8 ignore start -- 'setCrop' and 'straighten' only arrive mid-gesture, which is never described */
  switch (action.type) {
    /* v8 ignore stop */
    case 'rotate':
      return labels.rotated(action.direction * 90);
    case 'flip':
      return labels.flipped;
    case 'setCrop':
    case 'moveCrop':
    case 'resizeCrop':
    case 'setRatio':
      return labels.cropChanged(Math.round(next.crop.width), Math.round(next.crop.height));
    case 'zoomBy':
    case 'zoomTo':
      return labels.zoomChanged(Math.round(currentZoom(next) * 100));
    // Slider-only: each control announces its own value where the gesture ends.
    case 'straighten':
    case 'adjust':
      return null;
    case 'replace':
      return labels.resetDone;
  }
}

type SessionProps = Omit<ImageEditorProps, 'labels'> & {readonly titleId: string; readonly mobile: boolean};

function Header({titleId, onClose, actions}: Readonly<{titleId: string; onClose: () => void; actions?: ReactNode}>) {
  const labels = useLabels();
  return (
    <Box sx={{display: 'flex', alignItems: 'center', pr: 1}}>
      <DialogTitle id={titleId} sx={{flex: 1}}>
        {labels.title}
      </DialogTitle>
      {actions}
      <IconButton aria-label={labels.close} onClick={onClose}>
        <CloseIcon />
      </IconButton>
    </Box>
  );
}

/** Below `sm`: Cancel, the title and the apply button across the top, and no footer. */
function MobileHeader({
  titleId,
  onClose,
  children,
}: Readonly<{titleId: string; onClose: () => void; children: ReactNode}>) {
  const labels = useLabels();
  return (
    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 1, borderBottom: 1, borderColor: 'divider'}}>
      <Button onClick={onClose}>{labels.cancel}</Button>
      <DialogTitle id={titleId} variant="subtitle1" sx={{flex: 1, p: 0, textAlign: 'center'}}>
        {labels.title}
      </DialogTitle>
      {children}
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

type DockProps = Omit<CropControlsProps, 'transforms'> & {readonly mobile: boolean};

/** The tools under the canvas: the Crop row, or tabs for Crop and Adjust. */
function Dock({mobile, ...props}: Readonly<DockProps>) {
  const labels = useLabels();
  const id = useId();
  const [tab, setTab] = useState<'crop' | 'adjust'>('crop');
  // Where the canvas cannot filter, an adjustment would preview but not export. Hidden instead.
  const adjust = props.features.adjust && supportsCanvasFilter() ? props.features.adjust : false;
  const crop = <CropControls {...props} transforms={!mobile} />;
  if (!adjust) return crop;

  return (
    <>
      <Tabs value={tab} onChange={(_event, value: 'crop' | 'adjust') => setTab(value)} sx={{mt: 1}}>
        <Tab value="crop" label={labels.cropTab} id={`${id}-crop`} aria-controls={`${id}-panel`} />
        <Tab value="adjust" label={labels.adjustTab} id={`${id}-adjust`} aria-controls={`${id}-panel`} />
      </Tabs>
      <Box role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`}>
        {tab === 'adjust' ? (
          <AdjustControls
            adjust={props.state.adjust}
            tools={adjust}
            onAction={props.onAction}
            onCommit={props.onCommit}
            disabled={props.disabled}
          />
        ) : (
          crop
        )}
      </Box>
    </>
  );
}

/**
 * A column, so the stage gives up height before the dialog has to scroll, and a positioned
 * one, so the hidden live region scrolls with the content instead of hanging off the dialog.
 */
const content = {display: 'flex', flexDirection: 'column', position: 'relative'} as const;

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
  open,
  titleId,
  mobile,
}: Readonly<WorkspaceProps>) {
  const labels = useLabels();
  const [initial] = useState(() => initialEditorState({width: image.width, height: image.height}, features));
  const [history, dispatch] = useReducer(reducer, initial, createHistory);
  const state = history.present;
  const [applying, setApplying] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // A live region is read when its content changes, so saying the same thing twice in a row
  // (two flips) would be silent the second time. Each announcement gets its own node instead.
  const [announcement, setAnnouncement] = useState({text: '', turn: 0});
  const announce = (text: string) => setAnnouncement((last) => ({text, turn: last.turn + 1}));
  // State updates are not synchronous, so a second click in the same frame would still
  // see `applying` false. The ref is what makes Apply run once.
  const busy = useRef(false);
  // False once the editor is closed, which is before it is gone: the session stays mounted
  // while the dialog fades out, and nothing may reach the consumer after they closed it.
  const wanted = useRef(open);
  useEffect(() => {
    wanted.current = open;
    return () => {
      wanted.current = false;
    };
  }, [open]);

  const say = (action: EditorAction, next: EditorState) => {
    const message = describe(labels, action, next);
    if (message) announce(message);
  };
  const onAction = (action: EditorAction, options?: {transient?: boolean}) => {
    if (!features.zoom && (action.type === 'zoomBy' || action.type === 'zoomTo')) return;
    dispatch({type: 'apply', action, transient: options?.transient});
    // A gesture is announced once, where it ends; a single step is announced as it lands.
    if (!options?.transient) say(action, editorReducer(state, action));
  };
  const onCommit = () => dispatch({type: 'commit'});
  const onHoldEnd = (action: EditorAction) => {
    onCommit();
    say(action, state);
  };
  const canUndo = history.past.length > 0 || history.pending !== null;
  const canRedo = history.future.length > 0;
  const undo = () => {
    if (!canUndo) return;
    dispatch({type: 'undo'});
    announce(labels.undone);
  };
  const redo = () => {
    if (!canRedo) return;
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
        if (!wanted.current) return null;
        setFailure(errorMessage(labels, error.code));
        onError?.({code: error.code});
        return null;
      });
      // Closed while exporting: the consumer has moved on, so the file goes nowhere.
      if (result && wanted.current) await onApply(result);
    } catch {
      if (wanted.current) setFailure(labels.applyFailed);
    } finally {
      busy.current = false;
      if (wanted.current) setApplying(false);
    }
  };

  const canReset = !applying && !sameState(state, initial);
  const reset = () => onAction({type: 'replace', state: initial});

  const canvas = (
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
      onHoldEnd={onHoldEnd}
    />
  );
  const dock = (
    <Dock
      state={state}
      features={features}
      onAction={onAction}
      onCommit={onCommit}
      announce={announce}
      disabled={applying}
      mobile={mobile}
    />
  );
  const replace = features.replace && (
    <FileButton
      accept={input?.accept ?? DEFAULT_ACCEPT}
      label={labels.replace}
      onPick={onPick}
      variant="text"
      disabled={applying}
    />
  );
  const live = (
    <>
      <Box role="status" aria-live="polite" sx={visuallyHidden}>
        {announcement.text && <span key={announcement.turn}>{announcement.text}</span>}
      </Box>
      {failure && (
        <Alert severity="error" sx={{mb: 1}}>
          {failure}
        </Alert>
      )}
    </>
  );
  if (mobile) {
    return (
      <>
        <MobileHeader titleId={titleId} onClose={onClose}>
          <Button variant="contained" disabled={applying} onClick={apply}>
            {applying ? labels.applying : labels.done}
          </Button>
        </MobileHeader>
        <DialogContent sx={{...content, px: 2, pt: 2, pb: 1}}>
          <Box sx={{position: 'relative', display: 'flex', flexDirection: 'column', minHeight: STAGE_MIN_HEIGHT}}>
            {canvas}
            <MobileToolbar
              features={features}
              onAction={onAction}
              onUndo={canUndo ? undo : null}
              onReset={canReset ? reset : null}
              disabled={applying}
            />
          </Box>
          <Box sx={{mt: 'auto'}}>
            {dock}
            {replace}
            {live}
          </Box>
        </DialogContent>
      </>
    );
  }

  return (
    <>
      <Header
        titleId={titleId}
        onClose={onClose}
        actions={features.history && <HistoryButtons onUndo={canUndo ? undo : null} onRedo={canRedo ? redo : null} />}
      />
      <DialogContent sx={{...content, px: 3, pb: 0}}>
        {canvas}
        {dock}
        {live}
      </DialogContent>
      <Footer
        start={
          <>
            <Button disabled={!canReset} onClick={reset}>
              {labels.reset}
            </Button>
            {replace}
          </>
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
