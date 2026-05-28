import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FloatingBox } from './FloatingBox';
import type { FieldBox } from '../field/fieldLayout';

const box: FieldBox = {
  boxKey: 'g-001-1',
  xPct: 20,
  yPct: 30,
  scale: 1,
  driftSeed: 0.5,
  item: {
    id: 'g-001',
    title: 'Nike Sweat à capuche',
    description: 'desc',
    imageUrl: 'https://example.test/x.jpg',
    price: 22,
    size: 'M',
    brand: 'Nike',
    condition: 'Comme neuf',
    color: 'Noir',
    seller: 'Fripa Sfax',
    lastChance: false,
  },
};

function noop() {}

describe('FloatingBox', () => {
  it('reveals on click when not focused', async () => {
    const onReveal = vi.fn();
    render(
      <FloatingBox box={box} focused={false} reducedMotion onReveal={onReveal} onDismiss={noop} onGrab={noop} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Nike Sweat à capuche/i }));
    expect(onReveal).toHaveBeenCalledWith('g-001-1');
  });

  it('shows the grab button and price when focused, and grabs', async () => {
    const onGrab = vi.fn();
    render(
      <FloatingBox box={box} focused reducedMotion onReveal={noop} onDismiss={noop} onGrab={onGrab} />,
    );
    expect(screen.getByText(/22 TND/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Ajouter/i }));
    expect(onGrab).toHaveBeenCalledWith(box);
  });

  it('does not bubble the click to a wrapping background handler (focus swap)', async () => {
    // Simulates the FloatingField wrapper: tapping an unfocused box must
    // call onReveal but NOT the background's dismiss handler. Without
    // stopPropagation, React 18 batching makes the dismiss win.
    const onReveal = vi.fn();
    const onBackground = vi.fn();
    render(
      <div onClick={onBackground}>
        <FloatingBox box={box} focused={false} reducedMotion onReveal={onReveal} onDismiss={noop} onGrab={noop} />
      </div>,
    );
    await userEvent.click(screen.getByRole('button', { name: /Nike Sweat à capuche/i }));
    expect(onReveal).toHaveBeenCalledWith('g-001-1');
    expect(onBackground).not.toHaveBeenCalled();
  });
});
