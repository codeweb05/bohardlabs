import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';

import {createPageClient} from './client.js';
import {readPageConfig} from './config.js';
import {NotificationPreviewPage} from './NotificationPreviewPage.js';
import {mergeStrings} from './strings.js';

// The served page: the module writes its settings into the HTML, and nothing else is read.
// The stylesheet is linked from index.html.
const config = readPageConfig(document);
const root = document.getElementById('root');
if (root === null) throw new Error('The notification preview page has no #root');

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
