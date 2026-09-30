import {render, screen} from '@testing-library/react';

import {lazyField} from './lazyField';

function Greeting({name}: {readonly name: string}) {
  return <p>Hello {name}</p>;
}

describe('lazyField', () => {
  it('shows the fallback, then the loaded component with its props', async () => {
    let finish: (component: typeof Greeting) => void = () => {};
    const Lazy = lazyField(
      () =>
        new Promise<typeof Greeting>((resolve) => {
          finish = resolve;
        }),
      <p>Loading field</p>,
    );

    render(<Lazy name="Ada" />);
    expect(screen.getByText('Loading field')).toBeInTheDocument();

    finish(Greeting);
    expect(await screen.findByText('Hello Ada')).toBeInTheDocument();
  });

  it('calls load once however many times it renders', async () => {
    const load = vi.fn(async () => Greeting);
    const Lazy = lazyField(load);
    render(
      <>
        <Lazy name="A" />
        <Lazy name="B" />
      </>,
    );
    expect(await screen.findByText('Hello B')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
