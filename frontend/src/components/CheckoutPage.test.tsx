import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CheckoutPage } from './CheckoutPage';
import type { CartResponse } from '../types';

const cart: CartResponse = {
  lines: [
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
      category: 'T-shirts',
      quantity: 1,
      expiresAt: Date.now() + 600000,
    },
  ],
  total: 28,
};

function renderCheckout(props: Partial<React.ComponentProps<typeof CheckoutPage>> = {}) {
  const onPlaceOrder = props.onPlaceOrder ?? vi.fn().mockResolvedValue({ ok: true, ref: 'FR-1001', message: 'ok' });
  render(
    <MemoryRouter>
      <CheckoutPage cart={props.cart ?? cart} onPlaceOrder={onPlaceOrder} />
    </MemoryRouter>,
  );
  return { onPlaceOrder };
}

async function fillForm() {
  await userEvent.type(screen.getByLabelText(/Nom/i), 'Amine Ben Salah');
  await userEvent.type(screen.getByLabelText(/Email/i), 'amine@fripa.tn');
  await userEvent.type(screen.getByLabelText(/Adresse/i), '12 rue de Marseille, Tunis');
  await userEvent.type(screen.getByLabelText(/Téléphone/i), '20123456');
}

describe('CheckoutPage', () => {
  it('shows the four fields and the order total', () => {
    renderCheckout();
    expect(screen.getByLabelText(/Nom/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Adresse/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Téléphone/i)).toBeInTheDocument();
    expect(screen.getAllByText(/28 TND/).length).toBeGreaterThan(0);
  });

  it('does not place the order when required fields are empty', async () => {
    const { onPlaceOrder } = renderCheckout();
    await userEvent.click(screen.getByRole('button', { name: /Confirmer/i }));
    expect(onPlaceOrder).not.toHaveBeenCalled();
    expect(screen.getAllByText(/obligatoire/i).length).toBeGreaterThan(0);
  });

  it('places the order with the customer info and shows the confirmation', async () => {
    const onPlaceOrder = vi
      .fn()
      .mockResolvedValue({ ok: true, ref: 'FR-1001', message: 'Commande FR-1001 confirmée' });
    renderCheckout({ onPlaceOrder });
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: /Confirmer/i }));
    expect(onPlaceOrder).toHaveBeenCalledWith({
      name: 'Amine Ben Salah',
      email: 'amine@fripa.tn',
      address: '12 rue de Marseille, Tunis',
      phone: '20123456',
    });
    expect((await screen.findAllByText(/FR-1001/)).length).toBeGreaterThan(0);
  });

  it('shows a general error (not a field error) when the order is refused', async () => {
    const onPlaceOrder = vi.fn().mockResolvedValue({ ok: false, message: 'Panier vide.' });
    renderCheckout({ onPlaceOrder });
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: /Confirmer/i }));
    const msg = await screen.findByText(/Panier vide/i);
    expect(msg).toHaveClass('checkout__error'); // a banner, not a field error
  });

  it('shows an empty state when the cart is empty', () => {
    renderCheckout({ cart: { lines: [], total: 0 } });
    expect(screen.getByText(/panier est vide/i)).toBeInTheDocument();
  });
});
