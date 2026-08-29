/**
 * Coverage for `LoadingState`, previously 78%.
 *
 * The skeleton grid is what the user looks at on every first paint, so the row and
 * column counts are worth pinning: the DataTable passes the visible column count and
 * the page size straight through (DataTable.tsx:359), and a mismatch there means the
 * skeleton jumps to a different shape the moment the data lands.
 */
import {describe, expect, it} from 'vitest';

import {DEFAULT_LABELS} from '../i18n';
import {render, screen} from '../test/test-utils';
import {LoadingState} from './LoadingState';

// The skeleton table carries `aria-hidden`, so none of its rows or cells have a role to
// query: a shimmer with no text reads as a table with unlabelled columns, and the state's
// only announcement is the message. Structure is asserted against the DOM instead.
const rowsOf = (container: HTMLElement) => [...container.querySelectorAll('tr')];
const headersOf = (container: HTMLElement) => [...container.querySelectorAll('th')];

describe('LoadingState', () => {
  it('shows the translated loading message', () => {
    render(<LoadingState />);

    expect(screen.getByText(DEFAULT_LABELS.loading)).toBeInTheDocument();
  });

  it('prefers an explicit message', () => {
    render(<LoadingState message="Fetching orders" />);

    expect(screen.getByText('Fetching orders')).toBeInTheDocument();
  });

  it('keeps the skeleton out of the accessibility tree', () => {
    const {container} = render(<LoadingState />);

    expect(container.querySelector('table')).toHaveAttribute('aria-hidden');
    expect(screen.getByRole('status')).toHaveTextContent(DEFAULT_LABELS.loading);
  });

  it('renders five columns and five rows by default', () => {
    const {container} = render(<LoadingState />);

    expect(headersOf(container)).toHaveLength(5);
    // One header row plus five body rows.
    expect(rowsOf(container)).toHaveLength(6);
  });

  it('matches the requested grid size', () => {
    const {container} = render(<LoadingState columns={3} rows={2} />);

    expect(headersOf(container)).toHaveLength(3);
    expect(rowsOf(container)).toHaveLength(3);
    for (const row of rowsOf(container).slice(1)) {
      expect(row.querySelectorAll('td')).toHaveLength(3);
    }
  });

  it('renders no body rows when asked for none', () => {
    // The DataTable passes `rows={pagination.pageSize}`, so a page size of 0 must not
    // throw or fall back to a default.
    const {container} = render(<LoadingState rows={0} />);

    expect(rowsOf(container)).toHaveLength(1);
  });

  it('sizes the rows for the compact density', () => {
    const {container} = render(<LoadingState rows={1} density="compact" />);

    expect(rowsOf(container)[1]).toHaveStyle({height: '36px'});
  });

  it('sizes the rows for the spacious density', () => {
    // A skeleton at the wrong height makes the table jolt when the rows arrive.
    const {container} = render(<LoadingState rows={1} density="spacious" />);

    expect(rowsOf(container)[1]).toHaveStyle({height: '64px'});
  });

  it('sizes the rows for the comfortable density by default', () => {
    const {container} = render(<LoadingState rows={1} />);

    expect(rowsOf(container)[1]).toHaveStyle({height: '52px'});
  });
});

// ===========================================================================
// React Compiler memoizes these components, so a re-render with unchanged props takes
// the cache-hit path instead of rebuilding the element tree. Nothing else in this file
// reaches that path — every other test mounts once — and it is where a compiler bug or
// a prop mutated in place would surface, as a panel that keeps painting state the table
// has already moved on from.
// ===========================================================================
describe('LoadingState — re-rendering', () => {
  it('paints the same skeleton when re-rendered with unchanged props', () => {
    const props = {columns: 3, rows: 2, message: 'Loading orders', density: 'compact'} as const;
    render(<LoadingState {...props} />).rerender(<LoadingState {...props} />);

    expect(screen.getByText('Loading orders')).toBeInTheDocument();
  });
});
