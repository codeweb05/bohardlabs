import type {ServerResponse} from 'node:http';

import {applyDecorators, Body, Controller, Get, Inject, Post, Res, type Type} from '@nestjs/common';

import type {NotificationPreview} from '../core/createNotificationPreview.js';
import {InvalidValuesError, UnregisteredNotificationError} from '../core/errors.js';
import type {RenderRequest, SendRequest} from '../core/types.js';
import type {NotificationPreviewDecorators} from './options.js';

/** The injection token for the module's `NotificationPreview`. */
export const PREVIEW = Symbol('NotificationPreview');

/** What a body that is not an object reads as: an id nothing is registered under. */
const NO_REQUEST: SendRequest = {id: '', locale: '', values: {}, target: ''};

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

/**
 * Answers `run`'s result, or the package's refusal for an unregistered id (404) or a refused value
 * (422). Anything else is rethrown, so the app's exception filters handle it as any other error.
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
 * `POST api/render` and `POST api/send`, each with `decorators.all` and its own decorators.
 * Each method writes its own response (`@Res()`), so an app's interceptor that reshapes bodies
 * never reaches what the page reads.
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

    render(body: RenderRequest | null | undefined, response: ServerResponse): Promise<void> {
      return answer(response, () => this.#preview.render(body ?? NO_REQUEST));
    }

    send(body: SendRequest | null | undefined, response: ServerResponse): Promise<void> {
      return answer(response, () => this.#preview.send(body ?? NO_REQUEST));
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
      Body()(prototype, name, 0);
      Res()(prototype, name, 1);
    } else {
      Res()(prototype, name, 0);
    }
  }
  Inject(PREVIEW)(NotificationPreviewController, undefined, 0);
  applyDecorators(Controller(path), ...all)(NotificationPreviewController);
  return NotificationPreviewController;
}
