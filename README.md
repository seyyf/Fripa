# Fripa — le swipe du fripier tunisien 🇹🇳

Un MVP **ReactJS + NestJS** d'une fripa en ligne pour le marché tunisien.
Un deck à la Tinder/Bumble : on **swipe à droite pour garder** (panier),
**à gauche pour passer**, **vers le haut pour mettre en favori** (gardé pour
plus tard, séparé du panier). Une fois passé, **90% du temps, l'article
disparaît pour toujours**. Les 10% restants reviennent **une seule fois**
avec un bandeau **« Dernière chance »** — exactement comme quand tu retournes
dans une vraie fripa et que tu pries pour que personne n'ait pris la pièce.

## Architecture

```
efrez/
├── backend/         NestJS API (REST, état en mémoire)
│   └── src/shop/    items.data.ts · service · controller
└── frontend/        React + Vite + framer-motion
    └── src/         App, SwipeDeck, SwipeCard, Cart, FavoritesDrawer,
                     Header, EmptyState · swipe/decideSwipe
```

## Lancer en local

Deux terminaux. Node 18+ requis.

**Backend (port 3001) :**

```powershell
cd backend
npm install
npm run start:dev
```

**Frontend (port 5173, proxy vers le backend) :**

```powershell
cd frontend
npm install
npm run dev
```

Ouvre http://localhost:5173.

## La logique métier qui change tout

`backend/src/shop/shop.service.ts` :

- `LAST_CHANCE_PROBABILITY = 0.1` — quand l'utilisateur passe un article,
  on lance les dés : 90% il part dans `passed` (gone forever), 10% dans
  `lastChancePool` (éligible à une seule réapparition).
- `LAST_CHANCE_SURFACE_RATE = 0.2` — quand on tire un lot pour le deck, s'il
  y a des pièces en attente dans `lastChancePool`, 20% du temps on en
  remonte une, flaggée `lastChance: true`. Le front affiche alors le
  bandeau doré qui pulse, l'utilisateur sait qu'il joue sa dernière main.
- Une fois affichée en last-chance, la pièce bascule dans `shownLastChance`
  et ne ressort jamais, même si l'utilisateur la repasse.

L'état est conservé en mémoire, keyed par `userId` (généré et stocké
côté client dans `localStorage`). Bouton `↻` dans le header pour
recommencer une session.

## Endpoints API

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/items/field?userId=X&count=N` | Tire un lot pour le deck. Filtres optionnels : `q`, `sizes`, `conditions`, `maxPrice` |
| `POST` | `/api/swipes/pass` | Body `{ userId, itemId }` — swipe gauche, applique la roulette 90/10 |
| `POST` | `/api/swipes/undo` | Body `{ userId }` — « Reviens ! » : annule le dernier swipe |
| `POST` | `/api/cart` | Body `{ userId, itemId }` — swipe droite, ajoute au panier |
| `GET` | `/api/cart/:userId` | Récupère le panier (`lines`, `total`) |
| `DELETE` | `/api/cart/:userId/:itemId` | Retire un article |
| `POST` | `/api/cart/:userId/checkout` | Valide la commande (démo : vide le panier) |
| `POST` | `/api/favorites` | Body `{ userId, itemId }` — swipe haut, met en favori |
| `GET` | `/api/favorites/:userId` | Récupère les favoris |
| `DELETE` | `/api/favorites/:userId/:itemId` | Retire un favori |
| `POST` | `/api/favorites/:userId/:itemId/to-cart` | Déplace un favori vers le panier |
| `POST` | `/api/session/:userId/reset` | Réinitialise tout (panier + favoris compris) |
| `POST` | `/api/session/:userId/reset-swipes` | Rouvre le stock en gardant panier **et** favoris |

## Pour aller plus loin

- **Persistance** : remplacer la `Map` en mémoire par Postgres + TypeORM,
  une table `user_swipes (user_id, item_id, status, surfaced_at)`.
- **Vraies photos** : les `imageUrl` actuels pointent vers `picsum.photos`
  avec des seeds stables. Remplace-les dans `items.data.ts` par les URLs
  de tes vrais articles (Cloudinary, S3, etc.).
- **Multi-vendeurs** : chaque article a déjà un champ `seller` (souk,
  ville). Ajoute une table `sellers` et un dashboard pour eux.
- **Paiement** : intégrer Konnect / Flouci / D17 (paiement Tunisie) au
  checkout.
- **Auth** : remplacer le `userId` localStorage par un vrai login OTP SMS.
- **Stock concurrent** : aujourd'hui, deux users peuvent ajouter le même
  t-shirt unique. Ajouter une réservation à l'add-to-cart et un TTL.

## Design tokens

Palette : rouge drapeau `#E2231A`, or `#D4A017`, papier kraft `#fff8f1`.
La typo et les copies sont en français (langue de la fripa tunisienne).
