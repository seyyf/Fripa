import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Header } from './Header';

function noop() {}

function renderHeader() {
  return render(
    <MemoryRouter>
      <Header
        cartCount={0}
        favCount={0}
        onCart={noop}
        onFavorites={noop}
        onReset={noop}
      />
    </MemoryRouter>,
  );
}

describe('Header navigation', () => {
  it('links to the shop (deck) page', () => {
    renderHeader();
    expect(screen.getByRole('link', { name: /Boutique/i })).toHaveAttribute('href', '/shop');
  });

  // Home + catalogue nav links are intentionally hidden — the app focuses on
  // the swipe deck, and those routes redirect to /shop.
  it('does not show the catalogue grid link', () => {
    renderHeader();
    expect(screen.queryByRole('link', { name: /Catalogue/i })).toBeNull();
  });
});
