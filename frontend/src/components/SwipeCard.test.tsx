import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SwipeCard } from './SwipeCard';
import type { FieldItem } from '../types';

const item: FieldItem = {
  id: 't-001',
  title: 'Vintage Nike Swoosh',
  description: 'Tee Nike des années 90.',
  imageUrl: 'https://example.test/x.jpg',
  price: 28,
  size: 'L',
  brand: 'Nike',
  condition: 'Très bon état',
  color: 'Blanc cassé',
  seller: 'Souk El Jemaa, Tunis',
  category: 'T-shirts',
  lastChance: false,
};

function noop() {}

describe('SwipeCard', () => {
  it('shows the item title and price', () => {
    render(<SwipeCard item={item} onKeep={noop} onPass={noop} onFavorite={noop} />);
    expect(screen.getByText(/Vintage Nike Swoosh/)).toBeInTheDocument();
    expect(screen.getByText(/28 TND/)).toBeInTheDocument();
  });

  it('calls onKeep with the item when the Garder button is clicked', async () => {
    const onKeep = vi.fn();
    render(<SwipeCard item={item} onKeep={onKeep} onPass={noop} onFavorite={noop} />);
    await userEvent.click(screen.getByRole('button', { name: /Garder/i }));
    expect(onKeep).toHaveBeenCalledWith(item);
  });

  it('calls onPass with the item when the Passer button is clicked', async () => {
    const onPass = vi.fn();
    render(<SwipeCard item={item} onKeep={noop} onPass={onPass} onFavorite={noop} />);
    await userEvent.click(screen.getByRole('button', { name: /Passer/i }));
    expect(onPass).toHaveBeenCalledWith(item);
  });

  it('calls onFavorite with the item when the Favori button is clicked', async () => {
    const onFavorite = vi.fn();
    render(<SwipeCard item={item} onKeep={noop} onPass={noop} onFavorite={onFavorite} />);
    await userEvent.click(screen.getByRole('button', { name: /Favori/i }));
    expect(onFavorite).toHaveBeenCalledWith(item);
  });

  it('renders the Dernière chance banner only when lastChance is set', () => {
    const { rerender } = render(
      <SwipeCard item={item} onKeep={noop} onPass={noop} onFavorite={noop} />,
    );
    expect(screen.queryByText(/Dernière chance/i)).not.toBeInTheDocument();
    rerender(
      <SwipeCard item={{ ...item, lastChance: true }} onKeep={noop} onPass={noop} onFavorite={noop} />,
    );
    expect(screen.getByText(/Dernière chance/i)).toBeInTheDocument();
  });
});
