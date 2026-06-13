import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSizeProfile,
  setSizeProfile,
  sizesEqual,
  sizePromptSeen,
  markSizePromptSeen,
} from './sizeProfile';

describe('sizeProfile store', () => {
  beforeEach(() => {
    localStorage.clear();
    setSizeProfile([]); // reset in-memory state between tests
  });

  it('persists chosen sizes in canonical order and survives a reload', () => {
    setSizeProfile(['XL', 'S'] as never);
    expect(getSizeProfile()).toEqual(['S', 'XL']); // ALL_SIZES order, not input order
    expect(JSON.parse(localStorage.getItem('fripa-size-profile')!)).toEqual(['S', 'XL']);
  });

  it('drops unknown sizes', () => {
    setSizeProfile(['M', 'XXXL'] as never);
    expect(getSizeProfile()).toEqual(['M']);
  });

  it('sizesEqual is order-insensitive and treats undefined as empty', () => {
    expect(sizesEqual(['S', 'M'] as never, ['M', 'S'] as never)).toBe(true);
    expect(sizesEqual(undefined, [])).toBe(true);
    expect(sizesEqual(['S'] as never, ['M'] as never)).toBe(false);
  });

  it('notifies subscribers only on a real change', () => {
    setSizeProfile(['M'] as never);
    expect(getSizeProfile()).toEqual(['M']);
    setSizeProfile(['M'] as never); // no-op
    expect(getSizeProfile()).toEqual(['M']);
  });

  it('tracks the first-run prompt-seen flag', () => {
    expect(sizePromptSeen()).toBe(false);
    markSizePromptSeen();
    expect(sizePromptSeen()).toBe(true);
  });
});
