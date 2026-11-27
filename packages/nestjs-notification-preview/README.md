# @vt-labs/nestjs-notification-preview

A NestJS module that serves a preview and test-send page for an app's email and push notifications, so the team
building the app can see each one as the person receiving it would, and send one to themselves as a test. Nothing in
the package is specific to one product; your app supplies the list of notifications and the code that renders and
sends them.

This release holds the framework-neutral core, `createNotificationPreview`. The Nest module and the page it serves
join it in the next releases.

## Install

```sh
pnpm add @vt-labs/nestjs-notification-preview
```

## The core

```ts
import {
  createNotificationPreview,
  InvalidValuesError,
  UnregisteredNotificationError,
  type RegistryEntry,
} from '@vt-labs/nestjs-notification-preview';

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

Mount three routes under one base path. A NestJS controller, for example:

```ts
@Controller('notification-preview')
export class NotificationPreviewController {
  @Get('catalog')
  catalog() {
    return preview.catalog();
  }

  @Post('render')
  render(@Body() body: RenderRequest) {
    return preview.render(body).catch(toHttp);
  }

  @Post('send')
  send(@Body() body: SendRequest) {
    return preview.send(body).catch(toHttp);
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
