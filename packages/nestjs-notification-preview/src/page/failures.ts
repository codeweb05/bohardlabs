import {PreviewClientError} from './client.js';
import type {PageStrings} from './strings.js';

export interface Failure {
  readonly fieldErrors: Readonly<Record<string, string>>;
  readonly message: string;
}

const NO_ERRORS: Readonly<Record<string, string>> = {};
const TOO_MANY = 429;

/**
 * What the server said: the body's own `message`, or the `failure` sentence for the status, as
 * the client worked it out. A 429 adds the wait its `Retry-After` gave.
 */
function saidBy(error: PreviewClientError, strings: PageStrings): string {
  if (error.status !== TOO_MANY || error.retryAfterSeconds === undefined) return error.message;
  return `${error.message} ${strings.retryAfter(error.retryAfterSeconds)}`;
}

/** Own properties only, so a field named `constructor` is never read off the prototype. */
const fieldError = (errors: Readonly<Record<string, string>>, name: string): string | undefined =>
  Object.hasOwn(errors, name) ? errors[name] : undefined;

/** Why the list did not load: what the server said, or `catalogFailed` when nothing did. */
export function catalogFailureOf(error: unknown, strings: PageStrings): string {
  return error instanceof PreviewClientError ? saidBy(error, strings) : strings.catalogFailed;
}

/**
 * A refused value goes on its field, and a refused language is named in the status line, as it
 * has no field. Anything else is what the server said, in one sentence in the status line.
 */
export function renderFailureOf(error: unknown, strings: PageStrings): Failure {
  if (!(error instanceof PreviewClientError)) return {fieldErrors: NO_ERRORS, message: strings.renderFailed(undefined)};
  if (Object.keys(error.fieldErrors).length > 0) {
    const locale = fieldError(error.fieldErrors, 'locale');
    const message = locale === undefined ? strings.renderRefused : strings.localeRefused(locale);
    return {fieldErrors: error.fieldErrors, message};
  }
  return {fieldErrors: NO_ERRORS, message: saidBy(error, strings)};
}

/** As `renderFailureOf`, for a send: the refused field's message is said, and a 429 says when to retry. */
export function sendFailureOf(error: unknown, strings: PageStrings): Failure {
  if (!(error instanceof PreviewClientError)) return {fieldErrors: NO_ERRORS, message: strings.sendFailed(undefined)};
  const first = error.status === TOO_MANY ? undefined : Object.values(error.fieldErrors)[0];
  if (first !== undefined) return {fieldErrors: error.fieldErrors, message: strings.sendRefused(first)};
  return {fieldErrors: NO_ERRORS, message: saidBy(error, strings)};
}
