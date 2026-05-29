import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterDrawer } from './FilterDrawer';

function setup(props: Partial<React.ComponentProps<typeof FilterDrawer>> = {}) {
  const onApply = vi.fn();
  const onClear = vi.fn();
  const onClose = vi.fn();
  render(
    <FilterDrawer
      open
      filters={{}}
      onApply={onApply}
      onClear={onClear}
      onClose={onClose}
      {...props}
    />,
  );
  return { onApply, onClear, onClose };
}

describe('FilterDrawer', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <FilterDrawer open={false} filters={{}} onApply={() => {}} onClear={() => {}} onClose={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('applies a selected size', async () => {
    const { onApply } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'M', exact: true }));
    await userEvent.click(screen.getByRole('button', { name: /Appliquer/i }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ sizes: ['M'] }));
  });

  it('applies a free-text query', async () => {
    const { onApply } = setup();
    await userEvent.type(screen.getByPlaceholderText(/Rechercher/i), 'nike');
    await userEvent.click(screen.getByRole('button', { name: /Appliquer/i }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ q: 'nike' }));
  });

  it('clears the filters', async () => {
    const { onClear } = setup({ filters: { q: 'nike', sizes: ['M'] } });
    await userEvent.click(screen.getByRole('button', { name: /Réinitialiser/i }));
    expect(onClear).toHaveBeenCalled();
  });
});
