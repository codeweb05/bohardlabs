import {
  Inject,
  Module,
  RequestMethod,
  type DynamicModule,
  type MiddlewareConsumer,
  type NestModule,
  type Provider,
} from '@nestjs/common';

import {createNotificationPreview} from '../core/createNotificationPreview.js';
import type {PageConfig} from '../pageSettings.js';
import {createPreviewController, PREVIEW} from './createPreviewController.js';
import type {
  NotificationPreviewModuleAsyncOptions,
  NotificationPreviewModuleOptions,
  NotificationPreviewSettings,
} from './options.js';
import {createPageHandler, type PageHandler} from './servePage.js';
import {UI_DIR} from './uiDir.js';

const SETTINGS = Symbol('NotificationPreviewSettings');
const PAGE = Symbol('NotificationPreviewPage');

/** The page's handler and the path it answers under; `null` when the module is disabled. */
interface PageMount {
  readonly path: string;
  readonly handler: PageHandler;
}

/** A path from the origin root, safe to write into the page's HTML: `/a/b`, no trailing slash. */
const PATH = /^(?:\/[\w.~-]+)+$/;

function checkedPath(path: string): string {
  if (!PATH.test(path)) {
    throw new Error(
      `NotificationPreviewModule: path "${path}" must start with a slash, end without one, and hold only letters, digits and . _ ~ -`,
    );
  }
  return path;
}

function pageConfig(path: string, settings: NotificationPreviewSettings): PageConfig {
  return {
    apiBase: `${path}/api`,
    appName: settings.appName,
    environment: settings.environment ?? null,
    strings: settings.strings ?? {},
    storageKey: settings.storageKey ?? 'notification-preview',
  };
}

/** The providers both `forRoot` and `forRootAsync` build on the settings token. */
function providersFor(path: string): Provider[] {
  return [
    {
      provide: PREVIEW,
      useFactory: (settings: NotificationPreviewSettings) => createNotificationPreview(settings),
      inject: [SETTINGS],
    },
    {
      provide: PAGE,
      useFactory: (settings: NotificationPreviewSettings): PageMount => ({
        path,
        handler: createPageHandler({path, config: pageConfig(path, settings), uiDir: UI_DIR}),
      }),
      inject: [SETTINGS],
    },
  ];
}

/** What `enabled: false` registers: no controller, no middleware. */
const disabled = (): DynamicModule => ({
  module: NotificationPreviewModule,
  providers: [{provide: PAGE, useValue: null}],
});

/**
 * Serves the notification preview, the page and its three routes, under one path:
 *
 * - `GET <path>`: the page, prebuilt with React bundled; `GET <path>/assets/*`: its files
 * - `GET <path>/api/catalog`, `POST <path>/api/render`, `POST <path>/api/send`
 *
 * The routes write their own JSON, so an app's response interceptors never reshape what the page
 * reads; an unregistered id answers 404 and a refused value 422 `{message, fieldErrors}`. A
 * refusal from one of the app's guards keeps the app's own shape, and the page reads its status,
 * its `message` and `Retry-After`. Express only. The module logs nothing and keeps nothing on the
 * server.
 *
 * ```ts
 * NotificationPreviewModule.forRoot({
 *   path: '/notification-preview',
 *   registry,
 *   providers: {email, push},
 *   appName: 'Acme',
 *   decorators: {all: [Public()]},
 * });
 * ```
 */
export class NotificationPreviewModule implements NestModule {
  readonly #page: PageMount | null;

  constructor(page: PageMount | null) {
    this.#page = page;
  }

  configure(consumer: MiddlewareConsumer): void {
    if (this.#page === null) return;
    const {path, handler} = this.#page;
    consumer
      .apply(handler)
      .forRoutes({path, method: RequestMethod.GET}, {path: `${path}/assets/*file`, method: RequestMethod.GET});
  }

  static forRoot(options: NotificationPreviewModuleOptions): DynamicModule {
    if (options.enabled === false) return disabled();
    const path = checkedPath(options.path);
    return {
      module: NotificationPreviewModule,
      controllers: [createPreviewController(path, options.decorators)],
      providers: [{provide: SETTINGS, useValue: options}, ...providersFor(path)],
    };
  }

  /** As `forRoot`, with every option but `path`, `enabled` and `decorators` from `useFactory`. */
  static forRootAsync(options: NotificationPreviewModuleAsyncOptions): DynamicModule {
    if (options.enabled === false) return disabled();
    const path = checkedPath(options.path);
    const {useFactory} = options;
    return {
      module: NotificationPreviewModule,
      imports: options.imports ?? [],
      controllers: [createPreviewController(path, options.decorators)],
      providers: [
        // `never[]` lets a consumer's factory type its own parameters; Nest passes the injected values.
        {
          provide: SETTINGS,
          useFactory: (...args: unknown[]) => useFactory(...(args as never[])),
          inject: options.inject,
        },
        ...providersFor(path),
      ],
    };
  }
}

Inject(PAGE)(NotificationPreviewModule, undefined, 0);
Module({})(NotificationPreviewModule);
