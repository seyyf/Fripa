import { Category, TShirt } from './types';

// Placeholder photos via picsum.photos with stable seeds.
// Swap imageUrl values with real product photos when wiring up inventory.
const img = (seed: string) => `https://picsum.photos/seed/${seed}/600/800`;

const CURATED: TShirt[] = [
  {
    id: 't-001',
    title: 'Vintage Nike Swoosh',
    description: "Tee Nike des années 90, coupe oversize, logo brodé.",
    imageUrl: img('fripa-nike-90s'),
    price: 28,
    size: 'L',
    brand: 'Nike',
    condition: 'Très bon état',
    color: 'Blanc cassé',
    seller: 'Souk El Jemaa, Tunis',
    category: 'T-shirts',
  },
  {
    id: 't-002',
    title: 'Adidas Trefoil Rouge',
    description: 'Tee-shirt Adidas Originals, coton épais.',
    imageUrl: img('fripa-adidas-trefoil'),
    price: 22,
    size: 'M',
    brand: 'Adidas',
    condition: 'Bon état',
    color: 'Rouge',
    seller: 'Fripa Sfax',
    category: 'T-shirts',
  },
  {
    id: 't-003',
    title: 'Espérance Sportive de Tunis 2004',
    description: "Maillot rétro de l'EST, saison 2003-2004. Pièce rare.",
    imageUrl: img('fripa-est-2004'),
    price: 65,
    size: 'L',
    brand: 'EST',
    condition: 'Vintage',
    color: 'Rouge & Jaune',
    seller: 'Bab El Falla',
    category: 'Maillots',
  },
  {
    id: 't-004',
    title: 'Harvard University Crew',
    description: 'Tee universitaire ramené des US, coton lourd Champion.',
    imageUrl: img('fripa-harvard'),
    price: 35,
    size: 'M',
    brand: 'Champion',
    condition: 'Comme neuf',
    color: 'Bordeaux',
    seller: 'Fripa La Marsa',
    category: 'T-shirts',
  },
  {
    id: 't-005',
    title: 'Étoile du Sahel 1997',
    description: "Maillot vintage de l'ESS, floqué dans le dos.",
    imageUrl: img('fripa-ess-97'),
    price: 55,
    size: 'L',
    brand: 'ESS',
    condition: 'Vintage',
    color: 'Rouge & Blanc',
    seller: 'Sousse Médina',
    category: 'Maillots',
  },
  {
    id: 't-006',
    title: 'Carthage Festival 2012',
    description: 'Tee officiel du Festival de Carthage, édition limitée.',
    imageUrl: img('fripa-carthage'),
    price: 18,
    size: 'S',
    brand: 'Local',
    condition: 'Bon état',
    color: 'Noir',
    seller: 'Souk Sidi Bou Saïd',
    category: 'T-shirts',
  },
  {
    id: 't-007',
    title: 'Levi’s Red Tab',
    description: 'Basique Levi’s en coton bio, coupe droite.',
    imageUrl: img('fripa-levis-red'),
    price: 24,
    size: 'M',
    brand: "Levi's",
    condition: 'Comme neuf',
    color: 'Blanc',
    seller: 'Fripa Lac 2',
    category: 'T-shirts',
  },
  {
    id: 't-008',
    title: 'Lakers Kobe #24',
    description: 'Tee NBA Lakers, hommage Kobe Bryant. Imprimé craquelé.',
    imageUrl: img('fripa-lakers-kobe'),
    price: 32,
    size: 'XL',
    brand: 'NBA',
    condition: 'Bon état',
    color: 'Violet',
    seller: 'Fripa Bardo',
    category: 'T-shirts',
  },
  {
    id: 't-009',
    title: 'Tunisie 7 — Hannibal',
    description: 'Tee local imprimé à la main, motif Hannibal Barca.',
    imageUrl: img('fripa-hannibal'),
    price: 30,
    size: 'M',
    brand: 'Tunisie 7',
    condition: 'Comme neuf',
    color: 'Sable',
    seller: 'Tunis Centre Ville',
    category: 'T-shirts',
  },
  {
    id: 't-010',
    title: 'Ralph Lauren Polo Bear',
    description: 'Polo Ralph Lauren, motif ours brodé sur la poitrine.',
    imageUrl: img('fripa-polo-bear'),
    price: 45,
    size: 'L',
    brand: 'Ralph Lauren',
    condition: 'Très bon état',
    color: 'Bleu marine',
    seller: 'Fripa Menzah',
    category: 'Polos',
  },
  {
    id: 't-011',
    title: 'Metallica — Master of Puppets',
    description: 'Tee tournée officielle, taille européenne.',
    imageUrl: img('fripa-metallica'),
    price: 38,
    size: 'L',
    brand: 'Metallica',
    condition: 'Vintage',
    color: 'Noir',
    seller: 'Fripa Ariana',
    category: 'T-shirts',
  },
  {
    id: 't-012',
    title: 'Tommy Hilfiger Block Logo',
    description: 'Tommy Jeans, gros logo flag sur la poitrine.',
    imageUrl: img('fripa-tommy-flag'),
    price: 26,
    size: 'M',
    brand: 'Tommy Hilfiger',
    condition: 'Bon état',
    color: 'Bleu',
    seller: 'Fripa Hammamet',
    category: 'T-shirts',
  },
  {
    id: 't-013',
    title: 'Carthage Eagles',
    description: 'Maillot équipe nationale Tunisie 2018, replica.',
    imageUrl: img('fripa-tunisia-2018'),
    price: 40,
    size: 'M',
    brand: 'Uhlsport',
    condition: 'Très bon état',
    color: 'Rouge',
    seller: 'Fripa Manar',
    category: 'Maillots',
  },
  {
    id: 't-014',
    title: 'Stüssy World Tribe',
    description: 'Tee streetwear Stüssy, imprimé central.',
    imageUrl: img('fripa-stussy'),
    price: 42,
    size: 'L',
    brand: 'Stüssy',
    condition: 'Comme neuf',
    color: 'Crème',
    seller: 'Fripa Berges du Lac',
    category: 'T-shirts',
  },
  {
    id: 't-015',
    title: 'Coca-Cola 1995 Promo',
    description: 'Tee promotionnel Coca-Cola, coton épais USA.',
    imageUrl: img('fripa-coca-95'),
    price: 20,
    size: 'XL',
    brand: 'Coca-Cola',
    condition: 'Vintage',
    color: 'Rouge',
    seller: 'Fripa Kram',
    category: 'T-shirts',
  },
  {
    id: 't-016',
    title: 'Club Africain Rétro',
    description: 'Maillot Club Africain vintage, années 90.',
    imageUrl: img('fripa-ca-retro'),
    price: 58,
    size: 'M',
    brand: 'Club Africain',
    condition: 'Vintage',
    color: 'Rouge & Blanc',
    seller: 'Bab Jedid',
    category: 'Maillots',
  },
];

// --- Generated filler stock so the catalogue has real variety. ---
// Deterministic combinations of brands, garment types, colours, sizes and
// Tunisian sellers. Swap for real inventory later (stable picsum seeds).
const BRANDS = [
  'Nike', 'Adidas', 'Puma', "Levi's", 'Carhartt', 'Lacoste',
  'Fila', 'Kappa', 'Umbro', 'Reebok', 'Diadora', 'Sergio Tacchini',
];
const TYPES: { t: string; c: TShirt['condition']; category: Category }[] = [
  { t: 'Sweat à capuche', c: 'Comme neuf', category: 'Sweats' },
  { t: 'T-shirt vintage', c: 'Vintage', category: 'T-shirts' },
  { t: 'Polo piqué', c: 'Très bon état', category: 'Polos' },
  { t: 'Veste coupe-vent', c: 'Bon état', category: 'Vestes' },
  { t: 'Maillot rétro', c: 'Vintage', category: 'Maillots' },
  { t: 'Crewneck molleton', c: 'Comme neuf', category: 'Sweats' },
  { t: 'Short en molleton', c: 'Bon état', category: 'Shorts' },
  { t: 'Jean droit', c: 'Très bon état', category: 'Jeans' },
];
const COLORS = [
  'Noir', 'Blanc cassé', 'Bleu marine', 'Rouge',
  'Vert bouteille', 'Beige', 'Gris chiné', 'Bordeaux',
];
const SIZES: TShirt['size'][] = ['S', 'M', 'L', 'XL', 'XXL'];
const SELLERS = [
  'Souk El Jemaa, Tunis', 'Fripa Sfax', 'Bab El Falla', 'Fripa La Marsa',
  'Sousse Médina', 'Fripa Bardo', 'Fripa Ariana', 'Fripa Menzah',
  'Fripa Lac 2', 'Fripa Hammamet', 'Fripa Kram', 'Bab Jedid',
];

function generateItems(n: number): TShirt[] {
  const out: TShirt[] = [];
  for (let i = 0; i < n; i++) {
    const brand = BRANDS[i % BRANDS.length];
    const type = TYPES[i % TYPES.length];
    const color = COLORS[i % COLORS.length];
    const size = SIZES[i % SIZES.length];
    const seller = SELLERS[i % SELLERS.length];
    const id = `g-${String(i + 1).padStart(3, '0')}`;
    out.push({
      id,
      title: `${brand} ${type.t}`,
      description: `${type.t} ${brand}, coloris ${color.toLowerCase()}. Pièce chinée, prête à repartir.`,
      imageUrl: img(`fripa-${id}`),
      price: 15 + ((i * 7) % 50),
      size,
      brand,
      condition: type.c,
      color,
      seller,
      category: type.category,
    });
  }
  return out;
}

// The live catalogue the shop service reads from. At runtime this is replaced
// with the active items from the database (see CatalogueLoader); in unit tests
// it keeps these bundled defaults.
export const ITEMS: TShirt[] = [...CURATED, ...generateItems(44)];

// An immutable snapshot of the bundled defaults, used to seed an empty database
// on first boot. Taken before any runtime replacement of ITEMS.
export const SEED_ITEMS: readonly TShirt[] = ITEMS.slice();

// Replace the live catalogue in place (keeps the exported `ITEMS` binding stable
// so existing imports keep working). Used by the DB loader at boot and reload.
export function setItems(next: TShirt[]): void {
  ITEMS.splice(0, ITEMS.length, ...next);
}
