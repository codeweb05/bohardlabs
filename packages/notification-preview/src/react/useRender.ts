import {useCallback, useEffect, useRef, useState} from 'react';

import type {RenderRequest, RenderResponse} from '../types.js';
import type {PreviewClient} from './client.js';
import {renderFailureOf} from './failures.js';
import type {Failure} from './failures.js';
import {useStrings} from './strings.js';

/** How long after the last keystroke a render is sent. */
const DEBOUNCE_MS = 250;

const NO_ERRORS: Readonly<Record<string, string>> = {};

export interface RenderState {
  readonly rendered: RenderResponse | undefined;
  /** The request that produced `rendered`, so what is shown beside it is what it holds. */
  readonly request: RenderRequest | undefined;
  readonly busy: boolean;
  readonly fieldErrors: Readonly<Record<string, string>>;
  readonly failure: string | undefined;
  /** Renders at once, or a moment after the last call when `debounce` is set. */
  readonly render: (request: RenderRequest, debounce?: boolean) => void;
  readonly clearFailure: () => void;
}

/**
 * Renders through the client. Each render is numbered and an answer that is no longer the
 * newest is dropped, so a slow one never replaces a later value. A refusal keeps the last
 * render on screen.
 */
export function useRender(client: PreviewClient): RenderState {
  const strings = useStrings();
  const [last, setLast] = useState<{readonly rendered: RenderResponse; readonly request: RenderRequest}>();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Failure>();
  const sequence = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const send = useCallback(
    async (request: RenderRequest): Promise<void> => {
      sequence.current += 1;
      const mine = sequence.current;
      setBusy(true);
      try {
        const rendered = await client.render(request);
        if (mine !== sequence.current) return;
        setLast({rendered, request});
        setProblem(undefined);
      } catch (error: unknown) {
        if (mine === sequence.current) setProblem(renderFailureOf(error, strings));
      }
      if (mine === sequence.current) setBusy(false);
    },
    [client, strings],
  );

  // A timer still waiting when the page goes is cleared.
  useEffect(() => () => clearTimeout(timer.current), []);

  const render = useCallback(
    (request: RenderRequest, debounce = false): void => {
      clearTimeout(timer.current);
      if (debounce) timer.current = setTimeout(() => void send(request), DEBOUNCE_MS);
      else void send(request);
    },
    [send],
  );

  const clearFailure = useCallback(() => {
    setProblem(undefined);
  }, []);

  return {
    rendered: last?.rendered,
    request: last?.request,
    busy,
    fieldErrors: problem?.fieldErrors ?? NO_ERRORS,
    failure: problem?.message,
    render,
    clearFailure,
  };
}
