// @vitest-environment node
import 'reflect-metadata';
import {
  HttpException,
  Module,
  SetMetadata,
  UnauthorizedException,
  type CallHandler,
  type CanActivate,
  type DynamicModule,
  type ExecutionContext,
  type INestApplication,
  type NestInterceptor,
  type PipeTransform,
  UseGuards,
} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {Test} from '@nestjs/testing';
import {map, type Observable} from 'rxjs';
import request from 'supertest';
import {expectTypeOf} from 'vitest';

import {InvalidValuesError} from '../core/errors.js';
import type {ChannelProvider, Providers} from '../core/types.js';
import {CATALOG} from '../test/fakeClient.js';
import {NotificationPreviewModule} from './NotificationPreviewModule.js';
import type {NotificationPreviewModuleAsyncOptions, NotificationPreviewModuleOptions} from './options.js';
import {pageHeaders} from './pageHeaders.js';

vi.mock('./uiDir.js', async () => {
  const {fileURLToPath} = await import('node:url');
  return {UI_DIR: fileURLToPath(new URL('fixtures/ui', import.meta.url))};
});

const PATH = '/notification-preview';

const email: ChannelProvider<'email'> = {
  locales: () => ['en', 'es'],
  render: (id, values) => ({subject: `Subject of ${id}`, html: `<p>${values['firstName'] ?? ''}</p>`, text: 'Text'}),
  send: (_id, _values, _locale, target) => {
    if (target === 'refuse@example.com') throw new InvalidValuesError({target: 'Not a test address.'});
    return {messageId: 'msg-1'};
  },
};

const push: ChannelProvider<'push'> = {
  locales: () => ['en'],
  render: () => ({title: 'Due soon', body: 'Water the plants'}),
  send: () => ({devices: 1, sent: 1, failed: 0, removed: 0}),
};

const PROVIDERS: Providers = {email, push};

// What an app might put on its own routes: an auth guard every route passes only when marked
// public, and a limit marked per route. The guards read handler metadata, as an app's do.
const IS_PUBLIC = 'test:public';
const LIMITED = 'test:limited';
const Public = () => SetMetadata(IS_PUBLIC, true);
const Limited = () => SetMetadata(LIMITED, true);

class AuthGuard implements CanActivate {
  readonly #reflector: Reflector;
  constructor(reflector: Reflector) {
    this.#reflector = reflector;
  }
  canActivate(context: ExecutionContext): boolean {
    if (this.#reflector.get<boolean | undefined>(IS_PUBLIC, context.getHandler()) === true) return true;
    throw new UnauthorizedException({error: {code: 'UNAUTHENTICATED'}});
  }
}

class LimitGuard implements CanActivate {
  readonly #reflector: Reflector;
  constructor(reflector: Reflector) {
    this.#reflector = reflector;
  }
  canActivate(context: ExecutionContext): boolean {
    if (this.#reflector.get<boolean | undefined>(LIMITED, context.getHandler()) !== true) return true;
    context
      .switchToHttp()
      .getResponse<{setHeader: (name: string, value: string) => void}>()
      .setHeader('Retry-After', '60');
    throw new HttpException({message: 'Too many requests.'}, 429);
  }
}

/** An app interceptor that wraps every body it sees. */
class WrapInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data: unknown) => ({data})));
  }
}

/** An app pipe that trims every string in a body, as an app may register for its own routes. */
class TrimPipe implements PipeTransform {
  transform(value: unknown): unknown {
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value)) return value.map((item: unknown) => this.transform(item));
    if (typeof value === 'object' && value !== null)
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, this.transform(item)]));
    return value;
  }
}

async function boot(module: DynamicModule): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({imports: [module]}).compile();
  const app = moduleRef.createNestApplication({logger: false});
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new AuthGuard(reflector), new LimitGuard(reflector));
  app.useGlobalInterceptors(new WrapInterceptor());
  app.useGlobalPipes(new TrimPipe());
  await app.init();
  return app;
}

const OPTIONS = {
  path: PATH,
  enabled: true,
  registry: CATALOG.entries,
  providers: PROVIDERS,
  appName: 'Acme',
  environment: 'DEV',
  decorators: {all: [Public()], send: [Limited()]},
} as const;

// The catalog's fingerprints: each entry in each locale its channel's provider lists.
const HASH = expect.stringMatching(/^[0-9a-f]{8}$/u);
const FINGERPRINTS = {
  welcome: {en: HASH, es: HASH},
  'invoice-due': {en: HASH, es: HASH},
  'task-reminder': {en: HASH},
  'weekly-summary': {en: HASH},
};

const configOf = (html: string): unknown => {
  const match = /<script type="application\/json" id="np-config">([\s\S]*?)<\/script>/.exec(html);
  return JSON.parse(match?.[1] ?? 'null');
};

describe('NotificationPreviewModule routes', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await boot(NotificationPreviewModule.forRoot(OPTIONS));
  });
  afterAll(async () => {
    await app.close();
  });

  it('answers the catalog raw, past an interceptor that wraps bodies, with channels from the providers', async () => {
    const response = await request(app.getHttpServer()).get(`${PATH}/api/catalog`).expect(200);
    expect(response.body).toEqual({
      entries: CATALOG.entries,
      locales: {email: ['en', 'es'], push: ['en']},
      fingerprints: FINGERPRINTS,
    });
  });

  it('answers a render raw with 200', async () => {
    const response = await request(app.getHttpServer())
      .post(`${PATH}/api/render`)
      .send({id: 'welcome', locale: 'en', values: {firstName: 'Ada'}})
      .expect(200);
    expect(response.body).toMatchObject({channel: 'email', subject: 'Subject of welcome', html: '<p>Ada</p>'});
  });

  it('answers 404 {message} for an unregistered id', async () => {
    const response = await request(app.getHttpServer())
      .post(`${PATH}/api/render`)
      .send({id: 'nope', locale: 'en', values: {}})
      .expect(404);
    expect(response.body).toEqual({message: 'No notification "nope" is registered.'});
  });

  it('answers 422 with fieldErrors for a refused value', async () => {
    const response = await request(app.getHttpServer())
      .post(`${PATH}/api/render`)
      .send({id: 'welcome', locale: 'en', values: {firstName: 5}})
      .expect(422);
    expect(response.body).toEqual({message: 'A value was refused.', fieldErrors: {firstName: 'Must be a string.'}});
  });

  it('puts decorators.all on all three routes, so the auth guard lets each through', async () => {
    const server = app.getHttpServer();
    const catalog = await request(server).get(`${PATH}/api/catalog`);
    const render = await request(server)
      .post(`${PATH}/api/render`)
      .send({id: 'task-reminder', locale: 'en', values: {}});
    // The send's 429 comes from the limit guard, which runs after the auth guard let it through.
    const send = await request(server)
      .post(`${PATH}/api/send`)
      .send({id: 'task-reminder', locale: 'en', values: {}, target: 'x'});
    expect([catalog.status, render.status, send.status]).toEqual([200, 200, 429]);
  });

  it('puts decorators.send on send only: render and catalog are not limited', async () => {
    const server = app.getHttpServer();
    const limited = await request(server)
      .post(`${PATH}/api/send`)
      .send({id: 'welcome', locale: 'en', values: {}, target: 'ada@example.com'})
      .expect(429);
    expect(limited.headers['retry-after']).toBe('60');
    expect(limited.body).toMatchObject({message: 'Too many requests.'});
    await request(server).post(`${PATH}/api/render`).send({id: 'welcome', locale: 'en', values: {}}).expect(200);
  });

  it('passes the body as sent, past an app pipe that trims every string', async () => {
    const response = await request(app.getHttpServer())
      .post(`${PATH}/api/render`)
      .send({id: 'welcome', locale: 'en', values: {firstName: '  Ada  '}})
      .expect(200);
    expect(response.body).toMatchObject({html: '<p>  Ada  </p>'});
  });

  it('runs a guard in decorators.all once per request, on each of the three routes', async () => {
    const seen: string[] = [];
    const counting: CanActivate = {
      canActivate: (context: ExecutionContext) => {
        seen.push(context.getHandler().name);
        return true;
      },
    };
    const counted = await boot(
      NotificationPreviewModule.forRoot({
        ...OPTIONS,
        path: '/counted-preview',
        decorators: {all: [Public(), UseGuards(counting)]},
      }),
    );
    try {
      const server = counted.getHttpServer();
      await request(server).get('/counted-preview/api/catalog');
      await request(server).post('/counted-preview/api/render').send({id: 'task-reminder', locale: 'en', values: {}});
      await request(server)
        .post('/counted-preview/api/send')
        .send({id: 'task-reminder', locale: 'en', values: {}, target: 'ada@example.com'});
      expect(seen).toEqual(['catalog', 'render', 'send']);
    } finally {
      await counted.close();
    }
  });

  it('leaves a route without decorators.all to the app guard', async () => {
    const closed = await boot(NotificationPreviewModule.forRoot({...OPTIONS, path: '/closed-preview', decorators: {}}));
    try {
      const response = await request(closed.getHttpServer()).get('/closed-preview/api/catalog').expect(401);
      expect(response.body).toEqual({error: {code: 'UNAUTHENTICATED'}});
    } finally {
      await closed.close();
    }
  });
});

describe('NotificationPreviewModule send', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await boot(NotificationPreviewModule.forRoot({...OPTIONS, decorators: {all: [Public()]}}));
  });
  afterAll(async () => {
    await app.close();
  });

  it('answers a send raw with 200', async () => {
    const response = await request(app.getHttpServer())
      .post(`${PATH}/api/send`)
      .send({id: 'task-reminder', locale: 'en', values: {}, target: 'ada@example.com'})
      .expect(200);
    expect(response.body).toEqual({channel: 'push', devices: 1, sent: 1, failed: 0, removed: 0});
  });

  it("answers 422 with the provider's fieldErrors for a refused target", async () => {
    const response = await request(app.getHttpServer())
      .post(`${PATH}/api/send`)
      .send({id: 'welcome', locale: 'en', values: {}, target: 'refuse@example.com'})
      .expect(422);
    expect(response.body).toEqual({message: 'A value was refused.', fieldErrors: {target: 'Not a test address.'}});
  });
});

describe('NotificationPreviewModule page', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await boot(NotificationPreviewModule.forRoot({...OPTIONS, appName: 'Acme </script><b>x'}));
  });
  afterAll(async () => {
    await app.close();
  });

  it('serves the page with its headers and its settings written in', async () => {
    const response = await request(app.getHttpServer()).get(PATH).expect(200);
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
    for (const [name, value] of Object.entries(pageHeaders())) expect(response.headers[name.toLowerCase()]).toBe(value);
    expect(configOf(response.text)).toEqual({
      apiBase: `${PATH}/api`,
      appName: 'Acme </script><b>x',
      environment: 'DEV',
      strings: {},
      storageKey: `notification-preview:${PATH}`,
    });
  });

  it('escapes a </script> in the settings, so it cannot close the block', async () => {
    const response = await request(app.getHttpServer()).get(PATH).expect(200);
    expect(response.text).not.toContain('</script><b>x');
    expect(response.text).toContain(String.raw`\u003c/script>\u003cb>x`);
  });

  it('serves the page at a trailing slash too, with asset links under the path', async () => {
    const response = await request(app.getHttpServer()).get(`${PATH}/`).expect(200);
    expect(response.text).toContain(`src="${PATH}/assets/app-test.js"`);
    expect(response.text).toContain(`href="${PATH}/assets/app-test.css"`);
  });

  it('serves a built asset cached for good', async () => {
    const response = await request(app.getHttpServer()).get(`${PATH}/assets/app-test.js`).expect(200);
    expect(response.headers['content-type']).toBe('text/javascript; charset=utf-8');
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(response.text).toContain("export const fixture = 'app-test';");
  });

  it('passes a missing asset and a path outside assets on to the app, which answers 404', async () => {
    const server = app.getHttpServer();
    const missing = await request(server).get(`${PATH}/assets/missing.js`);
    const outside = await request(server).get(`${PATH}/assets/..%2Findex.html`);
    expect([missing.status, outside.status]).toEqual([404, 404]);
  });
});

describe('NotificationPreviewModule disabled', () => {
  it('registers no page and no route', async () => {
    const app = await boot(NotificationPreviewModule.forRoot({...OPTIONS, enabled: false}));
    try {
      const page = await request(app.getHttpServer()).get(PATH);
      const catalog = await request(app.getHttpServer()).get(`${PATH}/api/catalog`);
      expect([page.status, catalog.status]).toEqual([404, 404]);
    } finally {
      await app.close();
    }
  });

  it('never calls the async factory', async () => {
    const useFactory = vi.fn(() => ({registry: CATALOG.entries, providers: PROVIDERS, appName: 'Acme'}));
    const app = await boot(NotificationPreviewModule.forRootAsync({path: PATH, enabled: false, useFactory}));
    try {
      const page = await request(app.getHttpServer()).get(PATH);
      const catalog = await request(app.getHttpServer()).get(`${PATH}/api/catalog`);
      expect([page.status, catalog.status]).toEqual([404, 404]);
      expect(useFactory).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});

describe('NotificationPreviewModule.forRootAsync', () => {
  /** An app's config service, as `@nestjs/config` would provide one. */
  class AppConfig {
    readonly appName = 'From config';
  }
  class ConfigModule {
    readonly provides = AppConfig;
  }
  Module({providers: [AppConfig], exports: [AppConfig]})(ConfigModule);

  let app: INestApplication;
  beforeAll(async () => {
    app = await boot(
      NotificationPreviewModule.forRootAsync({
        path: PATH,
        enabled: true,
        imports: [ConfigModule],
        inject: [AppConfig],
        useFactory: (config: AppConfig) => ({registry: CATALOG.entries, providers: PROVIDERS, appName: config.appName}),
        decorators: {all: [Public()]},
      }),
    );
  });
  afterAll(async () => {
    await app.close();
  });

  it('builds the same routes from the injected config', async () => {
    const response = await request(app.getHttpServer()).get(`${PATH}/api/catalog`).expect(200);
    expect(response.body).toEqual({
      entries: CATALOG.entries,
      locales: {email: ['en', 'es'], push: ['en']},
      fingerprints: FINGERPRINTS,
    });
  });

  it('writes the injected app name into the page', async () => {
    const response = await request(app.getHttpServer()).get(PATH).expect(200);
    expect(configOf(response.text)).toMatchObject({appName: 'From config', environment: null});
  });
});

describe('NotificationPreviewModule enabled', () => {
  it('is required, with no default, in both forms', () => {
    expectTypeOf<NotificationPreviewModuleOptions['enabled']>().toEqualTypeOf<boolean>();
    expectTypeOf<NotificationPreviewModuleAsyncOptions['enabled']>().toEqualTypeOf<boolean>();
  });

  it('checks the path even when disabled, so a typo shows before the flag is turned on', () => {
    const useFactory = vi.fn(() => ({registry: CATALOG.entries, providers: PROVIDERS, appName: 'Acme'}));
    expect(() => NotificationPreviewModule.forRoot({...OPTIONS, enabled: false, path: 'preview'})).toThrow(
      /must start with a slash/,
    );
    expect(() => NotificationPreviewModule.forRootAsync({path: '/preview/', enabled: false, useFactory})).toThrow(
      /must start with a slash/,
    );
  });
});

describe('NotificationPreviewModule storage key', () => {
  it('defaults to one per path, so two previews on one origin keep apart', async () => {
    const other = await boot(NotificationPreviewModule.forRoot({...OPTIONS, path: '/admin/preview'}));
    try {
      const response = await request(other.getHttpServer()).get('/admin/preview').expect(200);
      expect(configOf(response.text)).toMatchObject({storageKey: 'notification-preview:/admin/preview'});
    } finally {
      await other.close();
    }
  });
});

describe('NotificationPreviewModule path', () => {
  it.each([
    'notification-preview',
    '/notification-preview/',
    '/a b',
    '/a"b',
    '/',
    '/.',
    '/..',
    '/a/./b',
    '/a/../b',
    '/a/..',
  ])('refuses %j', (path) => {
    expect(() => NotificationPreviewModule.forRoot({...OPTIONS, path})).toThrow(/must start with a slash/);
  });

  it.each(['/notification-preview', '/admin/notification-preview', '/a.b/c~d', '/...'])('takes %j', (path) => {
    expect(() => NotificationPreviewModule.forRoot({...OPTIONS, path})).not.toThrow();
  });
});
