export type Lang = 'fr' | 'ar' | 'en';

export const LANGS: { code: Lang; label: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'fr', label: 'FR', dir: 'ltr' },
  { code: 'ar', label: 'ع', dir: 'rtl' },
  { code: 'en', label: 'EN', dir: 'ltr' },
];

// Core user-facing strings for the main shopping flow. (Marketing long-copy and
// the admin dashboard remain French for now.)
export const STRINGS = {
  'nav.home': { fr: 'Accueil', ar: 'الرئيسية', en: 'Home' },
  'nav.shop': { fr: 'Boutique', ar: 'المتجر', en: 'Shop' },
  'nav.catalogue': { fr: 'Catalogue', ar: 'الكتالوج', en: 'Catalogue' },
  'header.tagline': { fr: 'Le swipe du fripier', ar: 'سوق الملابس بالسحب', en: 'Swipe-to-thrift' },
  'a11y.account': { fr: 'Mon compte', ar: 'حسابي', en: 'My account' },
  'a11y.login': { fr: 'Se connecter', ar: 'تسجيل الدخول', en: 'Sign in' },
  'a11y.favorites': { fr: 'Mes favoris', ar: 'المفضّلة', en: 'Favorites' },
  'a11y.cart': { fr: 'Mon panier', ar: 'سلتي', en: 'Cart' },
  'a11y.reset': { fr: 'Recommencer la session', ar: 'إعادة الجلسة', en: 'Restart session' },

  'deck.pass': { fr: 'Passer', ar: 'تجاهل', en: 'Pass' },
  'deck.keep': { fr: 'Garder', ar: 'احتفظ', en: 'Keep' },
  'deck.favorite': { fr: 'Favori', ar: 'مفضّل', en: 'Favorite' },
  'deck.undo': { fr: '↩ Reviens', ar: '↩ تراجع', en: '↩ Undo' },
  'deck.prevPhoto': { fr: 'Photo précédente', ar: 'الصورة السابقة', en: 'Previous photo' },
  'deck.nextPhoto': { fr: 'Photo suivante', ar: 'الصورة التالية', en: 'Next photo' },
  'deck.filter': { fr: '⚙ Filtrer', ar: '⚙ تصفية', en: '⚙ Filter' },
  'deck.hint': {
    fr: '← Passer · → Garder · ↑ Favori · ou utilise les boutons.',
    ar: '← تجاهل · → احتفظ · ↑ مفضّل · أو استعمل الأزرار.',
    en: '← Pass · → Keep · ↑ Favorite · or use the buttons.',
  },
  'deck.search': {
    fr: 'Rechercher une pièce, une marque…',
    ar: 'ابحث عن قطعة أو ماركة…',
    en: 'Search an item, a brand…',
  },

  'coach.title': { fr: 'Comment ça marche', ar: 'كيف يعمل', en: 'How it works' },
  'coach.pass': { fr: 'Passer', ar: 'تجاهل', en: 'Pass' },
  'coach.keep': { fr: 'Garder', ar: 'احتفظ', en: 'Keep' },
  'coach.favorite': { fr: 'Favori', ar: 'مفضّل', en: 'Favorite' },
  'coach.passDesc': { fr: 'Swipe à gauche', ar: 'اسحب لليسار', en: 'Swipe left' },
  'coach.keepDesc': { fr: 'Swipe à droite', ar: 'اسحب لليمين', en: 'Swipe right' },
  'coach.favDesc': { fr: 'Swipe vers le haut', ar: 'اسحب للأعلى', en: 'Swipe up' },
  'coach.note': {
    fr: 'Ou utilise les boutons sous la carte.',
    ar: 'أو استعمل الأزرار تحت البطاقة.',
    en: 'Or use the buttons under the card.',
  },
  'coach.photos': {
    fr: '💡 Tape la photo pour voir les autres angles.',
    ar: '💡 انقر على الصورة لرؤية زوايا أخرى.',
    en: '💡 Tap the photo to see other angles.',
  },
  'coach.cta': { fr: 'C’est parti →', ar: 'هيا بنا →', en: 'Let’s go →' },

  'home.badge': { fr: '🇹🇳 Friperie en ligne', ar: '🇹🇳 ملابس مستعملة أونلاين', en: '🇹🇳 Online thrift' },
  'home.tagline': {
    fr: 'Le vide-dressing tunisien qui file vite. Tu swipes, tu gardes, tu chines.',
    ar: 'سوق الملابس التونسي الذي ينفد بسرعة. اسحب، احتفظ، ونقّب.',
    en: 'The Tunisian wardrobe sale that moves fast. Swipe, keep, thrift.',
  },
  'home.cta': { fr: 'Commencer à chiner →', ar: 'ابدأ التنقيب →', en: 'Start thrifting →' },
  'home.how': { fr: 'Comment ça marche', ar: 'كيف يعمل', en: 'How it works' },
} as const;

export type StringKey = keyof typeof STRINGS;
