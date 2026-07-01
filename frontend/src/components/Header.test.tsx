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
  // Single-page app: no nav bar. The only link is the logo, which returns home.
  it('has no redundant nav links, only the logo', () => {
    renderHeader();
    expect(screen.queryByRole('link', { name: /Boutique/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /Catalogue/i })).toBeNull();
    expect(screen.getByRole('link', { name: /Fripa/i })).toHaveAttribute('href', '/');
  });
});
