import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import {useState} from 'react';

import type {ResolvedFeatures} from '../features.js';
import {PRESETS, presetOf, type PresetId} from '../output/filters.js';
import type {Adjustments, EditorAction} from '../state/editorState.js';
import {useLabels} from './LabelsContext.js';

type Value = keyof Adjustments;

export interface AdjustControlsProps {
  readonly adjust: Adjustments;
  readonly tools: Exclude<ResolvedFeatures['adjust'], false>;
  readonly onAction: (action: EditorAction, options?: {transient?: boolean}) => void;
  readonly onCommit: () => void;
  readonly disabled: boolean;
}

const VALUES: readonly Value[] = ['brightness', 'contrast', 'saturation'];

const PRESET_LABELS: Record<PresetId, `preset${Capitalize<PresetId>}`> = {
  original: 'presetOriginal',
  vivid: 'presetVivid',
  mono: 'presetMono',
  fade: 'presetFade',
  dramatic: 'presetDramatic',
};

function single(value: number | number[]): number {
  return Array.isArray(value) ? (value[0] ?? 0) : value;
}

/** The Adjust tab: pick a value, move its one slider, or jump to a preset. */
export function AdjustControls({adjust, tools, onAction, onCommit, disabled}: Readonly<AdjustControlsProps>) {
  const labels = useLabels();
  const values = VALUES.filter((value) => tools[value]);
  const [picked, setPicked] = useState<Value | undefined>(values[0]);
  const active = picked !== undefined && values.includes(picked) ? picked : values[0];

  return (
    <Box sx={{display: 'flex', flexDirection: 'column', gap: 1.5, py: 1.5}}>
      {active !== undefined && (
        <Box sx={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 3, rowGap: 1.5}}>
          <ToggleButtonGroup
            size="small"
            exclusive
            aria-label={labels.adjustment}
            disabled={disabled}
            value={active}
            onChange={(_event, value: Value | null) => {
              if (value) setPicked(value);
            }}
          >
            {values.map((value) => (
              <ToggleButton key={value} value={value} sx={{px: 1.5, gap: 1, textTransform: 'none'}}>
                {labels[value]}
                <Typography component="span" variant="caption" color="text.secondary">
                  {adjust[value]}
                </Typography>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Slider
            aria-label={labels[active]}
            size="small"
            disabled={disabled}
            min={-100}
            max={100}
            track={false}
            marks={[{value: 0}]}
            valueLabelDisplay="auto"
            value={adjust[active]}
            onChange={(_event, value) =>
              onAction({type: 'adjust', values: {[active]: single(value)}}, {transient: true})
            }
            onChangeCommitted={onCommit}
            sx={{flex: '1 1 160px', minWidth: 120}}
          />
        </Box>
      )}

      {tools.presets && (
        <ToggleButtonGroup
          size="small"
          exclusive
          aria-label={labels.presets}
          disabled={disabled}
          value={presetOf(adjust)}
          onChange={(_event, id: PresetId | null) => {
            const preset = PRESETS.find((candidate) => candidate.id === id);
            if (preset) onAction({type: 'adjust', values: preset.values});
          }}
          sx={{flexWrap: 'wrap'}}
        >
          {PRESETS.map(({id}) => (
            <ToggleButton key={id} value={id} sx={{px: 1.5, textTransform: 'none'}}>
              {labels[PRESET_LABELS[id]]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      )}
    </Box>
  );
}
