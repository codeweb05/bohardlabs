import FlipIcon from '@mui/icons-material/Flip';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import type {ReactNode} from 'react';

import {parseRatio, type ResolvedFeatures} from '../features';
import {currentZoom, type EditorAction, type EditorState} from '../state/editorState';
import {useLabels} from './LabelsContext';

export interface CropControlsProps {
  readonly state: EditorState;
  readonly features: ResolvedFeatures;
  readonly onAction: (action: EditorAction, options?: {transient?: boolean}) => void;
  readonly onCommit: () => void;
  readonly announce: (message: string) => void;
  readonly disabled: boolean;
}

const STRAIGHTEN_STEP = 0.5;

/** A rotation turns 4:3 into 3:4 in the frame; to the user it is still 4:3. */
function sameRatio(option: number | null, current: number | null): boolean {
  if (option === null || current === null) return option === current;
  return Math.abs(option - current) < 1e-3 || Math.abs(1 / option - current) < 1e-3;
}

function single(value: number | number[]): number {
  return Array.isArray(value) ? (value[0] ?? 0) : value;
}

/** The context row under the canvas on the Crop tab. Each tool shows only when enabled. */
export function CropControls({state, features, onAction, onCommit, announce, disabled}: Readonly<CropControlsProps>) {
  const labels = useLabels();
  const {crop, straighten, zoom, rotate, flip} = features;
  const ratios = crop.ratios.map((ratio) => ({ratio, value: parseRatio(ratio)}));
  const showRatios = crop.enabled && crop.shape === 'rect' && ratios.length > 1;
  const selected = ratios.findIndex(({value}) => sameRatio(value, state.ratio));

  const tool = (label: string, icon: ReactNode, action: EditorAction) => (
    <Tooltip title={label}>
      <span>
        <IconButton aria-label={label} disabled={disabled} onClick={() => onAction(action)}>
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );

  return (
    <Box sx={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 3, rowGap: 1.5, py: 1.5}}>
      {showRatios && (
        <ToggleButtonGroup
          size="small"
          exclusive
          aria-label={labels.ratio}
          disabled={disabled}
          value={selected < 0 ? null : String(selected)}
          onChange={(_event, index: string | null) => {
            const choice = index === null ? undefined : ratios[Number(index)];
            if (choice) onAction({type: 'setRatio', ratio: choice.value});
          }}
        >
          {ratios.map(({ratio}, index) => (
            <ToggleButton key={String(ratio)} value={String(index)} sx={{px: 1.5}}>
              {labels.ratioName(ratio)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      )}

      {straighten && (
        <Slider
          aria-label={labels.straighten}
          size="small"
          disabled={disabled}
          min={-straighten.range}
          max={straighten.range}
          step={STRAIGHTEN_STEP}
          marks={[{value: -straighten.range}, {value: 0}, {value: straighten.range}]}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => `${value}°`}
          value={state.straighten}
          onChange={(_event, value) => onAction({type: 'straighten', degrees: single(value)}, {transient: true})}
          onChangeCommitted={(_event, value) => {
            onCommit();
            announce(labels.straightened(single(value)));
          }}
          sx={{flex: '1 1 160px', minWidth: 120}}
        />
      )}

      {zoom && zoom.slider && (
        <Slider
          aria-label={labels.zoom}
          size="small"
          disabled={disabled}
          min={zoom.min}
          max={zoom.max}
          step={0.01}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
          value={currentZoom(state)}
          onChange={(_event, value) => onAction({type: 'zoomTo', zoom: single(value)}, {transient: true})}
          onChangeCommitted={(_event, value) => {
            onCommit();
            announce(labels.zoomChanged(Math.round(single(value) * 100)));
          }}
          sx={{flex: '1 1 160px', minWidth: 120}}
        />
      )}

      {(rotate || flip) && (
        <Box sx={{display: 'flex', gap: 0.5, ml: 'auto'}}>
          {rotate && tool(labels.rotateLeft, <RotateLeftIcon />, {type: 'rotate', direction: -1})}
          {rotate && tool(labels.rotateRight, <RotateRightIcon />, {type: 'rotate', direction: 1})}
          {flip && flip.horizontal && tool(labels.flipHorizontal, <FlipIcon />, {type: 'flip', axis: 'horizontal'})}
          {flip &&
            flip.vertical &&
            tool(labels.flipVertical, <FlipIcon sx={{transform: 'rotate(90deg)'}} />, {
              type: 'flip',
              axis: 'vertical',
            })}
        </Box>
      )}
    </Box>
  );
}
