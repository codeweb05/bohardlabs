/**
 * `DataTableLabelsProvider` is how a consumer translates the table. There is no i18n
 * framework in the package, so a language switch reaches the table as a new `labels`
 * object on an otherwise unchanged tree, and every reader has to pick it up.
 */
import {describe, expect, it} from 'vitest';

import {render, screen} from '../test/test-utils';
import {DEFAULT_LABELS} from './labels';
import {DataTableLabelsProvider, useLabels} from './LabelsContext';

function SearchLabel() {
  return <p>{useLabels().search}</p>;
}

describe('DataTableLabelsProvider', () => {
  it('serves the English defaults outside a provider', () => {
    render(<SearchLabel />);

    expect(screen.getByText(DEFAULT_LABELS.search)).toBeInTheDocument();
  });

  it('fills the gaps in a partial set with the defaults', () => {
    function Probe() {
      const labels = useLabels();
      return <p>{`${labels.search} | ${labels.actions}`}</p>;
    }
    render(
      <DataTableLabelsProvider labels={{search: 'Suchen'}}>
        <Probe />
      </DataTableLabelsProvider>,
    );

    expect(screen.getByText(`Suchen | ${DEFAULT_LABELS.actions}`)).toBeInTheDocument();
  });

  it('reaches a subtree that did not re-render on its own when the labels change', () => {
    const subtree = <SearchLabel />;
    const {rerender} = render(<DataTableLabelsProvider labels={{search: 'Suchen'}}>{subtree}</DataTableLabelsProvider>);
    expect(screen.getByText('Suchen')).toBeInTheDocument();

    rerender(<DataTableLabelsProvider labels={{search: 'Rechercher'}}>{subtree}</DataTableLabelsProvider>);

    expect(screen.getByText('Rechercher')).toBeInTheDocument();
    expect(screen.queryByText('Suchen')).not.toBeInTheDocument();
  });
});
