import {screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';

import {mountPage} from './mountPage.js';

const pageWith = (block: string): void => {
  document.head.innerHTML = block;
  document.body.innerHTML = '<div id="root"></div>';
};

describe('mountPage', () => {
  it('shows why when the settings block is not the settings', () => {
    pageWith('<script type="application/json" id="np-config">{not json</script>');
    mountPage(document);
    expect(screen.getByRole('alert')).toHaveTextContent('Notification preview settings are malformed');
  });

  it('shows why when the settings block is missing', () => {
    pageWith('');
    mountPage(document);
    expect(screen.getByRole('alert')).toHaveTextContent('Notification preview settings are missing');
  });
});
