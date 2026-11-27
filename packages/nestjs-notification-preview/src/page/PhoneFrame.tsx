import {useAppName} from './appName.js';
import {useStrings} from './strings.js';

export type Device = 'ios' | 'android';
export type Surface = 'lock' | 'banner';

export interface PhoneFrameProps {
  readonly device: Device;
  readonly surface: Surface;
  readonly title: string;
  readonly body: string;
}

/** The push as the platform draws it: iOS puts the icon beside the text, Android puts the app's line above. */
function Notice({device, title, body}: Readonly<Omit<PhoneFrameProps, 'surface'>>) {
  const strings = useStrings();
  const appName = useAppName();
  const shownTitle = title === '' ? strings.emptyValue : title;
  const shownBody = body === '' ? strings.emptyValue : body;
  return (
    <article className="np-notice" aria-label={strings.pushNotification}>
      {device === 'ios' ? (
        <>
          <span className="np-app-icon" aria-hidden="true" />
          <div className="np-notice-text">
            <div className="np-notice-head">
              <span className="np-notice-app">{appName}</span>
              <small>{strings.now}</small>
            </div>
            <b className="np-notice-title">{shownTitle}</b>
            <p className="np-notice-body">{shownBody}</p>
          </div>
        </>
      ) : (
        <>
          <div className="np-notice-app">
            <span className="np-app-glyph" aria-hidden="true" />
            <span>{appName}</span>
            <small>· {strings.now}</small>
          </div>
          <b className="np-notice-title">{shownTitle}</b>
          <p className="np-notice-body">{shownBody}</p>
        </>
      )}
    </article>
  );
}

/**
 * A phone showing one push: over the lock screen's clock, or as a banner over an app in use.
 * The clock and the date are fixed, so every preview looks the same: the page reads no clock.
 */
export function PhoneFrame({device, surface, title, body}: Readonly<PhoneFrameProps>) {
  const strings = useStrings();
  const label = strings.phoneLabel(
    device === 'ios' ? strings.ios : strings.android,
    surface === 'lock' ? strings.lockScreen : strings.banner,
  );
  return (
    <figure className="np-handset" data-device={device} data-surface={surface} aria-label={label}>
      <div className="np-handset-screen">
        <div className="np-statusbar" aria-hidden="true">
          <span>{strings.lockTime}</span>
          <span className="np-bars" />
        </div>
        {surface === 'lock' ? (
          <div className="np-lock-clock" aria-hidden="true">
            <small>{device === 'ios' ? strings.lockDate : strings.lockDateShort}</small>
            <b>{strings.lockTime}</b>
          </div>
        ) : (
          <div className="np-app-behind" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        )}
        <Notice device={device} title={title} body={body} />
      </div>
    </figure>
  );
}
