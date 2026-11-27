import {useState} from 'react';

import type {RenderedEmail} from '../core/types.js';
import {initialOf, useAppName} from './appName.js';
import {useStrings} from './strings.js';

export type Width = 'desktop' | 'phone';
export type Part = 'html' | 'text';

/**
 * The height of the frame's document. A browser gives the root's box; jsdom lays nothing out,
 * so its `scrollHeight` stands in there.
 */
function contentHeight(frame: HTMLIFrameElement): number {
  const root = frame.contentDocument?.documentElement;
  if (root === undefined) return 0;
  const box = Math.ceil(root.getBoundingClientRect().height);
  return box > 0 ? box : root.scrollHeight;
}

/**
 * The email in its frame. The frame grows to the email's height, so a short email leaves no
 * white box under it and a long one scrolls the canvas, not the frame. Measuring needs the
 * frame's document, hence `allow-same-origin`; scripts stay off, so the email runs nothing.
 */
function EmailFrame({html, width}: Readonly<{html: string; width: Width}>) {
  const strings = useStrings();
  const [height, setHeight] = useState<number | undefined>(undefined);
  return (
    <iframe
      className="np-mail-frame"
      data-width={width}
      title={strings.renderedEmail}
      sandbox="allow-same-origin"
      srcDoc={html}
      style={height === undefined ? undefined : {height: `${String(height)}px`}}
      onLoad={(event) => {
        const measured = contentHeight(event.currentTarget);
        if (measured > 0) setHeight(measured);
      }}
    />
  );
}

/** The rendered email as a mail client shows it: sender, subject, then the HTML or the plain text. */
export function EmailCanvas({email, width, part}: Readonly<{email: RenderedEmail; width: Width; part: Part}>) {
  const strings = useStrings();
  const appName = useAppName();
  return (
    <div className="np-viewport" data-width={width}>
      <div className="np-viewport-screen">
        <div className="np-mailbar" role="group" aria-label={strings.inboxHeader}>
          <div className="np-from">
            <span className="np-avatar" aria-hidden="true">
              {initialOf(appName)}
            </span>
            <div>
              <b>{appName}</b>
              <small>{strings.now}</small>
            </div>
          </div>
          <div className="np-subject">
            <span className="np-visually-hidden">{strings.subject}: </span>
            <span>{email.subject === '' ? strings.emptyValue : email.subject}</span>
          </div>
        </div>
        {part === 'html' ? (
          // A new width is a new frame, so the email is laid out and measured again.
          <EmailFrame key={width} html={email.html} width={width} />
        ) : (
          <pre className="np-mail-text" aria-label={strings.plainText}>
            {email.text}
          </pre>
        )}
      </div>
    </div>
  );
}
