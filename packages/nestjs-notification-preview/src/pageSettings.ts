// The words the page shows and the settings the module writes into it. The page and the Nest
// module both read these types, so they live outside `page/`, whose code bundles React and is
// never part of the server build.
import type {SentPush} from './core/types.js';

/**
 * A sentence for each refused or failed request, by HTTP status; `default` for any status not
 * listed, and `0` when no answer came. The page shows the body's own `message` before these.
 */
export interface FailureStrings {
  readonly default: string;
  readonly [status: number]: string;
}

/** Any of the failure sentences; `mergeStrings` keeps the defaults for the rest. */
export interface FailureStringsInput {
  readonly default?: string;
  readonly [status: number]: string;
}

/** Any of the page's words, as a caller gives them; the failure sentences may be some of them. */
export type PageStringsInput = Partial<Omit<PageStrings, 'failure'>> & {readonly failure?: FailureStringsInput};

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
  /** The list did not load and no answer said why, as when the response was not JSON. */
  readonly catalogFailed: string;
  readonly loading: string;

  readonly preview: string;
  /** The scrolling stage under the toolbar, which takes focus so the keyboard can scroll it. */
  readonly stage: string;
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
  /**
   * The server refused the page's language, which happens only when a channel's `locales()`
   * changed after the page loaded; `message` is the server's reason.
   */
  readonly localeRefused: (message: string) => string;
  /**
   * A render failed and no answer said why, as when the response was not JSON. A refusal from the
   * server shows its own `message`, or the `failure` sentence for its status, instead.
   */
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
  /** As `renderFailed`, for a send. */
  readonly sendFailed: (status: number | undefined) => string;
  /** Added after a 429's message when its `Retry-After` gave a number of seconds. */
  readonly retryAfter: (seconds: number) => string;

  /** The header's switch for test mode, where a reviewer ticks each notification as tested. */
  readonly testMode: string;
  readonly testProgress: string;
  readonly tested: string;
  /** Tested notifications over all of them, as "3 / 39". */
  readonly testedOf: (tested: number, total: number) => string;
  /** How many tested notifications changed since the tick, and how many were never tested. */
  readonly testedSummary: (changed: number, untested: number) => string;
  readonly filterLegend: string;
  readonly filterAll: string;
  readonly filterTodo: string;
  readonly filterTested: string;
  readonly markTested: string;
  readonly stateTested: string;
  readonly stateRetest: string;
  readonly stateUntested: string;
  readonly retestTitle: string;
  readonly retestBody: string;

  readonly failure: FailureStrings;
}

/** The keys of `PageStrings` whose value is a plain string. */
type TextKey = {[K in keyof PageStrings]: PageStrings[K] extends string ? K : never}[keyof PageStrings];

/**
 * The page's words that can travel as JSON: every plain-string entry of `PageStrings` and any of
 * the failure sentences. An entry that builds a sentence around a value (`position`,
 * `languageName`, `phoneLabel`, the test-mode counts and others) is a function, which JSON
 * cannot carry, so it keeps its English default.
 */
export type PageTextStrings = Partial<Pick<PageStrings, TextKey>> & {readonly failure?: FailureStringsInput};

/** What the module writes into the page, in `<script type="application/json" id="np-config">`. */
export interface PageConfig {
  /** Where the three routes live, such as `/notification-preview/api`. */
  readonly apiBase: string;
  /** The app's name, on the brand, the inbox header and the phone. */
  readonly appName: string;
  /** The badge beside the title, such as `DEV`; `null` for none. */
  readonly environment: string | null;
  /** Merged over the English defaults. Only plain strings arrive this way: JSON holds no function. */
  readonly strings: PageTextStrings;
  /** The prefix for what the page keeps in this browser: the theme, the recent targets and test mode. */
  readonly storageKey: string;
}
