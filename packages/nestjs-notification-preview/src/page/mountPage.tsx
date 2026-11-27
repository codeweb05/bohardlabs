import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';

import {createPageClient} from './client.js';
import {readPageConfig, type PageConfig} from './config.js';
import {NotificationPreviewPage} from './NotificationPreviewPage.js';
import {mergeStrings} from './strings.js';

/**
 * Renders the page into `doc`'s `#root` from the settings the module wrote into it. Settings
 * that cannot be read leave a plain message saying why, rather than an empty page. That
 * message is the only text not taken from the settings, since without them there are none.
 */
export function mountPage(doc: Document): void {
  const root = doc.getElementById('root');
  if (root === null) throw new Error('The notification preview page has no #root');
  let config: PageConfig;
  try {
    config = readPageConfig(doc);
  } catch (error) {
    const message = doc.createElement('p');
    message.setAttribute('role', 'alert');
    message.textContent = error instanceof Error ? error.message : String(error);
    root.replaceChildren(message);
    return;
  }
  createRoot(root).render(
    <StrictMode>
      <NotificationPreviewPage
        client={createPageClient(config.apiBase, undefined, mergeStrings(config.strings).failure)}
        appName={config.appName}
        environment={config.environment}
        strings={config.strings}
        storageKey={config.storageKey}
      />
    </StrictMode>,
  );
}
