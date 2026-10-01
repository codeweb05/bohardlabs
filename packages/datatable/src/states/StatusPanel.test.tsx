/**
 * `StatusPanel`, the shell `EmptyState` and `ErrorState` share.
 *
 * Both wrappers are tested through their own props, and both hand the panel a fresh set on
 * every change. What that leaves out is the panel being re-rendered with most of its props
 * untouched: a parent that keeps the same icon and action and swaps only the title or the
 * description, which is what happens when a locale loads late or a filter changes the
 * message under a table. The panel has to show the new text and keep the rest.
 */
import {describe, expect, it} from 'vitest';

import {render, screen} from '../test/test-utils';
import {StatusPanel} from './StatusPanel';

const icon = <span>icon</span>;
const action = <button type="button">Retry</button>;

describe('StatusPanel', () => {
  it('shows the icon, the title, the description and the action', () => {
    render(
      <StatusPanel
        iconBgcolor="action.hover"
        icon={icon}
        title="No orders yet"
        description="Orders appear here."
        action={action}
      />,
    );

    expect(screen.getByText('icon')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'No orders yet'})).toBeInTheDocument();
    expect(screen.getByText('Orders appear here.')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();
  });

  it('renders no description element when there is none', () => {
    render(<StatusPanel iconBgcolor="action.hover" icon={icon} title="No orders yet" />);

    expect(screen.getAllByText(/./)).toHaveLength(2);
  });

  it('swaps the title and keeps everything else', () => {
    const panel = (title: string) => (
      <StatusPanel
        iconBgcolor="action.hover"
        icon={icon}
        title={title}
        description="Orders appear here."
        action={action}
      />
    );
    const {rerender} = render(panel('No orders yet'));

    rerender(panel('Aucune commande'));

    expect(screen.getByRole('heading', {name: 'Aucune commande'})).toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: 'No orders yet'})).not.toBeInTheDocument();
    expect(screen.getByText('icon')).toBeInTheDocument();
    expect(screen.getByText('Orders appear here.')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();
  });

  it('swaps the description and keeps everything else', () => {
    const panel = (description: string) => (
      <StatusPanel
        iconBgcolor="action.hover"
        icon={icon}
        title="No orders yet"
        description={description}
        action={action}
      />
    );
    const {rerender} = render(panel('Orders appear here.'));

    rerender(panel('Try a wider date range.'));

    expect(screen.getByText('Try a wider date range.')).toBeInTheDocument();
    expect(screen.queryByText('Orders appear here.')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'No orders yet'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();
  });

  it('swaps the icon and keeps everything else', () => {
    const panel = (glyph: string) => (
      <StatusPanel iconBgcolor="action.hover" icon={<span>{glyph}</span>} title="No orders yet" action={action} />
    );
    const {rerender} = render(panel('inbox'));

    rerender(panel('cloud'));

    expect(screen.getByText('cloud')).toBeInTheDocument();
    expect(screen.queryByText('inbox')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'No orders yet'})).toBeInTheDocument();
  });
});
