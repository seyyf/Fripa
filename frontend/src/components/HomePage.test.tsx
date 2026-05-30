import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HomePage } from './HomePage';

// Mock the API so the "Pièces du moment" live preview has data to render.
vi.mock('../api', () => ({
  api: {
    field: vi.fn().mockResolvedValue({
      items: [
        {
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
          lastChance: false,
        },
      ],
      remaining: 50,
    }),
  },
}));

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('HomePage', () => {
  it('shows the brand name', () => {
    renderHome();
    expect(screen.getByRole('heading', { name: /Fripa/i })).toBeInTheDocument();
  });

  it('has a "Commencer à chiner" call-to-action linking to /shop', () => {
    renderHome();
    const cta = screen.getByRole('link', { name: /Commencer à chiner/i });
    expect(cta).toHaveAttribute('href', '/shop');
  });

  it('explains the three swipe directions', () => {
    renderHome();
    expect(screen.getAllByText(/Garder/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Passer/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Favori/i).length).toBeGreaterThan(0);
  });

  it('shows key stats', () => {
    renderHome();
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('shows a testimonial', () => {
    renderHome();
    expect(screen.getByText(/Amine/i)).toBeInTheDocument();
  });

  it('shows an FAQ section', () => {
    renderHome();
    expect(screen.getByText(/Questions fréquentes/i)).toBeInTheDocument();
    expect(screen.getByText(/Pourquoi une pièce disparaît/i)).toBeInTheDocument();
  });

  it('renders a live preview of catalog pieces from the API', async () => {
    renderHome();
    expect(await screen.findByText(/Vintage Nike Swoosh/i)).toBeInTheDocument();
  });
});
