import {useState} from 'react';

import type {RenderedPush} from '../core/types.js';
import {Seg} from './controls.js';
import {Icon} from './Icon.js';
import {useStrings} from './strings.js';

type Device = 'ios' | 'android';
type Surface = 'lock' | 'banner';

/** The rendered push on a handset: on the lock screen, or as a banner over an app. */
export function PushCanvas({push}: Readonly<{push: RenderedPush}>) {
  const strings = useStrings();
  const [device, setDevice] = useState<Device>('ios');
  const [surface, setSurface] = useState<Surface>('lock');
  return (
    <div className="np-canvas">
      <div className="np-canvas-tools">
        <Seg<Device>
          legend={strings.device}
          value={device}
          onChange={setDevice}
          options={[
            {value: 'ios', label: strings.ios},
            {value: 'android', label: strings.android},
          ]}
        />
        <Seg<Surface>
          legend={strings.surface}
          value={surface}
          onChange={setSurface}
          options={[
            {value: 'lock', label: strings.lockScreen},
            {value: 'banner', label: strings.banner},
          ]}
        />
      </div>
      <div className="np-phone" data-device={device} data-surface={surface}>
        <div className="np-phone-screen">
          {surface === 'lock' ? (
            <div className="np-lock" aria-hidden="true">
              <div className="np-lock-date">{strings.lockDate}</div>
              <div className="np-lock-time">{strings.lockTime}</div>
            </div>
          ) : (
            <div className="np-app-backdrop" aria-hidden="true" />
          )}
          <article className="np-push" aria-label={strings.pushNotification}>
            <div className="np-push-head">
              <span className="np-push-icon" aria-hidden="true">
                <Icon name="bell" />
              </span>
              <span className="np-push-app">{strings.appName}</span>
              <span className="np-push-when">{strings.now}</span>
            </div>
            <div className="np-push-title">{push.title === '' ? strings.emptyValue : push.title}</div>
            <div className="np-push-body">{push.body === '' ? strings.emptyValue : push.body}</div>
          </article>
        </div>
      </div>
    </div>
  );
}
