import type {FactoryProvider, ModuleMetadata} from '@nestjs/common';

import type {Providers, RegistryEntry} from '../core/types.js';
import type {PageTextStrings} from '../pageSettings.js';

/**
 * The page's words to replace, any of them; the rest keep their English default. Only plain
 * strings: the settings reach the browser as JSON, so an entry that builds a sentence around a
 * value (`position`, `languageName`, `phoneLabel`, the test-mode counts) keeps its default.
 * `failure` takes any of the sentences by HTTP status, with or without `default`.
 */
export type NotificationPreviewStrings = PageTextStrings;

/**
 * Decorators for the module's routes, applied the way Nest's `applyDecorators` composes them.
 * This is how a route reaches an app's global guards: a decorator that sets metadata (an app's
 * `Public()` or `RateLimit(...)`) marks the route the way it would mark one of the app's own.
 */
export interface NotificationPreviewDecorators {
  /**
   * Applied to each of the three routes, on the method, never on the class: a guard or
   * interceptor here runs once per request, and a reader of handler metadata (`Reflector.get`
   * with `context.getHandler()`) finds what it set.
   */
  readonly all?: readonly MethodDecorator[];
  /** `GET <path>/api/catalog` only. */
  readonly catalog?: readonly MethodDecorator[];
  /** `POST <path>/api/render` only. */
  readonly render?: readonly MethodDecorator[];
  /** `POST <path>/api/send` only. */
  readonly send?: readonly MethodDecorator[];
}

export interface NotificationPreviewModuleOptions {
  /**
   * Where the page is served, from the origin root, such as `/notification-preview`: a leading
   * slash and no trailing one. The routes live under `<path>/api`. An app with a global prefix
   * excludes this path from it, since the page calls `<path>/api` as given.
   */
  readonly path: string;
  /** `false` registers nothing: no page, no route, so the path is the app's 404. Default `true`. */
  readonly enabled?: boolean;
  /** Every notification the preview may render or send. Ids must be unique. */
  readonly registry: readonly RegistryEntry[];
  /** The app's render and send for each channel. */
  readonly providers: Providers;
  /** The app's name, on the page's brand, the inbox header and the phone. */
  readonly appName: string;
  /** The badge beside the title, such as `DEV`. None when left out or `null`. */
  readonly environment?: string | null;
  readonly strings?: NotificationPreviewStrings;
  /**
   * The prefix for what the page keeps in the browser: the theme, recent targets, test mode and
   * its ticks. Nothing is kept on the server. Default `'notification-preview'`.
   */
  readonly storageKey?: string;
  readonly decorators?: NotificationPreviewDecorators;
}

/** What `forRootAsync`'s factory answers: every option the routes do not need before it runs. */
export type NotificationPreviewSettings = Omit<NotificationPreviewModuleOptions, 'path' | 'enabled' | 'decorators'>;

/**
 * `path`, `enabled` and `decorators` are given up front, since a controller's routes and
 * decorators are fixed when the module is built, before any factory runs.
 */
export interface NotificationPreviewModuleAsyncOptions {
  readonly imports?: ModuleMetadata['imports'];
  readonly inject?: FactoryProvider['inject'];
  readonly useFactory: (...args: never[]) => NotificationPreviewSettings | Promise<NotificationPreviewSettings>;
  readonly path: string;
  /** `false` registers nothing and never calls `useFactory`. Default `true`. */
  readonly enabled?: boolean;
  readonly decorators?: NotificationPreviewDecorators;
}
