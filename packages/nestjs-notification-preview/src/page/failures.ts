import {PreviewClientError} from './client.js';
import type {PageStrings} from './strings.js';

export interface Failure {
  readonly fieldErrors: Readonly<Record<string, string>>;
  readonly message: string;
}

const NO_ERRORS: Readonly<Record<string, string>> = {};
const TOO_MANY = 429;

/** The status a failure is worth naming: an answer outside 2xx. */
const statusOf = (error: PreviewClientError): number | undefined =>
  error.status === 0 || (error.status >= 200 && error.status < 300) ? undefined : error.status;

/** A refused value goes on its field; anything else is one sentence in the status line. */
export function renderFailureOf(error: unknown, strings: PageStrings): Failure {
  if (!(error instanceof PreviewClientError)) return {fieldErrors: NO_ERRORS, message: strings.renderFailed(undefined)};
  if (Object.keys(error.fieldErrors).length > 0)
    return {fieldErrors: error.fieldErrors, message: strings.renderRefused};
  return {fieldErrors: NO_ERRORS, message: strings.renderFailed(statusOf(error))};
}

/** As `renderFailureOf`, for a send: the refused field's message is said, and a 429 says when to retry. */
export function sendFailureOf(error: unknown, strings: PageStrings): Failure {
  if (!(error instanceof PreviewClientError)) return {fieldErrors: NO_ERRORS, message: strings.sendFailed(undefined)};
  if (error.status === TOO_MANY)
    return {fieldErrors: NO_ERRORS, message: strings.tooManySends(error.retryAfterSeconds)};
  const first = Object.values(error.fieldErrors)[0];
  if (first !== undefined) return {fieldErrors: error.fieldErrors, message: strings.sendRefused(first)};
  return {fieldErrors: NO_ERRORS, message: strings.sendFailed(statusOf(error))};
}
