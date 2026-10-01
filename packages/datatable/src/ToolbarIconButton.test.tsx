/**
 * `ToolbarIconButton` is the trigger for the density and export menus. Its label is the
 * button's only accessible name (the content is an icon), so the name has to survive the
 * toolbar re-rendering and follow a label change, such as a consumer switching locale.
 */
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {render, screen} from './test/test-utils';
import {ToolbarIconButton} from './ToolbarIconButton';

describe('ToolbarIconButton', () => {
  it('names the button after its label and reports clicks', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const icon = <span aria-hidden="true">*</span>;
    const {rerender} = render(
      <ToolbarIconButton label="Density" onClick={onClick}>
        {icon}
      </ToolbarIconButton>,
    );
    const button = screen.getByRole('button', {name: 'Density'});

    // A render that changes nothing leaves the same button in place.
    rerender(
      <ToolbarIconButton label="Density" onClick={onClick}>
        {icon}
      </ToolbarIconButton>,
    );
    expect(screen.getByRole('button', {name: 'Density'})).toBe(button);

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('follows a label change', () => {
    const onClick = vi.fn();
    const icon = <span aria-hidden="true">*</span>;
    const {rerender} = render(
      <ToolbarIconButton label="Density" onClick={onClick}>
        {icon}
      </ToolbarIconButton>,
    );

    rerender(
      <ToolbarIconButton label="Dichte" onClick={onClick}>
        {icon}
      </ToolbarIconButton>,
    );

    expect(screen.getByRole('button', {name: 'Dichte'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Density'})).not.toBeInTheDocument();
  });
});
