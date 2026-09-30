import Box from '@mui/material/Box';
import {useEffect, useRef, useState} from 'react';

import {CropperView, type CropperViewProps} from '../engine/CropperView';
import {layoutStage, type Size} from '../state/geometry';

/** Room around the crop for the resize handles and a glimpse of what is outside it. */
const STAGE_PADDING = 24;

export type CanvasAreaProps = Omit<CropperViewProps, 'stage' | 'layout'>;

/** Measures the space it is given and lays the crop out to fit it. */
export function CanvasArea(props: Readonly<CanvasAreaProps>) {
  const box = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Size | null>(null);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    // A ResizeObserver reports once on observe, so this also takes the first measurement.
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const {width, height} = entry.contentRect;
      setStage((previous) => (previous?.width === width && previous.height === height ? previous : {width, height}));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const {state} = props;
  const ready = stage !== null && stage.width > 0 && stage.height > 0;

  return (
    <Box
      ref={box}
      sx={{position: 'relative', width: '100%', height: 420, maxHeight: '60vh', minHeight: 240, bgcolor: 'grey.900'}}
    >
      {ready && (
        <CropperView
          {...props}
          stage={stage}
          layout={layoutStage(stage, STAGE_PADDING, state.image, state.orientation, state.straighten, state.crop)}
        />
      )}
    </Box>
  );
}
