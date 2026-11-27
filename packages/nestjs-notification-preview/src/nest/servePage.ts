import {readdirSync, readFileSync} from 'node:fs';
import type {IncomingMessage, ServerResponse} from 'node:http';
import {extname, join} from 'node:path';

import type {PageConfig} from '../pageSettings.js';
import {assetHeaders, pageHeaders} from './pageHeaders.js';

/** A request as Express hands it to a middleware: Node's, plus the URL before a mount path was cut. */
export interface PageRequest extends IncomingMessage {
  readonly originalUrl?: string;
}

/** An Express middleware: it answers the page and its assets, and passes anything else on. */
export type PageHandler = (request: PageRequest, response: ServerResponse, next: () => void) => void;

const CONFIG_BLOCK = /<script type="application\/json" id="np-config">[\s\S]*?<\/script>/;

const CONTENT_TYPES: Readonly<Partial<Record<string, string>>> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

/** `value` as JSON that cannot close the script element it is written into. */
const scriptJson = (value: unknown): string => JSON.stringify(value).replaceAll('<', String.raw`\u003c`);

/**
 * The built page with `config` written into its settings block, and its asset links made
 * absolute under `path`. The build links them as `./assets/…`, which from `<path>` with no
 * trailing slash would resolve beside it rather than under it.
 */
export function pageHtml(template: string, path: string, config: PageConfig): string {
  if (!CONFIG_BLOCK.test(template)) throw new Error('The notification preview page has no settings block');
  const block = `<script type="application/json" id="np-config">${scriptJson(config)}</script>`;
  // Replacer functions, so a `$` in the settings is never read as a replacement pattern.
  return template.replace(CONFIG_BLOCK, () => block).replaceAll('="./assets/', () => `="${path}/assets/`);
}

function send(response: ServerResponse, headers: Readonly<Record<string, string>>, body: Buffer): void {
  response.statusCode = 200;
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
  response.setHeader('Content-Length', body.byteLength);
  response.end(body);
}

/**
 * Serves `GET <path>` and `GET <path>/` as the page, and `GET <path>/assets/<name>` as one of the
 * built page's hashed files. Everything is read once, here, so a request touches no disk, and
 * only a file the build put in `assets/` can be asked for by name. Any other request, a missing
 * asset among them, goes on to the app.
 */
export function createPageHandler(options: {
  readonly path: string;
  readonly config: PageConfig;
  readonly uiDir: string;
}): PageHandler {
  const {path, config, uiDir} = options;
  const html = Buffer.from(pageHtml(readFileSync(join(uiDir, 'index.html'), 'utf8'), path, config));
  const assetsDir = join(uiDir, 'assets');
  const assets = new Map(readdirSync(assetsDir).map((name) => [name, readFileSync(join(assetsDir, name))]));
  const assetPrefix = `${path}/assets/`;

  return (request, response, next) => {
    const [pathname = ''] = (request.originalUrl ?? request.url ?? '').split('?');
    if (pathname === path || pathname === `${path}/`) {
      send(response, {...pageHeaders(), 'Content-Type': 'text/html; charset=utf-8'}, html);
      return;
    }
    const name = pathname.startsWith(assetPrefix) ? pathname.slice(assetPrefix.length) : '';
    const asset = assets.get(name);
    if (asset === undefined) {
      next();
      return;
    }
    send(
      response,
      {...assetHeaders(), 'Content-Type': CONTENT_TYPES[extname(name)] ?? 'application/octet-stream'},
      asset,
    );
  };
}
