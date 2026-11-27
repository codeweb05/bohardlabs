import type {ServerResponse} from 'node:http';

import {applyDecorators, Controller, Get, Inject, Post, Req, Res, type Type} from '@nestjs/common';

import type {NotificationPreview} from '../core/createNotificationPreview.js';
import {InvalidValuesError, UnregisteredNotificationError} from '../core/errors.js';
import type {SendRequest} from '../core/types.js';
import type {NotificationPreviewDecorators} from './options.js';

/** The injection token for the module's `NotificationPreview`. */
export const PREVIEW = Symbol('NotificationPreview');

/** What a body that is not an object reads as: an id nothing is registered under. */
const NO_REQUEST: SendRequest = {id: '', locale: '', values: {}, target: ''};

/**
 * The request as Express parsed it. Its body is read here rather than through `@Body()`, which
 * an app's global pipes would rewrite (a pipe that trims strings would trim a value the
 * reviewer typed). Its shape is unchecked: the core refuses any id or value it does not hold.
 */
interface PreviewRequest {
  readonly body?: SendRequest | null;
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
}

/**
 * Whether the request says its body is JSON, by media type alone (`; charset=utf-8` and other
 * parameters are ignored). A form or `text/plain` post is what another site can make a browser
 * send without asking first, with the reviewer's cookies or Basic credentials attached; JSON
 * from another origin needs a CORS preflight, which the app never grants it.
 */
function isJson(request: PreviewRequest): boolean {
  const header = request.headers['content-type'];
  if (typeof header !== 'string') return false;
  return header.split(';', 1)[0]?.trim().toLowerCase() === 'application/json';
}

const NOT_JSON = {message: 'The request body must be application/json.'};

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

/**
 * Answers `run`'s result, or the package's refusal for an unregistered id (404) or a refused value
 * (422). `render` and `send` answer 415 first when the body is not JSON. Anything else is rethrown, so the app's exception filters handle it as any other error.
 */
async function answer(response: ServerResponse, run: () => unknown): Promise<void> {
  try {
    writeJson(response, 200, await run());
  } catch (error) {
    if (error instanceof UnregisteredNotificationError) writeJson(response, 404, {message: error.message});
    else if (error instanceof InvalidValuesError) writeJson(response, 422, error.toBody());
    else throw error;
  }
}

/**
 * The routes' controller, made for one module: `@Controller(path)` with `GET api/catalog`,
 * `POST api/render` and `POST api/send`, each with `decorators.all` and its own decorators,
 * all on the method, so a guard runs once and a reader of handler metadata sees each one.
 * Each method writes its own response (`@Res()`), so an app's interceptor that reshapes bodies
 * never reaches what the page reads, and reads the body as Express parsed it (`@Req()`), so an
 * app's pipes never rewrite what is rendered.
 *
 * Decorators are applied by call rather than written as `@` syntax, so the package needs no
 * decorator transform and no emitted type metadata; the one dependency is named by `@Inject`.
 */
export function createPreviewController(path: string, decorators: NotificationPreviewDecorators = {}): Type {
  class NotificationPreviewController {
    readonly #preview: NotificationPreview;

    constructor(preview: NotificationPreview) {
      this.#preview = preview;
    }

    catalog(response: ServerResponse): Promise<void> {
      return answer(response, () => this.#preview.catalog());
    }

    async render(request: PreviewRequest, response: ServerResponse): Promise<void> {
      if (!isJson(request)) {
        writeJson(response, 415, NOT_JSON);
        return;
      }
      await answer(response, () => this.#preview.render(request.body ?? NO_REQUEST));
    }

    async send(request: PreviewRequest, response: ServerResponse): Promise<void> {
      if (!isJson(request)) {
        writeJson(response, 415, NOT_JSON);
        return;
      }
      await answer(response, () => this.#preview.send(request.body ?? NO_REQUEST));
    }
  }

  const all = decorators.all ?? [];
  const routes = [
    {name: 'catalog', route: Get('api/catalog'), own: decorators.catalog ?? [], body: false},
    {name: 'render', route: Post('api/render'), own: decorators.render ?? [], body: true},
    {name: 'send', route: Post('api/send'), own: decorators.send ?? [], body: true},
  ] as const;

  const prototype = NotificationPreviewController.prototype;
  for (const {name, route, own, body} of routes) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
    if (descriptor === undefined) throw new Error(`The preview controller has no ${name} method`);
    applyDecorators(route, ...all, ...own)(prototype, name, descriptor);
    if (body) {
      Req()(prototype, name, 0);
      Res()(prototype, name, 1);
    } else {
      Res()(prototype, name, 0);
    }
  }
  Inject(PREVIEW)(NotificationPreviewController, undefined, 0);
  Controller(path)(NotificationPreviewController);
  return NotificationPreviewController;
}
