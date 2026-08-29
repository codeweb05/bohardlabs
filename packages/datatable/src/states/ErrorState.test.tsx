/**
 * Coverage for `ErrorState`, previously 59%.
 *
 * The whole `compact` branch was unreached: the DataTable only renders the full
 * variant (DataTable.tsx:363), so nothing in the app has ever rendered the Alert.
 *
 * The block at the bottom records an issue found while writing these.
 */
import {ThemeProvider, createTheme} from '@mui/material';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {DEFAULT_LABELS} from '../i18n';
import {render, screen} from '../test/test-utils';
import {ErrorState} from './ErrorState';

const GENERIC = DEFAULT_LABELS.error;
const RETRY = DEFAULT_LABELS.retry;

describe('ErrorState — full', () => {
  it('shows the server message when there is one', () => {
    render(<ErrorState error="Request timed out" />);

    expect(screen.getByText('Request timed out')).toBeInTheDocument();
  });

  it('falls back to the generic message when the error is null', () => {
    // `error` is typed `string | null` because the query hooks report exactly that.
    // `getAllByText` rather than `getByText` because the fallback currently renders in
    // both the heading and the body — see the KNOWN ISSUE at the bottom of this file.
    render(<ErrorState error={null} />);

    expect(screen.getAllByText(GENERIC).length).toBeGreaterThan(0);
  });

  it('offers retry and reports the click', async () => {
    const onRetry = vi.fn();
    render(<ErrorState error="Request timed out" onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', {name: RETRY}));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders no retry button without a handler', () => {
    render(<ErrorState error="Request timed out" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('ErrorState — compact', () => {
  it('renders as an alert', () => {
    // The compact variant is meant for inline use above a table that still has rows,
    // so it has to be announced rather than silently swapped in.
    render(<ErrorState error="Request timed out" compact />);

    expect(screen.getByRole('alert')).toHaveTextContent('Request timed out');
  });

  it('puts retry inside the alert', async () => {
    const onRetry = vi.fn();
    render(<ErrorState error="Request timed out" compact onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', {name: RETRY}));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders no retry button without a handler', () => {
    render(<ErrorState error="Request timed out" compact />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('falls back to the generic message', () => {
    render(<ErrorState compact />);

    expect(screen.getByRole('alert')).toHaveTextContent(GENERIC);
  });
});

// ===========================================================================
// React Compiler memoizes these components, so a re-render with unchanged props takes
// the cache-hit path instead of rebuilding the element tree. Nothing else in this file
// reaches that path — every other test mounts once — and it is where a compiler bug or
// a prop mutated in place would surface, as a panel that keeps painting state the table
// has already moved on from.
// ===========================================================================
describe('ErrorState — re-rendering', () => {
  it('paints the same content when re-rendered with unchanged props', () => {
    const props = {error: 'Request timed out', onRetry: vi.fn()};
    render(<ErrorState {...props} />).rerender(<ErrorState {...props} />);

    expect(screen.getByText('Request timed out')).toBeInTheDocument();
  });

  it('paints the same compact banner when re-rendered with unchanged props', () => {
    // The compact banner is a separate early return, so it has its own cached path.
    const props = {error: 'Request timed out', onRetry: vi.fn(), compact: true};
    render(<ErrorState {...props} />).rerender(<ErrorState {...props} />);

    expect(screen.getByText('Request timed out')).toBeInTheDocument();
  });
});

// ===========================================================================
// The icon's circle tints itself from the theme:
//
//   bgcolor: (theme) => (theme.palette.mode === 'dark' ? … : …)   // ErrorState.tsx:53
//
// The project `render` supplies a light theme only, so the dark half had never run.
// A failed request is exactly as likely in dark mode as in light, and the red tint is
// the part of this component most at risk of washing out against a dark surface.
//
// The assertion reads the icon's own themed colour rather than the circle's background:
// the background sits on the wrapper element, reachable only by walking the DOM, and
// `error.main` differs between the two palettes, so it proves the dark theme reached
// this subtree, which is what makes the dark branch run.
// ===========================================================================
describe('ErrorState — dark theme', () => {
  it('renders the full variant with the dark palette', () => {
    const dark = createTheme({palette: {mode: 'dark'}});

    render(
      <ThemeProvider theme={dark}>
        <ErrorState error="Request timed out" />
      </ThemeProvider>,
    );

    expect(screen.getByText('Request timed out')).toBeInTheDocument();
    expect(screen.getByTestId('ErrorOutlinedIcon')).toHaveStyle({color: dark.palette.error.main});
  });

  it('still offers retry in dark mode', async () => {
    const onRetry = vi.fn();
    render(
      <ThemeProvider theme={createTheme({palette: {mode: 'dark'}})}>
        <ErrorState error="Request timed out" onRetry={onRetry} />
      </ThemeProvider>,
    );

    await userEvent.click(screen.getByRole('button', {name: RETRY}));

    expect(onRetry).toHaveBeenCalledOnce();
  });
});

// ===========================================================================
// KNOWN ISSUE — states/ErrorState.tsx:15, :78 and :90
//
//   const displayError = error ?? t('dataTable.error');
//   <Typography variant="h6" …>{t('dataTable.error')}</Typography>
//   <Typography variant="body2" …>{displayError}</Typography>
//
// The heading is always the generic message and the body falls back to the SAME
// string, so a table that fails without a message from the server renders
// "Failed to load data" twice, stacked. Every request that rejects without a parsed
// message hits this — the most common failure in the app, not an edge case.
//
// The fix is for the body to render only when it adds something: either drop the
// fallback (`{error && <Typography …>{error}</Typography>}`) or give the heading its
// own shorter key.
//
// EXPECTED TO FAIL until the generic message appears at most once.
// ===========================================================================
describe('KNOWN ISSUE — the generic error message must not be printed twice', () => {
  it('shows one copy of the fallback message', () => {
    render(<ErrorState />);

    expect(screen.getAllByText(GENERIC)).toHaveLength(1);
  });
});
