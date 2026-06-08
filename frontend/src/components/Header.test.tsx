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
  it('links to the home page', () => {
    renderHeader();
    expect(screen.getByRole('link', { name: /Accueil/i })).toHaveAttribute('href', '/');
  });

  it('links to the shop (deck) page', () => {
    renderHeader();
    expect(screen.getByRole('link', { name: /Boutique/i })).toHaveAttribute('href', '/shop');
  });

  it('links to the catalogue grid', () => {
    renderHeader();
    expect(screen.getByRole('link', { name: /Catalogue/i })).toHaveAttribute('href', '/catalogue');
  });
});
