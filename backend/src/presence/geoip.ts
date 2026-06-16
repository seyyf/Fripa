import geoip from 'geoip-lite';

// ISO 3166-2:TN subdivision code -> governorate name (matching the names in
// backend/src/shop/settings.service.ts GOVERNORATES). geoip-lite returns the
// subdivision code without the "TN-" prefix in its `region` field.
const TN_REGION_TO_GOVERNORATE: Record<string, string> = {
  '11': 'Tunis',
  '12': 'Ariana',
  '13': 'Ben Arous',
  '14': 'Manouba',
  '21': 'Nabeul',
  '22': 'Zaghouan',
  '23': 'Bizerte',
  '31': 'Béja',
  '32': 'Jendouba',
  '33': 'Le Kef',
  '34': 'Siliana',
  '41': 'Kairouan',
  '42': 'Kasserine',
  '43': 'Sidi Bouzid',
  '51': 'Sousse',
  '52': 'Monastir',
  '53': 'Mahdia',
  '61': 'Sfax',
  '71': 'Gafsa',
  '72': 'Tozeur',
  '73': 'Kébili',
  '81': 'Gabès',
  '82': 'Médenine',
  '83': 'Tataouine',
};

export const UNKNOWN_GOVERNORATE = 'Inconnu';

// Pure, testable mapping. Anything that isn't a known Tunisian subdivision
// collapses to "Inconnu".
export function governorateFromRegion(country: string, region: string): string {
  if (country !== 'TN') return UNKNOWN_GOVERNORATE;
  return TN_REGION_TO_GOVERNORATE[region] ?? UNKNOWN_GOVERNORATE;
}

// The single place that touches geoip-lite. Swap this body for MaxMind
// GeoLite2-City later without changing PresenceService. Never throws.
export function resolveGovernorate(ip: string | undefined): string {
  if (!ip) return UNKNOWN_GOVERNORATE;
  // Normalise IPv6-mapped IPv4 (e.g. "::ffff:196.x.x.x") that Express may hand us.
  const clean = ip.replace(/^::ffff:/, '');
  const geo = geoip.lookup(clean);
  if (!geo) return UNKNOWN_GOVERNORATE;
  return governorateFromRegion(geo.country, geo.region);
}
