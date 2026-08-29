/**
 * Coverage for `EmptyState`, previously 72%.
 *
 * The uncovered half was every optional prop: description, custom icon, and the call
 * to action. The DataTable itself only ever passes `message`
 * (DataTable.tsx:366), so the rest of the surface is exercised only from here.
 */
import CloudOffIcon from '@mui/icons-material/CloudOff';
import {ThemeProvider, createTheme} from '@mui/material';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {DEFAULT_LABELS} from '../i18n';
import {render, screen} from '../test/test-utils';
import {EmptyState} from './EmptyState';

describe('EmptyState', () => {
  it('falls back to the translated no-data message', () => {
    render(<EmptyState />);

    expect(screen.getByText(DEFAULT_LABELS.noData)).toBeInTheDocument();
  });

  it('prefers an explicit message', () => {
    // Pages pass a message naming what is missing ("No orders yet"), which is the only
    // thing distinguishing one empty table from another.
    render(<EmptyState message="No orders yet" />);

    expect(screen.getByText('No orders yet')).toBeInTheDocument();
    expect(screen.queryByText(DEFAULT_LABELS.noData)).not.toBeInTheDocument();
  });

  it('renders the description under the message', () => {
    render(<EmptyState message="No orders yet" description="Orders appear here once a customer books." />);

    expect(screen.getByText('Orders appear here once a customer books.')).toBeInTheDocument();
  });

  it('swaps in a custom icon', () => {
    render(<EmptyState icon={<CloudOffIcon data-testid="custom-icon" />} />);

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('renders the call to action and reports clicks', async () => {
    const onAction = vi.fn();
    render(<EmptyState actionLabel="Create order" onAction={onAction} />);

    await userEvent.click(screen.getByRole('button', {name: 'Create order'}));

    expect(onAction).toHaveBeenCalledOnce();
  });

  it('renders no button when there is a label but no handler', () => {
    // A button that does nothing is worse than no button.
    render(<EmptyState actionLabel="Create order" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders no button when there is a handler but no label', () => {
    render(<EmptyState onAction={vi.fn()} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// React Compiler memoizes these components, so a re-render with unchanged props takes
// the cache-hit path instead of rebuilding the element tree. Nothing else in this file
// reaches that path — every other test mounts once — and it is where a compiler bug or
// a prop mutated in place would surface, as a panel that keeps painting state the table
// has already moved on from.
// ===========================================================================
describe('EmptyState — re-rendering', () => {
  it('paints the same content when re-rendered with unchanged props', () => {
    const props = {
      message: 'No orders yet',
      description: 'Orders appear here once a customer books.',
      actionLabel: 'Add an order',
      onAction: vi.fn(),
    };
    render(<EmptyState {...props} />).rerender(<EmptyState {...props} />);

    expect(screen.getByText('No orders yet')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Add an order'})).toBeInTheDocument();
  });
});

// ===========================================================================
// The icon's circle picks its background from the theme:
//
//   bgcolor: (theme) => (theme.palette.mode === 'dark' ? … : …)   // EmptyState.tsx:36
//
// Every other test here renders through the project `render`, which supplies a light
// theme only, so the dark half of that ternary had never executed. Admin users toggle
// dark mode, so the empty table is rendered in both modes in production.
//
// The assertion goes through `theme.palette.text.secondary` rather than the circle's
// own background because the background sits on the wrapper element, which a test can
// only reach by walking the DOM. Reading the icon's own themed colour proves the dark
// theme reached this subtree, which is what makes the dark branch run.
// ===========================================================================
describe('EmptyState — dark theme', () => {
  it('renders with the dark palette', () => {
    const dark = createTheme({palette: {mode: 'dark'}});

    render(
      <ThemeProvider theme={dark}>
        <EmptyState message="No orders yet" />
      </ThemeProvider>,
    );

    expect(screen.getByText('No orders yet')).toBeInTheDocument();
    expect(screen.getByTestId('InboxOutlinedIcon')).toHaveStyle({color: dark.palette.text.secondary});
  });

  it('renders a custom icon in dark mode too', () => {
    // The icon is the one child of the themed circle, so the custom-icon path has to be
    // exercised in dark mode as well, or the branch is only ever taken with the default.
    render(
      <ThemeProvider theme={createTheme({palette: {mode: 'dark'}})}>
        <EmptyState icon={<CloudOffIcon data-testid="custom-icon" />} />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });
});
