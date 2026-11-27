import {mountPage} from './mountPage.js';

// The served page: the module writes its settings into the HTML, and nothing else is read.
// The stylesheet is linked from index.html, so the page build bundles it.
mountPage(document);
