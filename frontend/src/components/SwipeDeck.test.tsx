import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SwipeDeck } from './SwipeDeck';
import type { FieldItem } from '../types';

function item(id: string): FieldItem {
  return {
    id,
    title: `Piece ${id}`,
    description: 'd',
    imageUrl: 'x.jpg',
    price: 20,
    size: 'M',
    brand: 'Nike',
    condition: 'Bon état',
    color: 'Noir',
    seller: 'Tunis',
    category: 'T-shirts',
    lastChance: false,
  };
}

describe('SwipeDeck keyboard', () => {
  function setup() {
    const onKeep = vi.fn();
    const onPass = vi.fn();
    const onFavorite = vi.fn();
    const deck = [item('a'), item('b')];
    render(
      <SwipeDeck deck={deck} reducedMotion onKeep={onKeep} onPass={onPass} onFavorite={onFavorite} />,
    );
    return { onKeep, onPass, onFavorite, deck };
  }

  it('ArrowRight keeps the top card', () => {
    const { onKeep, deck } = setup();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onKeep).toHaveBeenCalledWith(deck[0]);
  });

  it('ArrowLeft passes the top card', () => {
    const { onPass, deck } = setup();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onPass).toHaveBeenCalledWith(deck[0]);
  });

  it('ArrowUp favorites the top card', () => {
    const { onFavorite, deck } = setup();
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(onFavorite).toHaveBeenCalledWith(deck[0]);
  });

  it('ignores arrows when a drawer/modal is open', () => {
    const { onKeep } = setup();
    const backdrop = document.createElement('div');
    backdrop.className = 'drawer-backdrop';
    document.body.appendChild(backdrop);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onKeep).not.toHaveBeenCalled();
    document.body.removeChild(backdrop);
  });
});
