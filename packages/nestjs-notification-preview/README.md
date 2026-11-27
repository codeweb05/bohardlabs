# @vt-labs/nestjs-notification-preview

A NestJS module that serves a page where the team building your app can see every email and push notification as the
person receiving it would, change the values it is built from, and send one to themselves as a test. A test mode lets
a reviewer tick each notification off as tested and flags one whose render changed since the tick.

It is for a Nest API with Express (`@nestjs/platform-express`) that owns its notification templates. Nothing in the
package is specific to one product: your app supplies the list of notifications and the code that renders and sends
them. The package carries no language of its own; it asks each provider which locales it has and passes the chosen one
through untouched.

## Install

```sh
pnpm add @vt-labs/nestjs-notification-preview
```

Peers: `@nestjs/common`, `@nestjs/core` and `@nestjs/platform-express` at `^12.0.0`, `reflect-metadata` and `rxjs`.
The package is ESM only. The page is prebuilt with its own React, so your API installs no React.

## Use it

```ts
// notification-preview.ts
import type {Providers, RegistryEntry} from '@vt-labs/nestjs-notification-preview';

export const registry: RegistryEntry[] = [
  {
    id: 'password-reset',
    channel: 'email',
    label: 'Password reset',
    recipient: 'The account holder',
    trigger: 'Someone asks to reset the password on the sign-in page.',
    variables: [
      {name: 'firstName', type: 'text', sample: 'Ada'},
      {name: 'resetUrl', type: 'url', sample: 'https://example.com/reset/abc'},
    ],
  },
  {
    id: 'task-reminder',
    channel: 'push',
    label: 'Task reminder',
    trigger: 'A task is due in fifteen minutes.',
    variables: [{name: 'taskName', type: 'text', sample: 'Water the plants'}],
  },
];

export const providers: Providers = {
  email: {
    locales: () => ['en', 'es'], // the first is the default
    render: (id, values, locale) => mailer.render(id, values, locale), // {subject, html, text, warnings?}
    send: async (id, values, locale, to) => ({messageId: await mailer.send(id, values, locale, to)}),
  },
  push: {
    locales: () => ['en'],
    render: (id, values, locale) => pushes.render(id, values, locale), // {title, body, warnings?}
    send: (id, values, locale, account) => pushes.sendToAccount(account, id, values, locale), // {devices, sent, failed, removed}
  },
};
```

`mailer` and `pushes` are your own code. `values` holds only the variables the entry declares, each as a string. A
provider refuses a value by throwing `new InvalidValuesError({resetUrl: 'Must start with https://.'})`; the page shows
the message under that field. `locales()` lists the languages the channel can render. An empty list accepts any locale
and falls back to the provider's first locale, or `'en'`. Your provider resolves the messages for a locale itself.

```ts
// app.module.ts
import {Module} from '@nestjs/common';
import {NotificationPreviewModule} from '@vt-labs/nestjs-notification-preview';

import {providers, registry} from './notification-preview.js';

@Module({
  imports: [
    NotificationPreviewModule.forRoot({
      path: '/notification-preview',
      enabled: process.env.NODE_ENV !== 'production',
      registry,
      providers,
      appName: 'Acme',
      environment: 'DEV',
    }),
  ],
})
export class AppModule {}
```

Open `/notification-preview` in a browser. Use `forRootAsync` when the providers need injected services:

```ts
import {Module} from '@nestjs/common';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {NotificationPreviewModule} from '@vt-labs/nestjs-notification-preview';

import {Mailer} from './mailer.js';
import {MailerModule} from './mailer.module.js';
import {registry} from './notification-preview.js';

@Module({
  imports: [
    NotificationPreviewModule.forRootAsync({
      path: '/notification-preview',
      enabled: process.env.NODE_ENV !== 'production',
      imports: [ConfigModule, MailerModule],
      inject: [ConfigService, Mailer],
      useFactory: (config: ConfigService, mailer: Mailer) => ({
        registry,
        providers: {email: mailer.previewProvider()}, // a ChannelProvider your code builds
        appName: config.getOrThrow<string>('APP_NAME'),
        environment: config.get<string>('ENVIRONMENT_LABEL') ?? null,
      }),
    }),
  ],
})
export class AppModule {}
```

`path`, `enabled` and `decorators` are given up front, not from the factory, because the routes are fixed when the
module is built. `useFactory` returns the rest: `registry`, `providers`, `appName`, `environment`, `strings`,
`storageKey`.

## Options

| Option        | What it does                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| `path`        | Where the page lives: a leading slash, no trailing slash, no `.` or `..` segment. Anything else throws  |
| `enabled`     | `false` registers no controller and no middleware. Default `true`                                       |
| `registry`    | Every notification the preview may render or send. Ids must be unique                                   |
| `providers`   | `{email?, push?}`: `locales()`, `render` and `send` for each channel                                    |
| `appName`     | The name on the page's brand, the inbox header and the phone                                            |
| `environment` | A badge beside the title, such as `DEV`. None when left out or `null`                                   |
| `strings`     | Replaces any of the page's words. Plain strings only (JSON); entries that build a sentence keep English |
| `storageKey`  | Prefix for what the page keeps in the browser. Default `'notification-preview'`                         |
| `decorators`  | Decorators for the routes, below                                                                        |

`strings` reaches the browser as JSON, so a value must be a string. An entry that builds a sentence around a value
(the position in the list, a language's name, the test-mode counts) is a function and keeps its English default.
`failure` takes sentences by HTTP status, with or without `default`:

```ts
strings: {title: 'Notifications', failure: {429: 'Too many sends. Wait a moment.', default: 'Something went wrong.'}}
```

Colours are `--np-*` custom properties with light and dark values, set on the page's root.

## Guards and rate limits: `decorators`

The routes are ordinary Nest routes, so your app's global guards run on them. A test send reaches real inboxes and
phones: put the page behind your sign-in, and rate-limit `send`. Pass decorators and they are applied to the route
methods the way Nest's `applyDecorators` composes them.

- `decorators.all` is applied to each of the three route methods (never to the class), and is a `readonly MethodDecorator[]`.
- `decorators.catalog`, `decorators.render` and `decorators.send` add to that one route.

```ts
import {SetMetadata, UseGuards} from '@nestjs/common';
import {Throttle} from '@nestjs/throttler';
import {NotificationPreviewModule} from '@vt-labs/nestjs-notification-preview';

import {AdminGuard} from './admin.guard.js';

// An app whose global guard refuses every route that lacks this marker:
const Public = () => SetMetadata('isPublic', true);

NotificationPreviewModule.forRoot({
  path: '/notification-preview',
  registry,
  providers,
  appName: 'Acme',
  decorators: {
    all: [UseGuards(AdminGuard)], // or [Public()] when the app guards some other way
    send: [Throttle({default: {limit: 5, ttl: 60_000}})], // five test sends a minute
  },
});
```

A guard that runs once per request sees the route's own handler metadata, which is what `Reflector.get(…, context.getHandler())`
reads. The page itself, `GET <path>` and its assets, is served by a middleware before routing, so guards and
decorators do not reach it; it holds no data. Everything it shows comes from the three `api` routes. When a guard
refuses, the page shows the status's message and, for a 429, the wait from `Retry-After`.

## Routes

| Route                       | What it does                                                          |
| --------------------------- | --------------------------------------------------------------------- |
| `GET <path>`, `GET <path>/` | The page                                                              |
| `GET <path>/assets/*`       | The page's hashed files, cached as `immutable` for a year             |
| `GET <path>/api/catalog`    | The registry and each channel's locales                               |
| `POST <path>/api/render`    | Renders one notification from `{id, locale, values}`                  |
| `POST <path>/api/send`      | Sends one as a test, to `target` (an address, or an account for push) |

The three `api` routes write their own responses (`@Res()`), so an app's global response interceptor does not wrap
them, and read the body from `request.body` (`@Req()`), so an app's pipes do not change what a reviewer typed.

| Answer | When                                                                                    |
| ------ | --------------------------------------------------------------------------------------- |
| 200    | The result                                                                              |
| 404    | `{message}`: the id is not in the registry, or the request has no body (no id)          |
| 422    | `{message, fieldErrors}`: a provider refused a value, or the locale is not one it lists |
| other  | Anything else a provider throws goes to the app's exception filters                     |

### In production

Set `enabled: false`. Nothing is registered: no controller, no middleware, and `forRootAsync` never calls `useFactory`,
so `GET <path>` is the app's own 404. The page can render every template with chosen values and send mail from your
account, so keep it off wherever that is not wanted.

### An app with `setGlobalPrefix`

The page calls `<path>/api` exactly as given, so the global prefix must not be added to it. Exclude the page and
everything under it (Nest 12 route syntax):

```ts
import {NestFactory} from '@nestjs/core';

const app = await NestFactory.create(AppModule);
app.setGlobalPrefix('v1', {exclude: ['notification-preview', 'notification-preview/{*path}']});
```

Without the exclusion the API routes answer at `/v1/notification-preview/api/...` and the page asks for the unprefixed
ones.

## Test mode

The switch in the header turns on test mode: a reviewer ticks each notification as tested, filters the list to what is
left, and a notification whose render changed since the tick shows "retest". The ticks and the mode flag live in the
browser's `localStorage`, under `<storageKey>:tested` and `<storageKey>:testMode`. Nothing is stored on the server,
and the package logs nothing.

## What to know before you ship it

- **Remote images do not load.** The page's Content-Security-Policy is `img-src 'self' data:`, so an `<img>` in a
  previewed email that points at another host is not fetched. Scripts, fonts and other fetches are blocked the same
  way, and the email's frame is sandboxed without scripts. Inline images as `data:` URIs to see them.
- **Do not bundle the server into one file.** The page is read at start-up from the package's own `dist/ui`, found
  through `import.meta.url`. A single-file build (webpack, esbuild) moves that path and the module fails to start unless
  `node_modules/@vt-labs/nestjs-notification-preview/dist/ui` is shipped beside the bundle, or the package is left
  external.
- **Express only.** The page is served by an Express middleware.
- **No PHI or secrets in the registry.** A `sample` value is shown to everyone who can open the page.

## The core, without Nest

`@vt-labs/nestjs-notification-preview/core` has no Nest or React in its graph (the root entry re-exports it). Use it
to mount the same three operations on a server that is not Nest, or on a controller of your own.

```ts
import {
  createNotificationPreview,
  InvalidValuesError,
  UnregisteredNotificationError,
  type RegistryEntry,
} from '@vt-labs/nestjs-notification-preview/core';

const registry: RegistryEntry[] = [
  {
    id: 'password-reset',
    channel: 'email',
    label: 'Password reset',
    recipient: 'The account holder',
    trigger: 'Someone asks to reset the password on the sign-in page.',
    variables: [
      {name: 'firstName', type: 'text', sample: 'Ada'},
      {name: 'resetUrl', type: 'url', sample: 'https://example.com/reset/abc'},
    ],
  },
  {
    id: 'task-reminder',
    channel: 'push',
    label: 'Task reminder',
    trigger: 'A task is due in fifteen minutes.',
    variables: [{name: 'taskName', type: 'text', sample: 'Water the plants'}],
  },
];

export const preview = createNotificationPreview({
  registry,
  providers: {
    email: {
      locales: () => ['en', 'es'], // the first is the default
      render: (id, values, locale) => mailer.render(id, values, locale), // {subject, html, text, warnings?}
      send: async (id, values, locale, to) => ({messageId: await mailer.send(id, values, locale, to)}),
    },
    push: {
      locales: () => ['en'],
      render: (id, values, locale) => pushes.render(id, values, locale), // {title, body, warnings?}
      send: (id, values, locale, account) => pushes.sendToAccount(account, id, values, locale), // {devices, sent, failed, removed}
    },
  },
});
```

`values` holds only the variables the entry declares, each as a string. A provider refuses a value by throwing
`new InvalidValuesError({resetUrl: 'Must start with https://.'})`; the page shows the message under that field.

Mount three routes under one base path. A NestJS controller, for example (read the body from the request, not
`@Body()`, so an app pipe cannot rewrite what a reviewer typed):

```ts
import {Controller, Get, NotFoundException, Post, Req, UnprocessableEntityException} from '@nestjs/common';
import {
  InvalidValuesError,
  UnregisteredNotificationError,
  type RenderRequest,
  type SendRequest,
} from '@vt-labs/nestjs-notification-preview/core';

import {preview} from './preview.js';

// What a body that is missing reads as: an id nothing is registered under, so the answer is a 404.
const noRequest: SendRequest = {id: '', locale: '', values: {}, target: ''};

@Controller('notification-preview')
export class NotificationPreviewController {
  @Get('catalog')
  catalog() {
    return preview.catalog();
  }

  @Post('render')
  render(@Req() request: {body?: RenderRequest}) {
    return preview.render(request.body ?? noRequest).catch(toHttp);
  }

  @Post('send')
  send(@Req() request: {body?: SendRequest}) {
    return preview.send(request.body ?? noRequest).catch(toHttp);
  }
}

function toHttp(error: unknown): never {
  if (error instanceof UnregisteredNotificationError) throw new NotFoundException({message: error.message});
  if (error instanceof InvalidValuesError) throw new UnprocessableEntityException(error.toBody());
  throw error;
}
```

The page reads a refusal's body as `{message, fieldErrors?}` (`PreviewErrorBody`), and a 429's `Retry-After` header.
A test send reaches real inboxes and phones: guard the routes as you would any test tool, and rate-limit `send`.

Each provider reports its own `locales()`, and the catalog lists them by channel. A request's `locale` reaches the provider
untouched; one the channel does not list is refused with an `InvalidValuesError` on `locale`.
