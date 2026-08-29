/**
 * Coverage for `DensityToggle`.
 *
 * Density is persisted per table, so the menu is the only place a user can get a
 * mis-saved value back; the selection path is what these pin down.
 *
 * The block at the bottom records an issue found while writing these.
 */
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {DEFAULT_LABELS} from '../i18n';
import {DataTableLabelsProvider} from '../i18n';
import {render, screen} from '../test/test-utils';
import {DensityToggle} from './DensityToggle';

const onChange = vi.fn();

const DENSITY_LABEL = DEFAULT_LABELS.densityLabel;
const COMPACT = DEFAULT_LABELS.densityCompact;
const COMFORTABLE = DEFAULT_LABELS.densityComfortable;
const SPACIOUS = DEFAULT_LABELS.densitySpacious;

beforeEach(() => {
  onChange.mockReset();
});

async function openMenu() {
  await userEvent.click(screen.getByRole('button', {name: DENSITY_LABEL}));
}

describe('DensityToggle', () => {
  it('renders a labelled trigger', () => {
    render(<DensityToggle density="comfortable" onChange={onChange} />);

    expect(screen.getByRole('button', {name: DENSITY_LABEL})).toBeInTheDocument();
  });

  it('keeps the menu closed until it is asked for', () => {
    render(<DensityToggle density="comfortable" onChange={onChange} />);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('offers all three densities', async () => {
    render(<DensityToggle density="comfortable" onChange={onChange} />);

    await openMenu();

    expect(screen.getByRole('menuitem', {name: COMPACT})).toBeInTheDocument();
    expect(screen.getByRole('menuitem', {name: COMFORTABLE})).toBeInTheDocument();
    expect(screen.getByRole('menuitem', {name: SPACIOUS})).toBeInTheDocument();
  });

  it('reports the chosen density', async () => {
    render(<DensityToggle density="comfortable" onChange={onChange} />);
    await openMenu();

    await userEvent.click(screen.getByRole('menuitem', {name: COMPACT}));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('compact');
  });

  it('closes after a choice', async () => {
    render(<DensityToggle density="comfortable" onChange={onChange} />);
    await openMenu();

    await userEvent.click(screen.getByRole('menuitem', {name: SPACIOUS}));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('marks the current density in the menu', async () => {
    // Without it the menu gives no clue which density is in force.
    render(<DensityToggle density="spacious" onChange={onChange} />);

    await openMenu();

    expect(screen.getByRole('menuitem', {name: SPACIOUS})).toHaveClass('Mui-selected');
    expect(screen.getByRole('menuitem', {name: COMPACT})).not.toHaveClass('Mui-selected');
  });

  it('closes on dismiss without reporting a change', async () => {
    render(<DensityToggle density="comfortable" onChange={onChange} />);
    await openMenu();

    await userEvent.keyboard('{Escape}');

    expect(onChange).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// KNOWN ISSUE — toolbar/DensityToggle.tsx:23, :28, :33, :47 and :51
//
//   label: t('dataTable.density.compact') ?? 'Compact',
//   aria-label={t('dataTable.density.label') ?? 'Density'}
//
// `t()` never returns null or undefined — i18next returns the KEY when a translation is
// missing — so all five `??` fallbacks are dead code. Removing
// `dataTable.density.*` from en.json does not produce "Compact"; it produces a menu
// reading "dataTable.density.compact" and a button announced as
// "dataTable.density.label".
//
// This is the same defect that was fixed in `EditActions` (see its regression block);
// the fix there was `t(key, {defaultValue: …})`, which is what actually falls back.
// `ExportMenu.tsx:92` has the last remaining copy of the pattern.
//
// EXPECTED TO FAIL until the fallbacks use `defaultValue`.
// ===========================================================================

describe('the density labels come from `labels`', () => {
  it('renders overrides instead of the defaults', async () => {
    render(
      <DataTableLabelsProvider
        labels={{
          densityLabel: 'Densite',
          densityCompact: 'Dense',
          densityComfortable: 'Normal',
          densitySpacious: 'Aere',
        }}
      >
        <DensityToggle density="comfortable" onChange={onChange} />
      </DataTableLabelsProvider>,
    );

    await userEvent.click(screen.getByRole('button', {name: 'Densite'}));

    expect(screen.getByRole('menuitem', {name: 'Dense'})).toBeInTheDocument();
    expect(screen.getByRole('menuitem', {name: 'Normal'})).toBeInTheDocument();
    expect(screen.getByRole('menuitem', {name: 'Aere'})).toBeInTheDocument();
  });
});
