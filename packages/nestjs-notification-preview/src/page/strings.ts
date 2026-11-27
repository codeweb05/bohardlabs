import {createContext, useContext} from 'react';

import type {SentPush} from '../core/types.js';

/**
 * Every word the page shows or announces. Pass any subset through the page's `strings` prop;
 * the rest keep their English default. A function entry builds a sentence around a value.
 * Keys are added in minor versions, so type a translation as `Partial<NotificationPreviewStrings>`.
 */
export interface NotificationPreviewStrings {
  readonly title: string;
  /** The sender's name on the mail bar and the app's name on an Android push. */
  readonly appName: string;
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
  readonly now: string;
  /** A fixed moment on the phone's lock screen, so every preview looks the same. */
  readonly lockTime: string;
  readonly lockDate: string;
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

export const DEFAULT_NOTIFICATION_PREVIEW_STRINGS: NotificationPreviewStrings = {
  title: 'Notification preview',
  appName: 'Your app',
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
  now: 'now',
  lockTime: '9:41',
  lockDate: 'Wednesday, January 15',
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
};

export const StringsContext = createContext<NotificationPreviewStrings>(DEFAULT_NOTIFICATION_PREVIEW_STRINGS);

/** The page's strings, with the consumer's overrides applied. */
export const useStrings = (): NotificationPreviewStrings => useContext(StringsContext);
