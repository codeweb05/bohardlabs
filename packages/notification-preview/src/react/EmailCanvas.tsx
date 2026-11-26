import {useState} from 'react';

import type {RenderedEmail} from '../types.js';
import {Seg} from './controls.js';
import {Icon} from './Icon.js';
import {useStrings} from './strings.js';

type Width = 'desktop' | 'phone';
type Part = 'html' | 'text';

/** The rendered email as a mail client shows it: sender, subject, then the sandboxed HTML or the plain text. */
export function EmailCanvas({email}: Readonly<{email: RenderedEmail}>) {
  const strings = useStrings();
  const [width, setWidth] = useState<Width>('desktop');
  const [part, setPart] = useState<Part>('html');
  return (
    <div className="np-canvas">
      <div className="np-canvas-tools">
        <Seg<Width>
          legend={strings.width}
          value={width}
          onChange={setWidth}
          options={[
            {value: 'desktop', label: strings.desktop, icon: <Icon name="monitor" />},
            {value: 'phone', label: strings.phone, icon: <Icon name="phone" />},
          ]}
        />
        <Seg<Part>
          legend={strings.part}
          value={part}
          onChange={setPart}
          options={[
            {value: 'html', label: strings.html},
            {value: 'text', label: strings.plainText},
          ]}
        />
      </div>
      <div className="np-mail" data-width={width}>
        <div className="np-mail-bar">
          <span className="np-avatar" aria-hidden="true">
            {strings.appName.charAt(0).toUpperCase()}
          </span>
          <div className="np-mail-meta">
            <div className="np-mail-from">
              <strong>{strings.appName}</strong>
              <span className="np-muted">{strings.now}</span>
            </div>
            <div className="np-mail-subject">
              <span className="np-visually-hidden">{strings.subject}: </span>
              {email.subject === '' ? strings.emptyValue : email.subject}
            </div>
          </div>
        </div>
        {part === 'html' ? (
          <iframe className="np-mail-frame" title={strings.renderedEmail} sandbox="" srcDoc={email.html} />
        ) : (
          <pre className="np-mail-text" aria-label={strings.plainText}>
            {email.text}
          </pre>
        )}
      </div>
    </div>
  );
}
