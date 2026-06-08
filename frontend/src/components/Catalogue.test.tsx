import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Catalogue } from './Catalogue';
import { api } from './../api';

const { ITEM } = vi.hoisted(() => ({
  ITEM: {
    id: 't-001',
    title: 'Vintage Nike Swoosh',
    description: 'd',
    imageUrl: 'x.jpg',
    price: 28,
    size: 'L',
    brand: 'Nike',
    condition: 'Vintage',
    color: 'Noir',
    seller: 'Tunis',
    category: 'T-shirts',
  },
}));

vi.mock('../api', () => ({
  api: {
    catalogue: vi.fn().mockResolvedValue({ items: [ITEM], total: 1 }),
    categories: vi.fn().mockResolvedValue(['T-shirts', 'Shorts']),
    crowdSnatch: vi.fn().mockResolvedValue({ gone: true }),
  },
}));

beforeEach(() => {
  (api.catalogue as ReturnType<typeof vi.fn>).mockClear();
});

function renderCatalogue(props: Partial<React.ComponentProps<typeof Catalogue>> = {}) {
  const onAddToCart = props.onAddToCart ?? vi.fn();
  const onFavorite = props.onFavorite ?? vi.fn();
  render(
    <MemoryRouter>
      <Catalogue onAddToCart={onAddToCart} onFavorite={onFavorite} />
    </MemoryRouter>,
  );
  return { onAddToCart, onFavorite };
}

describe('Catalogue (live floor)', () => {
  it('renders the pieces returned by the API', async () => {
    renderCatalogue();
    expect(await screen.findByText(/Vintage Nike Swoosh/i)).toBeInTheDocument();
  });

  it('links each piece to its detail page', async () => {
    renderCatalogue();
    const link = await screen.findByRole('link', { name: /Vintage Nike Swoosh/i });
    expect(link).toHaveAttribute('href', '/piece/t-001');
  });

  it('shows a filter control', async () => {
    renderCatalogue();
    await screen.findByText(/Vintage Nike Swoosh/i);
    expect(screen.getByRole('button', { name: /Filtrer/i })).toBeInTheDocument();
  });

  it('opens a quick-look modal on a plain card click (no navigation)', async () => {
    renderCatalogue();
    await screen.findByText(/Vintage Nike Swoosh/i);
    await userEvent.click(screen.getByRole('link', { name: /Vintage Nike Swoosh/i }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // detail content is shown inside the modal
    expect(within(dialog).getByRole('button', { name: /Ajouter au panier/i })).toBeInTheDocument();
  });

  it('shows category tabs and filters by the selected category', async () => {
    renderCatalogue();
    expect(await screen.findByRole('button', { name: 'Tout' })).toBeInTheDocument();
    const shorts = await screen.findByRole('button', { name: 'Shorts' });
    await userEvent.click(shorts);
    await waitFor(() => {
      expect(api.catalogue).toHaveBeenCalledWith(expect.objectContaining({ category: 'Shorts' }));
    });
  });

  it('lets you grab a piece off the floor (add to cart)', async () => {
    const { onAddToCart } = renderCatalogue();
    await screen.findByText(/Vintage Nike Swoosh/i);
    await userEvent.click(screen.getByRole('button', { name: /Prendre/i }));
    expect(onAddToCart).toHaveBeenCalledWith(ITEM);
  });

  it('favoriting highlights the piece and keeps it on the floor', async () => {
    const onFavorite = vi.fn();
    renderCatalogue({ onFavorite });
    await screen.findByText(/Vintage Nike Swoosh/i);
    await userEvent.click(screen.getByRole('button', { name: /Garder pour plus tard/i }));
    expect(onFavorite).toHaveBeenCalledWith(ITEM);
    // still on the floor, and now grabbable + highlighted (Prendre still there)
    expect(screen.getByText(/Vintage Nike Swoosh/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Prendre/i })).toBeInTheDocument();
    expect(document.querySelector('.cat-card-wrap.is-fav')).not.toBeNull();
  });

  it('keeps a grabbed piece on the floor as a held card (blurred, no grab button)', async () => {
    renderCatalogue();
    await screen.findByText(/Vintage Nike Swoosh/i);
    await userEvent.click(screen.getByRole('button', { name: /Prendre/i }));
    expect(await screen.findByText(/Réservé/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Prendre/i })).not.toBeInTheDocument();
    // still on the floor (not removed)
    expect(screen.getByText(/Vintage Nike Swoosh/i)).toBeInTheDocument();
  });
});
