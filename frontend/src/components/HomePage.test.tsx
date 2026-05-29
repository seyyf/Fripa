import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HomePage } from './HomePage';

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

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
    expect(screen.getByText(/Garder/i)).toBeInTheDocument();
    expect(screen.getByText(/Passer/i)).toBeInTheDocument();
    expect(screen.getByText(/Favori/i)).toBeInTheDocument();
  });
});
