import {createContext, useContext} from 'react';

import type {PageStrings, PageStringsInput} from '../pageSettings.js';

export type {FailureStrings, FailureStringsInput, PageStrings, PageStringsInput} from '../pageSettings.js';

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
  stage: 'The notification as it arrives',
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
  localeRefused: (message) => `Not rendered: ${message} Reload the page for the current languages.`,
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
  retryAfter: (seconds) => `Try again in ${String(seconds)} s.`,

  testMode: 'Test mode',
  testProgress: 'Test progress',
  tested: 'Tested',
  testedOf: (tested, total) => `${String(tested)} / ${String(total)}`,
  testedSummary: (changed, untested) => `${String(changed)} changed · ${String(untested)} not tested`,
  filterLegend: 'Show',
  filterAll: 'All',
  filterTodo: 'To test',
  filterTested: 'Tested',
  markTested: 'Mark as tested',
  stateTested: 'Tested',
  stateRetest: 'Changed since tested',
  stateUntested: 'Not tested',
  retestTitle: 'Changed since you tested it.',
  retestBody: 'Test this version and tick it again.',

  failure: {
    // Also said when no answer came at all (status 0), unless a translation names 0 itself.
    default: 'The request failed. Check the connection and try again.',
    400: 'The server refused the request.',
    401: 'Sign in to use the notification preview.',
    403: 'This account may not use the notification preview.',
    404: 'The notification preview is not available here.',
    422: 'A value was refused.',
    429: 'Too many requests.',
    500: 'The server failed. Try again.',
    502: 'The server could not be reached.',
    503: 'The server is unavailable. Try again shortly.',
    504: 'The server took too long to answer.',
  },
};

/** The defaults with `strings` over them; the failure sentences are merged one by one. */
export function mergeStrings(strings: PageStringsInput | undefined): PageStrings {
  return {
    ...DEFAULT_PAGE_STRINGS,
    ...strings,
    failure: {...DEFAULT_PAGE_STRINGS.failure, ...strings?.failure},
  };
}

export const StringsContext = createContext<PageStrings>(DEFAULT_PAGE_STRINGS);

/** The page's strings, with the consumer's overrides applied. */
export const useStrings = (): PageStrings => useContext(StringsContext);
