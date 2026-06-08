import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders its children inside a dialog', () => {
    render(
      <Modal onClose={() => {}} label="Détail">
        <p>contenu</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('contenu')).toBeInTheDocument();
  });

  it('closes when the X button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose}>
        <p>x</p>
      </Modal>,
    );
    await userEvent.click(screen.getByRole('button', { name: /Fermer/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose}>
        <p>x</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close when clicking inside the panel', async () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose}>
        <p>inside</p>
      </Modal>,
    );
    await userEvent.click(screen.getByText('inside'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
