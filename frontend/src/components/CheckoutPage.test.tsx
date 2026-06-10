import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CheckoutPage } from './CheckoutPage';
import type { CartResponse } from '../types';

// Deterministic shop config: 7 TND delivery, free from 3 pieces.
vi.mock('../hooks/useShopConfig', () => ({
  useShopConfig: () => ({
    governorates: ['Tunis', 'Sousse'],
    deliveryFee: 7,
    deliveryFees: { Sousse: 9 },
    freeDeliveryMinItems: 3,
    freeDeliveryMinTotal: null,
    whatsappShop: '',
  }),
}));

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
  await userEvent.selectOptions(screen.getByLabelText(/Gouvernorat/i), 'Tunis');
  await userEvent.type(screen.getByLabelText(/Adresse/i), '12 rue de Marseille, Tunis');
  await userEvent.type(screen.getByLabelText(/Téléphone/i), '20123456');
}

describe('CheckoutPage', () => {
  it('shows the delivery fields and the order total', () => {
    renderCheckout();
    expect(screen.getByLabelText(/Nom/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Gouvernorat/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Adresse/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Téléphone/i)).toBeInTheDocument();
    expect(screen.getAllByText(/28 TND/).length).toBeGreaterThan(0);
  });

  it('adds the governorate delivery fee to the payable total', async () => {
    renderCheckout();
    await userEvent.selectOptions(screen.getByLabelText(/Gouvernorat/i), 'Sousse');
    // 28 (items) + 9 (Sousse override) = 37 on the submit button.
    expect(screen.getByRole('button', { name: /Confirmer la commande — 37 TND/ })).toBeInTheDocument();
  });

  it('waives the delivery fee from the bundle threshold and nudges below it', () => {
    const threeLines = {
      lines: [cart.lines[0], { ...cart.lines[0], id: 't-002' }, { ...cart.lines[0], id: 't-003' }],
      total: 84,
    };
    renderCheckout({ cart: threeLines });
    expect(screen.getByText(/Offerte/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmer la commande — 84 TND/ })).toBeInTheDocument();
  });

  it('shows how many pieces are missing for free delivery', () => {
    renderCheckout(); // 1 piece, threshold 3
    expect(screen.getByText(/Plus que 2 pièces pour la livraison/)).toBeInTheDocument();
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
    expect(onPlaceOrder).toHaveBeenCalledWith(
      {
        name: 'Amine Ben Salah',
        email: 'amine@fripa.tn',
        address: '12 rue de Marseille, Tunis',
        phone: '20123456',
        governorate: 'Tunis',
      },
      undefined, // no promo code applied
    );
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
