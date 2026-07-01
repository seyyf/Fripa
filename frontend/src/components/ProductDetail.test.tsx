import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProductDetail } from './ProductDetail';
import type { ItemStatus } from '../types';

vi.mock('../api', () => ({ api: { item: vi.fn(), similar: vi.fn().mockResolvedValue([]) } }));
import { api } from '../api';
const mockItem = api.item as unknown as ReturnType<typeof vi.fn>;

const ITEM = {
  id: 't-001',
  title: 'Vintage Nike Swoosh',
  description: 'Tee Nike des années 90.',
  imageUrl: 'x.jpg',
  price: 28,
  size: 'L',
  brand: 'Nike',
  condition: 'Vintage',
  color: 'Noir',
  seller: 'Souk El Jemaa, Tunis',
  category: 'T-shirts',
};

function renderDetail(props: Partial<React.ComponentProps<typeof ProductDetail>> = {}) {
  const onAddToCart = props.onAddToCart ?? vi.fn();
  const onFavorite = props.onFavorite ?? vi.fn();
  render(
    <MemoryRouter initialEntries={['/piece/t-001']}>
      <Routes>
        <Route
          path="/piece/:id"
          element={<ProductDetail onAddToCart={onAddToCart} onFavorite={onFavorite} />}
        />
      </Routes>
    </MemoryRouter>,
  );
  return { onAddToCart, onFavorite };
}

beforeEach(() => mockItem.mockReset());

describe('ProductDetail', () => {
  it('shows the piece details', async () => {
    mockItem.mockResolvedValue({ item: ITEM, status: 'available' as ItemStatus });
    renderDetail();
    expect(await screen.findByRole('heading', { name: /Vintage Nike Swoosh/i })).toBeInTheDocument();
    expect(screen.getByText(/28 TND/)).toBeInTheDocument();
  });

  it('adds to cart when available', async () => {
    mockItem.mockResolvedValue({ item: ITEM, status: 'available' as ItemStatus });
    const { onAddToCart } = renderDetail();
    await screen.findByRole('heading', { name: /Vintage Nike Swoosh/i });
    await userEvent.click(screen.getByRole('button', { name: /Ajouter au panier/i }));
    expect(onAddToCart).toHaveBeenCalledWith(ITEM);
  });

  it('shows a "gone" state with no add button', async () => {
    mockItem.mockResolvedValue({ item: ITEM, status: 'gone' as ItemStatus });
    renderDetail();
    expect(await screen.findByText(/partie/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ajouter au panier/i })).not.toBeInTheDocument();
  });

  it('shows a not-found state for an unknown piece', async () => {
    mockItem.mockResolvedValue({ item: ITEM, status: 'available' as ItemStatus });
    mockItem.mockRejectedValueOnce(new Error('404')); // first (mount) fetch 404s
    renderDetail();
    expect(await screen.findByText(/introuvable/i)).toBeInTheDocument();
  });
});
