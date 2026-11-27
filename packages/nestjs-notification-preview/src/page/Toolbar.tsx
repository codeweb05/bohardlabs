import type {ReactNode} from 'react';

import type {Channel} from '../core/types.js';
import {KeysHint, Pager, Seg} from './controls.js';
import type {Part, Width} from './EmailCanvas.js';
import {Icon} from './Icon.js';
import type {Device, Surface} from './PhoneFrame.js';
import {useStrings} from './strings.js';

export interface CanvasView {
  readonly width: Width;
  readonly part: Part;
  readonly device: Device;
  readonly surface: Surface;
}

/**
 * Above the canvas: the pager, then the open channel's own choices, then `end` (where test
 * mode puts its tick) and the keys hint.
 */
export function Toolbar({
  channel,
  position,
  count,
  view,
  onStep,
  onView,
  end,
}: Readonly<{
  channel: Channel | undefined;
  position: number;
  count: number;
  view: CanvasView;
  onStep: (by: 1 | -1) => void;
  onView: (view: CanvasView) => void;
  end?: ReactNode;
}>) {
  const strings = useStrings();
  return (
    <div className="np-toolbar">
      {count > 0 ? <Pager position={position} count={count} onStep={onStep} /> : null}
      {channel === 'email' ? (
        <>
          <Seg<Width>
            legend={strings.width}
            value={view.width}
            onChange={(width) => {
              onView({...view, width});
            }}
            options={[
              {value: 'desktop', label: strings.desktop, icon: <Icon name="monitor" />},
              {value: 'phone', label: strings.phone, icon: <Icon name="phone" />},
            ]}
          />
          <Seg<Part>
            legend={strings.part}
            value={view.part}
            onChange={(part) => {
              onView({...view, part});
            }}
            options={[
              {value: 'html', label: strings.html},
              {value: 'text', label: strings.plainText},
            ]}
          />
        </>
      ) : null}
      {channel === 'push' ? (
        <>
          <Seg<Device>
            legend={strings.device}
            value={view.device}
            onChange={(device) => {
              onView({...view, device});
            }}
            options={[
              {value: 'ios', label: strings.ios},
              {value: 'android', label: strings.android},
            ]}
          />
          <Seg<Surface>
            legend={strings.surface}
            value={view.surface}
            onChange={(surface) => {
              onView({...view, surface});
            }}
            options={[
              {value: 'lock', label: strings.lockScreen},
              {value: 'banner', label: strings.banner},
            ]}
          />
        </>
      ) : null}
      <span className="np-spacer" />
      {end}
      <KeysHint />
    </div>
  );
}
