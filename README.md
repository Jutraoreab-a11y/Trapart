# FALT

Cockpit patrimonial pour dirigeants, fondateurs et associés : Immo, Equity, Titres et Cash réunis en un seul patrimoine net.

## Pages

| Fichier | Rôle |
|---|---|
| `index.html` | Landing page |
| `connexion.html` | Connexion et inscription (`#inscription` ouvre l'onglet inscription) |
| `app.html` | Application (`app.html#demo` charge le dossier d'exemple) |
| `cgu.html`, `mentions-legales.html`, `confidentialite.html` | Pages légales |

Build : `npm run build` (Vite, configuration multipage dans `vite.config.mjs`).

## Fonctions serveur (`api/`)

| Route | Rôle | Variables Vercel |
|---|---|---|
| `POST /api/prices` | Cours des actions, ETF, fonds et crypto-actifs | `PRICE_PROVIDER` (`finnhub`, `fmp` ou `alphavantage`), `PRICE_API_KEY`, `COINGECKO_API_KEY` (facultatif) |
| `POST /api/checkout` | Ouvre le paiement Stripe (14 jours d'essai) | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ESSENTIEL_MENSUEL`, `STRIPE_PRICE_ESSENTIEL_ANNUEL`, `STRIPE_PRICE_DIRIGEANT_MENSUEL`, `STRIPE_PRICE_DIRIGEANT_ANNUEL`, `STRIPE_PRICE_FONDATEUR_MENSUEL`, `STRIPE_PRICE_FONDATEUR_ANNUEL`, `STRIPE_AUTOMATIC_TAX` (facultatif) |
| `POST /api/portal` | Espace client Stripe | `STRIPE_SECRET_KEY` |
| `POST /api/webhook` | Met à jour l'abonnement après paiement | `STRIPE_WEBHOOK_SECRET` |

Les routes Stripe ont aussi besoin de `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`. Tant que ces variables ne sont pas posées, elles répondent « paiement pas encore activé » sans rien casser.

## Reste à faire avant le lancement

1. Base Supabase : comptes, table `patrimoine` et table `abonnements`, puis brancher `connexion.html` et `app.html`.
2. Stripe : créer les six tarifs (Essentiel 39 €/390 €, Dirigeant 149 €/1 490 €, Fondateur 89 €/890 €, HT), poser les variables, déclarer le webhook. Limiter le tarif fondateur aux 50 premiers clients.
3. Compléter l'adresse e-mail de contact dans `mentions-legales.html` et `confidentialite.html`.
