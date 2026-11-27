import {useEffect, useRef, useState} from 'react';

import type {RenderedEmail} from '../core/types.js';
import {initialOf, useAppName} from './appName.js';
import {useStrings} from './strings.js';

export type Width = 'desktop' | 'phone';
export type Part = 'html' | 'text';

/**
 * The height of the frame's document. The frame is first drawn 0px tall, so neither an email
 * whose html or body is `height: 100%` nor the frame's own viewport props the answer up: what is
 * left is the content. A browser gives the root's box and its overflow; jsdom lays nothing out,
 * so its `scrollHeight` alone stands in there.
 */
function contentHeight(frame: HTMLIFrameElement): number {
  const root = frame.contentDocument?.documentElement;
  if (root === undefined) return 0;
  const before = frame.style.height;
  frame.style.height = '0px';
  const height = Math.max(Math.ceil(root.getBoundingClientRect().height), root.scrollHeight);
  frame.style.height = before;
  return height;
}

/**
 * The email in its frame. The frame grows to the email's height, so a short email leaves no
 * white box under it and a long one scrolls the canvas, not the frame. It measures again when
 * the body changes size, an image loads or the fonts arrive. Measuring needs the frame's
 * document, hence `allow-same-origin`; scripts stay off, so the email runs nothing.
 */
function EmailFrame({html, width}: Readonly<{html: string; width: Width}>) {
  const strings = useStrings();
  const [height, setHeight] = useState<number | undefined>(undefined);
  const stopWatching = useRef<(() => void) | undefined>(undefined);
  useEffect(
    () => () => {
      stopWatching.current?.();
    },
    [],
  );
  return (
    <iframe
      className="np-mail-frame"
      data-width={width}
      title={strings.renderedEmail}
      sandbox="allow-same-origin"
      srcDoc={html}
      style={height === undefined ? undefined : {height: `${String(height)}px`}}
      onLoad={(event) => {
        const frame = event.currentTarget;
        const measure = (): void => {
          const measured = contentHeight(frame);
          if (measured <= 0) return;
          frame.style.height = `${String(measured)}px`;
          setHeight(measured);
        };
        stopWatching.current?.();
        stopWatching.current = watch(frame, measure);
        measure();
      }}
    />
  );
}

/** Calls `measure` whenever the loaded email may have changed height; returns the way to stop. */
function watch(frame: HTMLIFrameElement, measure: () => void): () => void {
  const doc = frame.contentDocument;
  if (doc === null) return () => undefined;
  // An image's load does not bubble; it is caught on the way down.
  doc.addEventListener('load', measure, true);
  // Typed wide on purpose: jsdom has neither, and a document may have no body yet.
  const body: HTMLElement | null = doc.body;
  const fonts: FontFaceSet | undefined = doc.fonts;
  fonts?.addEventListener('loadingdone', measure);
  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
  if (body !== null) observer?.observe(body);
  return () => {
    doc.removeEventListener('load', measure, true);
    fonts?.removeEventListener('loadingdone', measure);
    observer?.disconnect();
  };
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
