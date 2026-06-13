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

  'size.title': { fr: 'Quelle est ta taille ?', ar: 'ما هو مقاسك؟', en: "What's your size?" },
  'size.text': {
    fr: 'On t’affiche d’abord ce qui te va — pas besoin de compte. Modifiable quand tu veux.',
    ar: 'نعرض لك أولاً ما يناسبك — بدون حساب. يمكنك تغييره وقتما تشاء.',
    en: 'We’ll show what fits you first — no account needed. Change it anytime.',
  },
  'size.all': { fr: 'Toutes les tailles', ar: 'كل المقاسات', en: 'All sizes' },
  'size.save': { fr: 'C’est bon', ar: 'تمّ', en: 'Done' },

  // --- Common ---
  'common.loading': { fr: 'Chargement…', ar: 'جارٍ التحميل…', en: 'Loading…' },
  'common.close': { fr: 'Fermer', ar: 'إغلاق', en: 'Close' },
  'common.apply': { fr: 'Appliquer', ar: 'تطبيق', en: 'Apply' },
  'common.remove': { fr: 'Retirer', ar: 'إزالة', en: 'Remove' },
  'common.tndSuffix': { fr: 'TND', ar: 'د.ت', en: 'TND' },

  // --- Catalogue ---
  'cat.title': { fr: 'Le rayon', ar: 'الرواق', en: 'The rack' },
  'cat.countOne': {
    fr: '{n} pièce dispo · en direct',
    ar: '{n} قطعة متاحة · مباشر',
    en: '{n} piece available · live',
  },
  'cat.countMany': {
    fr: '{n} pièces dispo · en direct',
    ar: '{n} قطعة متاحة · مباشر',
    en: '{n} pieces available · live',
  },
  'cat.all': { fr: 'Tout', ar: 'الكل', en: 'All' },
  'cat.tickerIdle': {
    fr: '👀 D’autres chinent en direct. Les pièces prises reviennent quand le chineur lâche.',
    ar: '👀 آخرون ينقّبون مباشرة. القطع المحجوزة تعود عندما يتركها صاحبها.',
    en: '👀 Others are thrifting live. Held pieces return when the shopper lets go.',
  },
  'cat.grab': { fr: '🛒 Prendre', ar: '🛒 خذها', en: '🛒 Grab' },
  'cat.grabAria': { fr: 'Prendre {title}', ar: 'خذ {title}', en: 'Grab {title}' },
  'cat.favAria': { fr: 'Garder pour plus tard {title}', ar: 'احفظ {title} لاحقاً', en: 'Save {title} for later' },
  'cat.favRibbon': { fr: '⭐ Favori', ar: '⭐ مفضّل', en: '⭐ Favorite' },
  'cat.heldYou': { fr: '🛒 Réservé', ar: '🛒 محجوز', en: '🛒 Held' },
  'cat.heldCrowd': { fr: '⏱ Pris', ar: '⏱ مأخوذ', en: '⏱ Taken' },
  'cat.returnIn': { fr: 'Revient dans {time}', ar: 'يعود خلال {time}', en: 'Back in {time}' },
  'cat.tickerPrefix': { fr: '⏱ {msg}', ar: '⏱ {msg}', en: '⏱ {msg}' },
  'cat.emptyTitle': { fr: 'Aucune pièce ne correspond.', ar: 'لا توجد قطعة مطابقة.', en: 'Nothing matches.' },
  'cat.emptyText': {
    fr: 'Essaie d’élargir tes filtres.',
    ar: 'جرّب توسيع عوامل التصفية.',
    en: 'Try widening your filters.',
  },
  'cat.emptyRackTitle': { fr: 'Le rayon est vide.', ar: 'الرواق فارغ.', en: 'The rack is empty.' },
  'cat.emptyRackText': {
    fr: 'Tout est parti. Reviens plus tard.',
    ar: 'نفد كل شيء. عُد لاحقاً.',
    en: 'Everything’s gone. Check back later.',
  },
  'cat.clearFilters': { fr: 'Effacer les filtres', ar: 'مسح عوامل التصفية', en: 'Clear filters' },

  // --- Cart drawer ---
  'cart.title': { fr: 'Mon panier', ar: 'سلتي', en: 'My cart' },
  'cart.finalize': { fr: 'Finaliser', ar: 'إتمام الطلب', en: 'Checkout' },
  'cart.confirmed': { fr: 'Commande confirmée', ar: 'تم تأكيد الطلب', en: 'Order confirmed' },
  'cart.empty': { fr: 'Ton panier est vide.', ar: 'سلتك فارغة.', en: 'Your cart is empty.' },
  'cart.emptyHint': {
    fr: 'Tape une pièce qui flotte, puis 🛒 pour la garder avant les autres.',
    ar: 'انقر على قطعة ثم 🛒 لتحجزها قبل الآخرين.',
    en: 'Tap a piece, then 🛒 to grab it before anyone else.',
  },
  'cart.holdNote': {
    fr: '⏳ Chaque pièce est réservée 10 min. Passe commande avant que ça reparte.',
    ar: '⏳ كل قطعة محجوزة 10 دقائق. أكمل الطلب قبل أن تعود.',
    en: '⏳ Each piece is held for 10 min. Order before it’s gone.',
  },
  'cart.total': { fr: 'Total', ar: 'المجموع', en: 'Total' },
  'cart.checkout': { fr: 'Passer commande', ar: 'إتمام الطلب', en: 'Place order' },
  'cart.payNote': {
    fr: '📦 {n} pièce · tu peux encore en retirer avant de confirmer.',
    ar: '📦 {n} قطعة · يمكنك إزالة بعضها قبل التأكيد.',
    en: '📦 {n} piece · you can still remove some before confirming.',
  },
  'cart.payNoteMany': {
    fr: '📦 {n} pièces · tu peux encore en retirer avant de confirmer.',
    ar: '📦 {n} قطع · يمكنك إزالة بعضها قبل التأكيد.',
    en: '📦 {n} pieces · you can still remove some before confirming.',
  },
  'cart.thanks': { fr: 'Merci ! C’est commandé.', ar: 'شكراً! تم الطلب.', en: 'Thanks! Order placed.' },
  'cart.ref': { fr: 'Référence : {ref}', ar: 'المرجع: {ref}', en: 'Reference: {ref}' },
  'cart.codNote': {
    fr: '💵 Paiement à la livraison — on te contacte pour confirmer.',
    ar: '💵 الدفع عند الاستلام — سنتصل بك للتأكيد.',
    en: '💵 Cash on delivery — we’ll contact you to confirm.',
  },
  'cart.track': { fr: 'Suivre ma commande →', ar: 'تتبّع طلبي →', en: 'Track my order →' },
  'cart.continue': { fr: 'Continuer à chiner', ar: 'مواصلة التنقيب', en: 'Keep thrifting' },
  'cart.reserved': { fr: '⏳ Réservé · {time}', ar: '⏳ محجوز · {time}', en: '⏳ Held · {time}' },
  'cart.freeOne': {
    fr: '🚚 Plus que {n} pièce pour la livraison offerte !',
    ar: '🚚 باقٍ {n} قطعة فقط للتوصيل المجاني!',
    en: '🚚 Just {n} more piece for free delivery!',
  },
  'cart.freeMany': {
    fr: '🚚 Plus que {n} pièces pour la livraison offerte !',
    ar: '🚚 باقٍ {n} قطع فقط للتوصيل المجاني!',
    en: '🚚 Just {n} more pieces for free delivery!',
  },
  'cart.freeOn': {
    fr: '🚚 Livraison offerte sur cette commande !',
    ar: '🚚 توصيل مجاني على هذا الطلب!',
    en: '🚚 Free delivery on this order!',
  },

  // --- Checkout ---
  'checkout.delivery': { fr: 'Livraison', ar: 'التوصيل', en: 'Delivery' },
  'checkout.name': { fr: 'Nom complet', ar: 'الاسم الكامل', en: 'Full name' },
  'checkout.email': { fr: 'Email', ar: 'البريد الإلكتروني', en: 'Email' },
  'checkout.governorate': { fr: 'Gouvernorat', ar: 'الولاية', en: 'Governorate' },
  'checkout.govChoose': { fr: '— Choisir —', ar: '— اختر —', en: '— Choose —' },
  'checkout.address': { fr: 'Adresse de livraison', ar: 'عنوان التوصيل', en: 'Delivery address' },
  'checkout.phone': { fr: 'Téléphone', ar: 'الهاتف', en: 'Phone' },
  'checkout.errName': { fr: 'Le nom est obligatoire.', ar: 'الاسم إلزامي.', en: 'Name is required.' },
  'checkout.errEmail': { fr: 'L’email est obligatoire.', ar: 'البريد إلزامي.', en: 'Email is required.' },
  'checkout.errEmailBad': { fr: 'Email invalide.', ar: 'بريد غير صالح.', en: 'Invalid email.' },
  'checkout.errGov': { fr: 'Choisis ton gouvernorat.', ar: 'اختر ولايتك.', en: 'Choose your governorate.' },
  'checkout.errAddress': { fr: 'L’adresse est obligatoire.', ar: 'العنوان إلزامي.', en: 'Address is required.' },
  'checkout.errPhone': { fr: 'Le téléphone est obligatoire.', ar: 'الهاتف إلزامي.', en: 'Phone is required.' },
  'checkout.errPhoneShort': { fr: 'Numéro trop court.', ar: 'الرقم قصير جداً.', en: 'Number too short.' },
  'checkout.promoPlaceholder': { fr: 'Code promo', ar: 'رمز ترويجي', en: 'Promo code' },
  'checkout.promoApplied': {
    fr: 'Code {code} appliqué · −{discount} TND',
    ar: 'تم تطبيق {code} · −{discount} د.ت',
    en: '{code} applied · −{discount} TND',
  },
  'checkout.promoHint': {
    fr: 'Ton code sera appliqué à la commande.',
    ar: 'سيُطبَّق رمزك على الطلب.',
    en: 'Your code will be applied at checkout.',
  },
  'checkout.promoBad': {
    fr: 'Code promo non valide — corrige-le ou efface-le pour continuer.',
    ar: 'رمز غير صالح — صحّحه أو احذفه للمتابعة.',
    en: 'Invalid promo code — fix or clear it to continue.',
  },
  'checkout.promoInvalid': { fr: 'Code invalide.', ar: 'رمز غير صالح.', en: 'Invalid code.' },
  'checkout.referralLabel': {
    fr: 'Code de parrainage (facultatif)',
    ar: 'رمز الإحالة (اختياري)',
    en: 'Referral code (optional)',
  },
  'checkout.referralPlaceholder': {
    fr: 'Le code d’un ami',
    ar: 'رمز صديق',
    en: 'A friend’s code',
  },
  'checkout.referralHint': {
    fr: '−{discount} TND sur ta 1ʳᵉ commande si le code est valide.',
    ar: '−{discount} د.ت على أول طلب إذا كان الرمز صالحاً.',
    en: '−{discount} TND on your 1st order if the code is valid.',
  },
  'checkout.discount': { fr: 'Remise', ar: 'خصم', en: 'Discount' },
  'checkout.referralRow': { fr: 'Parrainage', ar: 'الإحالة', en: 'Referral' },
  'checkout.deliveryFree': { fr: 'Offerte 🚚', ar: 'مجاني 🚚', en: 'Free 🚚' },
  'checkout.freeLoyalty': { fr: 'fidélité 🎁', ar: 'الولاء 🎁', en: 'loyalty 🎁' },
  'checkout.freeReferral': { fr: 'parrainage 🤝', ar: 'الإحالة 🤝', en: 'referral 🤝' },
  'checkout.freeOne': {
    fr: '🚚 Plus que {n} pièce pour la livraison offerte !',
    ar: '🚚 باقٍ {n} قطعة فقط للتوصيل المجاني!',
    en: '🚚 Just {n} more piece for free delivery!',
  },
  'checkout.freeMany': {
    fr: '🚚 Plus que {n} pièces pour la livraison offerte !',
    ar: '🚚 باقٍ {n} قطع فقط للتوصيل المجاني!',
    en: '🚚 Just {n} more pieces for free delivery!',
  },
  'checkout.confirm': {
    fr: 'Confirmer la commande — {total} TND',
    ar: 'تأكيد الطلب — {total} د.ت',
    en: 'Confirm order — {total} TND',
  },
  'checkout.submitting': { fr: 'Envoi…', ar: 'جارٍ الإرسال…', en: 'Sending…' },
  'checkout.payNote': {
    fr: '💵 Paiement à la livraison. Le paiement en ligne arrive bientôt.',
    ar: '💵 الدفع عند الاستلام. الدفع الإلكتروني قريباً.',
    en: '💵 Cash on delivery. Online payment coming soon.',
  },
  'checkout.title': { fr: 'Finaliser la commande', ar: 'إتمام الطلب', en: 'Complete your order' },
  'checkout.continueShopping': {
    fr: '← Continuer mes achats',
    ar: '← مواصلة التسوق',
    en: '← Keep shopping',
  },
  'checkout.yourOrder': { fr: 'Ta commande', ar: 'طلبك', en: 'Your order' },
  'checkout.doneTitle': { fr: 'Commande confirmée !', ar: 'تم تأكيد الطلب!', en: 'Order confirmed!' },
  'checkout.doneRef': { fr: 'Référence : {ref}', ar: 'المرجع: {ref}', en: 'Reference: {ref}' },
  'checkout.doneCod': {
    fr: 'Paiement à la livraison — on te contacte pour confirmer.',
    ar: 'الدفع عند الاستلام — سنتصل بك للتأكيد.',
    en: 'Cash on delivery — we’ll contact you to confirm.',
  },
  'checkout.emptyTitle': { fr: 'Ton panier est vide.', ar: 'سلتك فارغة.', en: 'Your cart is empty.' },
  'checkout.emptyText': {
    fr: 'Ajoute des pièces pour commander — les réservations expirent après 10 min.',
    ar: 'أضف قطعاً للطلب — تنتهي الحجوزات بعد 10 دقائق.',
    en: 'Add pieces to order — holds expire after 10 min.',
  },
  'checkout.seeRack': { fr: 'Voir le rayon', ar: 'تصفّح الرواق', en: 'Browse the rack' },

  // --- Favorites drawer ---
  'fav.title': { fr: 'Mes favoris', ar: 'مفضّلتي', en: 'My favorites' },
  'fav.empty': { fr: 'Aucun favori pour l’instant.', ar: 'لا مفضّلات بعد.', en: 'No favorites yet.' },
  'fav.emptyHint': {
    fr: 'Swipe une pièce vers le haut ⭐ pour la garder pour plus tard.',
    ar: 'اسحب قطعة للأعلى ⭐ لحفظها لاحقاً.',
    en: 'Swipe a piece up ⭐ to save it for later.',
  },
  'fav.toCart': { fr: '🛒 Au panier', ar: '🛒 إلى السلة', en: '🛒 To cart' },
  'fav.removeAria': { fr: 'Retirer des favoris', ar: 'إزالة من المفضّلة', en: 'Remove from favorites' },

  // --- Empty state (deck exhausted) ---
  'empty.title': { fr: 'Tu as tout vu.', ar: 'لقد رأيت كل شيء.', en: 'You’ve seen it all.' },
  'empty.text': {
    fr: 'Toute la fripa est passée devant tes yeux. On peut rouvrir le rayon — ton panier reste comme tu l’as laissé.',
    ar: 'مرّت كل القطع أمامك. يمكننا إعادة فتح الرواق — تبقى سلتك كما تركتها.',
    en: 'You’ve been through the whole rack. We can reopen it — your cart stays as you left it.',
  },
  'empty.cart': { fr: 'Voir mon panier ({n})', ar: 'عرض سلتي ({n})', en: 'View my cart ({n})' },
  'empty.more': { fr: '✨ Voir d’autres pièces', ar: '✨ عرض قطع أخرى', en: '✨ See more pieces' },
  'empty.restart': {
    fr: 'Tout recommencer (vide le panier)',
    ar: 'البدء من جديد (تُفرّغ السلة)',
    en: 'Start over (empties the cart)',
  },
  'empty.filteredTitle': { fr: 'Aucune pièce ne correspond.', ar: 'لا توجد قطعة مطابقة.', en: 'Nothing matches.' },
  'empty.filteredText': {
    fr: 'Essaie d’élargir tes filtres pour voir plus de pièces.',
    ar: 'وسّع عوامل التصفية لرؤية المزيد.',
    en: 'Widen your filters to see more pieces.',
  },

  // --- Filter drawer ---
  'filter.title': { fr: 'Filtrer', ar: 'تصفية', en: 'Filter' },
  'filter.search': { fr: 'Recherche', ar: 'بحث', en: 'Search' },
  'filter.searchPlaceholder': {
    fr: 'Rechercher (marque, modèle, couleur…)',
    ar: 'ابحث (ماركة، موديل، لون…)',
    en: 'Search (brand, model, colour…)',
  },
  'filter.size': { fr: 'Taille', ar: 'المقاس', en: 'Size' },
  'filter.condition': { fr: 'État', ar: 'الحالة', en: 'Condition' },
  'filter.maxPrice': { fr: 'Prix max (TND)', ar: 'أقصى سعر (د.ت)', en: 'Max price (TND)' },
  'filter.maxPricePlaceholder': { fr: 'ex. 30', ar: 'مثال 30', en: 'e.g. 30' },
  'filter.reset': { fr: 'Réinitialiser', ar: 'إعادة ضبط', en: 'Reset' },

  // --- Product detail ---
  'pd.backCatalogue': { fr: '← Catalogue', ar: '← الكتالوج', en: '← Catalogue' },
  'pd.loading': { fr: 'Chargement de la pièce…', ar: 'جارٍ تحميل القطعة…', en: 'Loading piece…' },
  'pd.notFoundTitle': { fr: 'Pièce introuvable', ar: 'القطعة غير موجودة', en: 'Piece not found' },
  'pd.notFoundText': {
    fr: 'Cette pièce n’existe pas (ou plus).',
    ar: 'هذه القطعة غير موجودة (أو لم تعد).',
    en: 'This piece doesn’t exist (anymore).',
  },
  'pd.backCatalogueFull': { fr: '← Retour au catalogue', ar: '← العودة للكتالوج', en: '← Back to catalogue' },
  'pd.enlarge': { fr: 'Agrandir', ar: 'تكبير', en: 'Enlarge' },
  'pd.photoN': { fr: 'Photo {n}', ar: 'صورة {n}', en: 'Photo {n}' },
  'pd.share': { fr: 'Partager', ar: 'مشاركة', en: 'Share' },
  'pd.shareAria': { fr: 'Partager', ar: 'مشاركة', en: 'Share' },
  'pd.linkCopied': { fr: 'Lien copié !', ar: 'تم نسخ الرابط!', en: 'Link copied!' },
  'pd.shareFailed': { fr: 'Partage indisponible.', ar: 'المشاركة غير متاحة.', en: 'Sharing unavailable.' },
  'pd.size': { fr: 'Taille {size}', ar: 'مقاس {size}', en: 'Size {size}' },
  'pd.gone': {
    fr: 'Cette pièce est partie. 👋 Quelqu’un d’autre l’a chinée avant toi.',
    ar: 'هذه القطعة رحلت. 👋 اقتناها شخص آخر قبلك.',
    en: 'This piece is gone. 👋 Someone thrifted it before you.',
  },
  'pd.inCart': { fr: '✓ Déjà dans ton panier.', ar: '✓ موجودة في سلتك.', en: '✓ Already in your cart.' },
  'pd.inFav': { fr: '⭐ Déjà dans tes favoris.', ar: '⭐ موجودة في مفضّلتك.', en: '⭐ Already in your favorites.' },
  'pd.addToCart': { fr: '🛒 Ajouter au panier', ar: '🛒 أضف إلى السلة', en: '🛒 Add to cart' },
  'pd.favAria': { fr: 'Mettre en favori', ar: 'إضافة إلى المفضّلة', en: 'Add to favorites' },
  'pd.prev': { fr: 'Précédent', ar: 'السابق', en: 'Previous' },
  'pd.next': { fr: 'Suivant', ar: 'التالي', en: 'Next' },
  'pd.similar': { fr: 'Pièces similaires', ar: 'قطع مشابهة', en: 'Similar pieces' },

  // --- Order tracking ---
  'track.back': { fr: '← Accueil', ar: '← الرئيسية', en: '← Home' },
  'track.title': { fr: 'Suivre ma commande', ar: 'تتبّع طلبي', en: 'Track my order' },
  'track.intro': {
    fr: 'Entre ta référence (ex. FR-1001) et le téléphone de la commande.',
    ar: 'أدخل المرجع (مثل FR-1001) وهاتف الطلب.',
    en: 'Enter your reference (e.g. FR-1001) and the order’s phone.',
  },
  'track.refPlaceholder': { fr: 'Référence (FR-…)', ar: 'المرجع (FR-…)', en: 'Reference (FR-…)' },
  'track.phonePlaceholder': { fr: 'Téléphone', ar: 'الهاتف', en: 'Phone' },
  'track.submit': { fr: 'Suivre', ar: 'تتبّع', en: 'Track' },
  'track.notFound': {
    fr: 'Commande introuvable. Vérifie la référence et le numéro de téléphone.',
    ar: 'الطلب غير موجود. تحقّق من المرجع ورقم الهاتف.',
    en: 'Order not found. Check the reference and phone number.',
  },
  'track.paid': { fr: ' · payée', ar: ' · مدفوعة', en: ' · paid' },
  'track.statusLabel': { fr: 'Statut : ', ar: 'الحالة: ', en: 'Status: ' },
  'track.codThanks': {
    fr: 'Paiement à la livraison — on te contacte au besoin. Merci {name} !',
    ar: 'الدفع عند الاستلام — سنتصل بك عند الحاجة. شكراً {name}!',
    en: 'Cash on delivery — we’ll reach out if needed. Thanks {name}!',
  },
  // Order statuses (shared by tracking timeline).
  'status.Nouvelle': { fr: 'Nouvelle', ar: 'جديدة', en: 'New' },
  'status.Confirmée': { fr: 'Confirmée', ar: 'مؤكَّدة', en: 'Confirmed' },
  'status.Expédiée': { fr: 'Expédiée', ar: 'مُرسَلة', en: 'Shipped' },
  'status.Livrée': { fr: 'Livrée', ar: 'مُسلَّمة', en: 'Delivered' },
  'status.Retournée': { fr: 'Retournée', ar: 'مُرجَعة', en: 'Returned' },
  'status.Annulée': { fr: 'Annulée', ar: 'مُلغاة', en: 'Cancelled' },

  // --- Login modal ---
  'login.title': { fr: 'Se connecter', ar: 'تسجيل الدخول', en: 'Sign in' },
  'login.verifyTitle': { fr: 'Vérification', ar: 'التحقّق', en: 'Verification' },
  'login.phoneIntro': {
    fr: 'Entre ton numéro — on t’envoie un code par SMS.',
    ar: 'أدخل رقمك — سنرسل رمزاً عبر SMS.',
    en: 'Enter your number — we’ll text you a code.',
  },
  'login.phone': { fr: 'Téléphone', ar: 'الهاتف', en: 'Phone' },
  'login.sendFail': { fr: 'Échec de l’envoi.', ar: 'فشل الإرسال.', en: 'Sending failed.' },
  'login.getCode': { fr: 'Recevoir le code', ar: 'استلام الرمز', en: 'Get the code' },
  'login.sending': { fr: 'Envoi…', ar: 'جارٍ الإرسال…', en: 'Sending…' },
  'login.codeSentTo': { fr: 'Code envoyé au {phone}.', ar: 'أُرسل الرمز إلى {phone}.', en: 'Code sent to {phone}.' },
  'login.devCode': { fr: 'Code (démo) :', ar: 'الرمز (تجريبي):', en: 'Code (demo):' },
  'login.codeLabel': { fr: 'Code à 4 chiffres', ar: 'رمز من 4 أرقام', en: '4-digit code' },
  'login.codeInvalid': { fr: 'Code invalide.', ar: 'رمز غير صالح.', en: 'Invalid code.' },
  'login.connecting': { fr: 'Connexion…', ar: 'جارٍ الدخول…', en: 'Signing in…' },
  'login.signIn': { fr: 'Se connecter', ar: 'تسجيل الدخول', en: 'Sign in' },
  'login.changeNumber': { fr: '← Changer de numéro', ar: '← تغيير الرقم', en: '← Change number' },

  // --- Account page ---
  'account.title': { fr: 'Mon compte', ar: 'حسابي', en: 'My account' },
  'account.guestIntro': {
    fr: 'Connecte-toi pour retrouver tes commandes et ton adresse.',
    ar: 'سجّل الدخول لاستعادة طلباتك وعنوانك.',
    en: 'Sign in to find your orders and address.',
  },
  'account.signIn': { fr: 'Se connecter', ar: 'تسجيل الدخول', en: 'Sign in' },
  'account.logout': { fr: 'Se déconnecter', ar: 'تسجيل الخروج', en: 'Sign out' },
  'account.connectedAs': { fr: 'Connecté avec {phone}', ar: 'متّصل بـ {phone}', en: 'Signed in as {phone}' },
  'account.myInfo': { fr: 'Mes infos', ar: 'معلوماتي', en: 'My info' },
  'account.name': { fr: 'Nom', ar: 'الاسم', en: 'Name' },
  'account.address': { fr: 'Adresse de livraison', ar: 'عنوان التوصيل', en: 'Delivery address' },
  'account.save': { fr: 'Enregistrer', ar: 'حفظ', en: 'Save' },
  'account.saving': { fr: 'Enregistrement…', ar: 'جارٍ الحفظ…', en: 'Saving…' },
  'account.saved': { fr: '✓ Enregistré', ar: '✓ تم الحفظ', en: '✓ Saved' },
  'account.rewards': { fr: 'Récompenses', ar: 'المكافآت', en: 'Rewards' },
  'account.loyalty': { fr: 'Carte fidélité', ar: 'بطاقة الولاء', en: 'Loyalty card' },
  'account.loyaltyReadyOne': {
    fr: 'Tu as {n} livraison offerte — appliquée à ta prochaine commande !',
    ar: 'لديك {n} توصيلة مجانية — تُطبَّق على طلبك القادم!',
    en: 'You have {n} free delivery — applied to your next order!',
  },
  'account.loyaltyReadyMany': {
    fr: 'Tu as {n} livraisons offertes — appliquées à tes prochaines commandes !',
    ar: 'لديك {n} توصيلات مجانية — تُطبَّق على طلباتك القادمة!',
    en: 'You have {n} free deliveries — applied to your next orders!',
  },
  'account.loyaltyProgressOne': {
    fr: 'Plus que {n} commande livrée pour une livraison offerte.',
    ar: 'باقٍ {n} طلب مُسلَّم للحصول على توصيل مجاني.',
    en: 'Just {n} more delivered order for a free delivery.',
  },
  'account.loyaltyProgressMany': {
    fr: 'Plus que {n} commandes livrées pour une livraison offerte.',
    ar: 'باقٍ {n} طلبات مُسلَّمة للحصول على توصيل مجاني.',
    en: 'Just {n} more delivered orders for a free delivery.',
  },
  'account.referralTitle': { fr: 'Parraine tes amis', ar: 'ادعُ أصدقاءك', en: 'Refer your friends' },
  'account.referralText': {
    fr: 'Ils profitent d’une réduction sur leur 1ʳᵉ commande ; tu gagnes une livraison offerte par filleul livré.',
    ar: 'يحصلون على خصم على أول طلب؛ وتربح توصيلة مجانية عن كل صديق يُسلَّم طلبه.',
    en: 'They get a discount on their 1st order; you earn a free delivery per delivered referral.',
  },
  'account.referralPendingOne': {
    fr: ' Tu as {n} livraison offerte en attente !',
    ar: ' لديك {n} توصيلة مجانية قيد الانتظار!',
    en: ' You have {n} free delivery waiting!',
  },
  'account.referralPendingMany': {
    fr: ' Tu as {n} livraisons offertes en attente !',
    ar: ' لديك {n} توصيلات مجانية قيد الانتظار!',
    en: ' You have {n} free deliveries waiting!',
  },
  'account.share': { fr: 'Partager', ar: 'مشاركة', en: 'Share' },
  'account.copied': { fr: '✓ Copié', ar: '✓ تم النسخ', en: '✓ Copied' },
  'account.referralCount': {
    fr: '{n} ami(s) parrainé(s) jusqu’ici. Merci ! 🙌',
    ar: '{n} صديق تمت دعوته حتى الآن. شكراً! 🙌',
    en: '{n} friend(s) referred so far. Thanks! 🙌',
  },
  'account.shareText': {
    fr: 'Chine sur Fripa avec mon code {code} et profite d’une réduction sur ta première commande ! {url}',
    ar: 'تسوّق على Fripa برمزي {code} واحصل على خصم على أول طلب! {url}',
    en: 'Thrift on Fripa with my code {code} and get a discount on your first order! {url}',
  },
  'account.ordersTitle': { fr: 'Mes commandes', ar: 'طلباتي', en: 'My orders' },
  'account.noOrders': { fr: 'Aucune commande pour l’instant.', ar: 'لا طلبات بعد.', en: 'No orders yet.' },
  'account.track': { fr: 'Suivre →', ar: 'تتبّع →', en: 'Track →' },

  // --- Toasts (deck + catalogue feedback) ---
  'toast.added': { fr: 'Ajouté au panier — {title}', ar: 'أُضيف إلى السلة — {title}', en: 'Added to cart — {title}' },
  'toast.retry': { fr: 'Oups, réessaie.', ar: 'حدث خطأ، حاول مجدداً.', en: 'Oops, try again.' },
  'toast.expired': {
    fr: 'Trop tard — {title} est reparti dans le rayon. 👋',
    ar: 'فات الأوان — عادت {title} إلى الرواق. 👋',
    en: 'Too late — {title} went back on the rack. 👋',
  },
  'toast.expiring': { fr: '⏳ {title} expire bientôt !', ar: '⏳ {title} على وشك الانتهاء!', en: '⏳ {title} expires soon!' },
  'toast.goneForGood': { fr: 'Parti pour de bon. 👋', ar: 'رحلت نهائياً. 👋', en: 'Gone for good. 👋' },
  'toast.favorited': {
    fr: 'Gardé pour plus tard — {title} ⭐',
    ar: 'حُفظت لاحقاً — {title} ⭐',
    en: 'Saved for later — {title} ⭐',
  },
  'toast.undoLimited': {
    fr: '↩ Reviens : une seule fois par heure. À tout à l’heure !',
    ar: '↩ تراجع: مرة واحدة في الساعة. إلى اللقاء!',
    en: '↩ Undo: once per hour. See you soon!',
  },
  'toast.undone': { fr: 'Reviens ! — {title}', ar: 'عادت! — {title}', en: 'It’s back! — {title}' },
  'toast.movedToCart': { fr: 'Déplacé au panier. 🛒', ar: 'نُقلت إلى السلة. 🛒', en: 'Moved to cart. 🛒' },

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

export type TVars = Record<string, string | number>;

// Resolve a key for a language, falling back to French then the raw key, and
// interpolating {tokens} from `vars`. Shared by the provider and its default.
export function translate(lang: Lang, key: StringKey, vars?: TVars): string {
  const tpl = STRINGS[key]?.[lang] ?? STRINGS[key]?.fr ?? key;
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}
