import {useRef, useState} from 'react';

import type {SendRequest, SendResponse} from '../core/types.js';
import type {PreviewClient} from './client.js';
import {sendFailureOf} from './failures.js';
import {useStrings} from './strings.js';

const NO_ERRORS: Readonly<Record<string, string>> = {};

export interface SendNotice {
  readonly ok: boolean;
  readonly text: string;
}

export interface SendState {
  readonly sending: boolean;
  readonly notice: SendNotice | undefined;
  readonly fieldErrors: Readonly<Record<string, string>>;
  /**
   * Sends once; a second call while one is out is ignored. Answers whether it was sent. An
   * empty target is refused here, in the page's own words, before the server is asked.
   */
  readonly send: (request: SendRequest) => Promise<boolean>;
  /** Forgets the notice and drops the answer to a send still out, as when another notification opens. */
  readonly clear: () => void;
}

/** A test send through the client, with the sentence that reports it. */
export function useSend(client: PreviewClient): SendState {
  const strings = useStrings();
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<SendNotice>();
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>(NO_ERRORS);
  // Each send and each clear takes the next number; an answer under an older one is dropped.
  const sequence = useRef(0);

  const sentence = (target: string, response: SendResponse): string =>
    response.channel === 'email' ? strings.sentEmail(target) : strings.sentPush(response);

  const send = async (request: SendRequest): Promise<boolean> => {
    if (sending) return false;
    const target = request.target.trim();
    if (target === '') {
      setNotice({ok: false, text: strings.sendRefused(strings.targetRequired)});
      setFieldErrors({target: strings.targetRequired});
      return false;
    }
    sequence.current += 1;
    const mine = sequence.current;
    setSending(true);
    setNotice(undefined);
    setFieldErrors(NO_ERRORS);
    let sent = false;
    try {
      const response = await client.send({...request, target});
      if (mine === sequence.current) setNotice({ok: true, text: sentence(target, response)});
      sent = true;
    } catch (error: unknown) {
      if (mine === sequence.current) {
        const failure = sendFailureOf(error, strings);
        setNotice({ok: false, text: failure.message});
        setFieldErrors(failure.fieldErrors);
      }
    }
    setSending(false);
    return sent;
  };

  const clear = (): void => {
    sequence.current += 1;
    setNotice(undefined);
    setFieldErrors(NO_ERRORS);
  };

  return {sending, notice, fieldErrors, send, clear};
}
