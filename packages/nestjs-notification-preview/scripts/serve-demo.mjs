// A Nest app serving the built package, to look at the page and click through it by hand.
// Build first (`pnpm build`), then `pnpm serve:demo [port]`. Its notifications and providers
// are made up; a send goes nowhere. Not published: scripts/ is outside `files`.
// `@nestjs/common` loads reflect-metadata itself.
import {Module} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';

import {InvalidValuesError, NotificationPreviewModule} from '../dist/index.js';

const port = Number(process.argv[2] ?? 4400);
const path = '/notification-preview';

const registry = [
  {
    id: 'order-shipped',
    channel: 'email',
    label: 'Order shipped',
    recipient: 'The buyer',
    trigger: 'An order leaves the warehouse.',
    variables: [
      {name: 'orderNumber', type: 'text', sample: 'A-1042'},
      {name: 'trackingUrl', type: 'url', sample: 'https://example.com/track/A-1042'},
      {name: 'shippedAt', type: 'datetime', sample: '2026-03-02T14:00:00.000Z'},
    ],
  },
  {
    id: 'plan-renewal',
    channel: 'email',
    label: 'Plan renewal',
    trigger: 'A plan renews in seven days.',
    variables: [
      {name: 'tier', type: 'enum', options: ['starter', 'team'], sample: 'team'},
      {name: 'seats', type: 'number', sample: '12'},
    ],
  },
  {
    id: 'match-starting',
    channel: 'push',
    label: 'Match starting',
    recipient: 'A follower of either team',
    trigger: 'A followed match starts in ten minutes.',
    variables: [{name: 'teams', type: 'text', sample: 'Lions v Hawks'}],
  },
];

const words = {
  en: {hi: 'Hi', shipped: 'is on its way', renews: 'renews next week', kickoff: 'Kick-off soon'},
  fr: {hi: 'Bonjour', shipped: 'est en route', renews: 'se renouvelle la semaine prochaine', kickoff: 'Coup d’envoi'},
};

const say = (locale) => words[locale] ?? words.en;

const escapeHtml = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const page = (heading, line) =>
  `<!doctype html><html><body style="margin:0;font-family:Georgia,serif;background:#f4f1ea">` +
  `<div style="max-width:520px;margin:24px auto;background:#fff;padding:24px;border-radius:8px">` +
  `<h1 style="font-size:20px">${escapeHtml(heading)}</h1><p>${escapeHtml(line)}</p></div></body></html>`;

const email = {
  locales: () => ['en', 'fr'],
  render: (id, values, locale) => {
    const w = say(locale);
    if (id === 'order-shipped') {
      const url = values.trackingUrl ?? '';
      if (url !== '' && !url.startsWith('https://'))
        throw new InvalidValuesError({trackingUrl: 'Must start with https://.'});
      const line = `${w.hi}, order ${values.orderNumber ?? ''} ${w.shipped}. ${url}`;
      return {subject: `Order ${values.orderNumber ?? ''}`, html: page(w.hi, line), text: line};
    }
    const line = `${w.hi}, ${values.tier ?? ''} (${values.seats ?? ''}) ${w.renews}.`;
    return {
      subject: 'Renewal',
      html: page(w.hi, line),
      text: line,
      warnings: locale === 'fr' ? ['Subject not translated.'] : [],
    };
  },
  send: (_id, _values, _locale, target) => {
    if (!target.endsWith('@example.com')) throw new InvalidValuesError({target: 'Use an @example.com address.'});
    return {messageId: `demo-${String(Date.now())}`};
  },
};

const push = {
  locales: () => ['en', 'fr'],
  render: (_id, values, locale) => ({title: say(locale).kickoff, body: values.teams ?? ''}),
  send: () => ({devices: 2, sent: 2, failed: 0, removed: 0}),
};

class DemoModule {
  servedAt = path;
}
Module({
  imports: [
    NotificationPreviewModule.forRoot({
      path,
      enabled: true,
      registry,
      providers: {email, push},
      appName: 'Acme',
      environment: 'DEV',
    }),
  ],
})(DemoModule);

const app = await NestFactory.create(DemoModule, {logger: ['error', 'warn']});
await app.listen(port);
console.log(`Notification preview demo: http://localhost:${String(port)}${path}`);
