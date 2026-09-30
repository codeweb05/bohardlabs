import {render, screen} from '@testing-library/react';

import {FormConfigProvider, useFormConfig} from './FormConfigContext.js';
import {DEFAULT_FORM_LABELS} from './labels.js';

function Probe() {
  const {labels, formatError} = useFormConfig();
  return (
    <p>
      {labels.cancel}|{labels.showPassword}|{formatError({message: 'raw'})}
    </p>
  );
}

describe('FormConfigProvider', () => {
  it('gives English defaults outside a provider', () => {
    render(<Probe />);
    expect(
      screen.getByText(`${DEFAULT_FORM_LABELS.cancel}|${DEFAULT_FORM_LABELS.showPassword}|raw`),
    ).toBeInTheDocument();
  });

  it('merges partial labels over the defaults and uses the given formatError', () => {
    render(
      <FormConfigProvider labels={{cancel: 'Abbrechen'}} formatError={(issue) => `!${issue.message}`}>
        <Probe />
      </FormConfigProvider>,
    );
    expect(screen.getByText(`Abbrechen|${DEFAULT_FORM_LABELS.showPassword}|!raw`)).toBeInTheDocument();
  });
});
