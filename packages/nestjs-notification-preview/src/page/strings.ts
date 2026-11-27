import {createContext, useContext} from 'react';

import type {SentPush} from '../core/types.js';

/**
 * A sentence for each refused or failed request, by HTTP status; `default` for any status not
 * listed, and `0` when no answer came. The page shows the body's own `message` before these.
 */
export interface FailureStrings {
  readonly default: string;
  readonly [status: number]: string;
}

/**
 * Every word the page shows or announces. The module's `strings` option passes any subset;
 * the rest keep their English default. A function entry builds a sentence around a value and
 * keeps its English default, since the settings reach the page as JSON.
 */
export interface PageStrings {
  readonly title: string;
  readonly language: string;
  /** A language code as the language select shows it. */
  readonly languageName: (code: string) => string;
  readonly theme: string;
  readonly themeLight: string;
  readonly themeAuto: string;
  readonly themeDark: string;

  readonly list: string;
  readonly search: string;
  readonly channelEmail: string;
  readonly channelPush: string;
  readonly noMatch: string;
  readonly empty: string;
  readonly catalogFailed: string;
  readonly loading: string;

  readonly preview: string;
  readonly previous: string;
  readonly next: string;
  /** The open notification's place in the list, from 1. */
  readonly position: (position: number, count: number) => string;
  readonly keysHint: string;
  readonly width: string;
  readonly desktop: string;
  readonly phone: string;
  readonly part: string;
  readonly html: string;
  readonly plainText: string;
  readonly device: string;
  readonly ios: string;
  readonly android: string;
  readonly surface: string;
  readonly lockScreen: string;
  readonly banner: string;
  readonly renderedEmail: string;
  readonly pushNotification: string;
  /** The email's sender and subject, as a mail client draws them above the message. */
  readonly inboxHeader: string;
  /** The phone drawing's name: its device and where the push shows. */
  readonly phoneLabel: (device: string, surface: string) => string;
  readonly now: string;
  /** A fixed moment on the phone's lock screen, so every preview looks the same. */
  readonly lockTime: string;
  readonly lockDate: string;
  /** The same date, as Android's lock screen writes it. */
  readonly lockDateShort: string;
  readonly warnings: string;
  readonly renderRefused: string;
  /** A render failed for a reason other than a refused value; `status` when the server answered. */
  readonly renderFailed: (status: number | undefined) => string;

  readonly inspector: string;
  readonly whenSent: string;
  readonly recipient: string;
  readonly tabVariables: string;
  readonly tabDetails: string;
  readonly tabSend: string;
  readonly presets: string;
  readonly presetSample: string;
  readonly presetLong: string;
  readonly presetEmpty: string;
  readonly presetEscaping: string;
  readonly presetLongUrl: string;
  readonly variables: string;
  readonly reset: string;
  readonly noVariables: string;
  readonly hintUrl: string;
  readonly hintDatetime: string;
  readonly message: string;
  readonly channel: string;
  readonly htmlSize: string;
  /** A size in kilobytes, already rounded to one decimal. */
  readonly kilobytes: (size: string) => string;
  readonly copyHtml: string;
  readonly copyText: string;
  readonly copiedHtml: string;
  readonly copiedText: string;
  readonly clipboardRefused: string;
  readonly subject: string;
  readonly pushTitle: string;
  readonly pushBody: string;
  readonly emptyValue: string;

  readonly targetEmail: string;
  readonly targetPush: string;
  readonly targetPushHint: string;
  /** Shown under the target field when it is empty. */
  readonly targetRequired: string;
  readonly recentTargets: string;
  readonly sendEmail: string;
  readonly sendPush: string;
  readonly sending: string;
  readonly sendWarning: string;
  readonly sentEmail: (target: string) => string;
  readonly sentPush: (result: SentPush) => string;
  readonly sendRefused: (message: string) => string;
  readonly sendFailed: (status: number | undefined) => string;
  readonly tooManySends: (retryAfterSeconds: number | undefined) => string;

  readonly failure: FailureStrings;
}

const devices = (count: number): string => (count === 1 ? '1 device' : `${String(count)} devices`);

/** "es" as "Spanish (es)"; a code the browser cannot name is shown as it is. */
function englishLanguageName(code: string): string {
  try {
    return `${new Intl.DisplayNames(['en'], {type: 'language'}).of(code) ?? code} (${code})`;
  } catch {
    return code;
  }
}

export const DEFAULT_PAGE_STRINGS: PageStrings = {
  title: 'Notification preview',
  language: 'Language',
  languageName: englishLanguageName,
  theme: 'Theme',
  themeLight: 'Light',
  themeAuto: 'Auto',
  themeDark: 'Dark',

  list: 'Notifications',
  search: 'Find a notification',
  channelEmail: 'Email',
  channelPush: 'Push',
  noMatch: 'No notification matches.',
  empty: 'No notifications are registered.',
  catalogFailed: 'The notification list did not load.',
  loading: 'Loading…',

  preview: 'Preview',
  previous: 'Previous notification',
  next: 'Next notification',
  position: (position, count) => `${String(position)} / ${String(count)}`,
  keysHint: 'switch notification',
  width: 'Width',
  desktop: 'Desktop',
  phone: 'Phone',
  part: 'Part',
  html: 'HTML',
  plainText: 'Plain text',
  device: 'Device',
  ios: 'iPhone',
  android: 'Android',
  surface: 'Where',
  lockScreen: 'Lock screen',
  banner: 'Banner',
  renderedEmail: 'Rendered email',
  pushNotification: 'Push notification',
  inboxHeader: 'Inbox header',
  phoneLabel: (device, surface) => `${device}, ${surface}`,
  now: 'now',
  lockTime: '9:41',
  lockDate: 'Wednesday, January 15',
  lockDateShort: 'Wed, Jan 15',
  warnings: 'Warnings',
  renderRefused: 'Not rendered: a value was refused. The preview keeps the last render.',
  renderFailed: (status) =>
    status === undefined ? 'The preview failed.' : `The preview failed with ${String(status)}.`,

  inspector: 'Inspector',
  whenSent: 'When it is sent',
  recipient: 'Who gets it',
  tabVariables: 'Variables',
  tabDetails: 'Details',
  tabSend: 'Send test',
  presets: 'Presets',
  presetSample: 'Sample',
  presetLong: 'Long value',
  presetEmpty: 'Empty',
  presetEscaping: 'Needs escaping',
  presetLongUrl: 'Long URL',
  variables: 'Variables',
  reset: 'Reset',
  noVariables: 'This notification takes no variables.',
  hintUrl: 'A whole link, starting https://',
  hintDatetime: 'In UTC; sent as an ISO instant',
  message: 'Message',
  channel: 'Channel',
  htmlSize: 'HTML size',
  kilobytes: (size) => `${size} KB`,
  copyHtml: 'Copy HTML',
  copyText: 'Copy text',
  copiedHtml: 'Copied the HTML.',
  copiedText: 'Copied the text.',
  clipboardRefused: 'The browser refused the clipboard.',
  subject: 'Subject',
  pushTitle: 'Title',
  pushBody: 'Body',
  emptyValue: '(empty)',

  targetEmail: 'To',
  targetPush: 'Account',
  targetPushHint: 'Every device this account registered receives the push.',
  targetRequired: 'Enter where the test goes.',
  recentTargets: 'Recent',
  sendEmail: 'Send test email',
  sendPush: 'Send test push',
  sending: 'Sending…',
  sendWarning: 'A test send looks exactly like the real thing. Use test data only.',
  sentEmail: (target) => `Sent to ${target}.`,
  sentPush: (result) => {
    const parts = [`Sent to ${String(result.sent)} of ${devices(result.devices)}.`];
    if (result.failed > 0) parts.push(`${devices(result.failed)} failed.`);
    if (result.removed > 0) parts.push(`${devices(result.removed)} no longer registered, removed.`);
    return parts.join(' ');
  },
  sendRefused: (message) => `Not sent: ${message}`,
  sendFailed: (status) =>
    status === undefined ? 'The test send failed.' : `The test send failed with ${String(status)}.`,
  tooManySends: (retryAfterSeconds) =>
    retryAfterSeconds === undefined
      ? 'Too many test sends. Try again shortly.'
      : `Too many test sends. Try again in ${String(retryAfterSeconds)} s.`,

  failure: {
    // Also said when no answer came at all (status 0), unless a translation names 0 itself.
    default: 'The request failed. Check the connection and try again.',
    400: 'The server refused the request.',
    401: 'Sign in to use the notification preview.',
    403: 'This account may not use the notification preview.',
    404: 'The notification preview is not available here.',
    422: 'A value was refused.',
    429: 'Too many requests. Wait a moment and try again.',
    500: 'The server failed. Try again.',
    502: 'The server could not be reached.',
    503: 'The server is unavailable. Try again shortly.',
    504: 'The server took too long to answer.',
  },
};

/** The defaults with `strings` over them; the failure sentences are merged one by one. */
export function mergeStrings(strings: Partial<PageStrings> | undefined): PageStrings {
  return {
    ...DEFAULT_PAGE_STRINGS,
    ...strings,
    failure: {...DEFAULT_PAGE_STRINGS.failure, ...strings?.failure},
  };
}

export const StringsContext = createContext<PageStrings>(DEFAULT_PAGE_STRINGS);

/** The page's strings, with the consumer's overrides applied. */
export const useStrings = (): PageStrings => useContext(StringsContext);
