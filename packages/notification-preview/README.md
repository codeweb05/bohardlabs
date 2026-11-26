# @vt-labs/notification-preview

A page for looking at every email and push notification an app sends, as the person receiving it would see it,
and for sending one to yourself as a test. It is for the team building the app: developers, testers and whoever
signs off the wording. Nothing on the page is specific to one product; your app supplies the list of
notifications and the code that renders and sends them.

The package has two halves:

- **The server half** (`@vt-labs/notification-preview`) holds a **registry**, the list of notifications the page
  may show, and hands a render or a send to your **provider** for that channel. It refuses an id that is not in the
  registry, or a channel with no provider, before any of your code runs. It has no dependencies and no React.
- **The page half** (`@vt-labs/notification-preview/react`) is one React component, `NotificationPreviewPage`, that
  talks to the server half through a small **client**.

Email and push are the two channels in this release. A new channel ships in a minor version, so code that switches on
a `channel` keeps a default branch.

## Install

```sh
pnpm add @vt-labs/notification-preview
```

React 19 is a peer, needed only by the page half.

## The server half

```ts
import {
  createNotificationPreview,
  InvalidValuesError,
  UnregisteredNotificationError,
  type RegistryEntry,
} from '@vt-labs/notification-preview';

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
  languages: ['en', 'es'],
  providers: {
    email: {
      render: (id, values, lang) => mailer.render(id, values, lang), // {subject, html, text, warnings?}
      send: async (id, values, lang, to) => ({messageId: await mailer.send(id, values, lang, to)}),
    },
    push: {
      render: (id, values, lang) => pushes.render(id, values, lang), // {title, body, warnings?}
      send: (id, values, lang, account) => pushes.sendToAccount(account, id, values, lang), // {devices, sent, failed, removed}
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

## The page half

```tsx
import {createFetchClient, NotificationPreviewPage} from '@vt-labs/notification-preview/react';
import '@vt-labs/notification-preview/style.css';

const client = createFetchClient({
  baseUrl: '/api/notification-preview',
  headers: () => ({Authorization: `Bearer ${getToken()}`}),
});

export function NotificationsPage() {
  return <NotificationPreviewPage client={client} environment="staging" />;
}
```

`client` is anything that implements `PreviewClient` (`catalog`, `render`, `send`), so an app with its own HTTP client
writes its own. A failed call should reject with a `PreviewClientError`.

### Props

| Prop          | Type                                  | What it does                                                                                                                |
| ------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `client`      | `PreviewClient`                       | How the page reaches the server half. Required.                                                                             |
| `strings`     | `Partial<NotificationPreviewStrings>` | Any of the page's words. The rest keep their English default. Keys are added in minors, so type a translation as `Partial`. |
| `environment` | `string`                              | A short name for the server, such as `staging`, beside the title                                                            |
| `storageKey`  | `string`                              | The localStorage prefix, `vt-labs.notification-preview` by default                                                          |

### Theme and colours

Every colour is a `--np-*` custom property on `.np-root`, with a light and a dark value. The page follows the
system theme, and a reader can pick Light or Dark, which this browser keeps. Override a colour on `.np-root`; the
defaults sit under `:where()`, so your rule wins whichever stylesheet loads last. The font is `--np-font`.

```css
.np-root {
  --np-accent: light-dark(#0b7a5c, #6fd6b4);
}
```

The rendered email sits in a `sandbox=""` frame that none of the page's styles reach, so nothing in a mail runs.

## What the page does

- Lists the registry by channel, with a search over label, id and trigger. `/` goes to the search; the arrow keys
  move between notifications.
- Renders the open notification with its samples, at desktop or phone width, as HTML or plain text; a push on an
  iPhone or Android lock screen or banner.
- Edits each variable in a field typed by its spec, with presets for long, empty and awkward values.
- Shows the trigger, the recipient, the subject or title, the HTML size, and copies the HTML or text.
- Sends a test to an address or an account, and offers the last five targets again.
