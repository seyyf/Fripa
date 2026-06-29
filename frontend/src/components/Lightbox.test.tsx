import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Lightbox } from './Lightbox';

describe('Lightbox', () => {
  it('shows the first image and cycles with the next control', () => {
    const { getByAltText, getByText } = render(
      <Lightbox images={['a.jpg', 'b.jpg']} alt="piece" onClose={() => {}} />,
    );
    expect((getByAltText('piece') as HTMLImageElement).src).toContain('a.jpg');
    fireEvent.click(getByText('›'));
    expect((getByAltText('piece') as HTMLImageElement).src).toContain('b.jpg');
  });

  it('opens on initialIndex', () => {
    const { getByAltText } = render(
      <Lightbox images={['a.jpg', 'b.jpg', 'c.jpg']} alt="p" initialIndex={2} onClose={() => {}} />,
    );
    expect((getByAltText('p') as HTMLImageElement).src).toContain('c.jpg');
  });

  it('hides nav controls for a single image', () => {
    const { queryByText } = render(<Lightbox images={['only.jpg']} alt="x" onClose={() => {}} />);
    expect(queryByText('›')).toBeNull();
    expect(queryByText('‹')).toBeNull();
  });

  it('closes on Escape and on backdrop click', () => {
    const onClose = vi.fn();
    const { container } = render(<Lightbox images={['a.jpg']} alt="x" onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(container.querySelector('.lightbox')!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
