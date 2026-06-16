import { describe, it, expect } from 'vitest';
import { governorateFromRegion } from './geoip';

describe('governorateFromRegion', () => {
  it('maps known Tunisian ISO region codes to governorate names', () => {
    expect(governorateFromRegion('TN', '11')).toBe('Tunis');
    expect(governorateFromRegion('TN', '13')).toBe('Ben Arous');
    expect(governorateFromRegion('TN', '61')).toBe('Sfax');
    expect(governorateFromRegion('TN', '83')).toBe('Tataouine');
  });

  it('falls back to "Inconnu" for non-TN countries', () => {
    expect(governorateFromRegion('FR', '11')).toBe('Inconnu');
  });

  it('falls back to "Inconnu" for an unknown TN region code', () => {
    expect(governorateFromRegion('TN', '99')).toBe('Inconnu');
    expect(governorateFromRegion('TN', '')).toBe('Inconnu');
  });
});
