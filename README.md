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
| `POST /api/checkout` | Ouvre le paiement Stripe (14 jours d'essai) | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO_MENSUEL`, `STRIPE_PRICE_PRO_ANNUEL`, `STRIPE_PRICE_ULTRA_MENSUEL`, `STRIPE_PRICE_ULTRA_ANNUEL`, `STRIPE_PRICE_MVP_MENSUEL`, `STRIPE_PRICE_MVP_ANNUEL`, `STRIPE_AUTOMATIC_TAX` (facultatif) |
| `POST /api/portal` | Espace client Stripe | `STRIPE_SECRET_KEY` |
| `POST /api/webhook` | Met à jour l'abonnement après paiement | `STRIPE_WEBHOOK_SECRET` |

Les routes Stripe ont aussi besoin de `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`. Tant que ces variables ne sont pas posées, elles répondent « paiement pas encore activé » sans rien casser.

## Paiement

Le paiement passe par des liens de paiement Stripe (Payment Links), définis dans `connexion.html` (objet `PAY`) et dans `app.html` (constante `PAY`) :

| Offre | Mensuel | Annuel |
|---|---|---|
| Pro (39 € / 390 € HT) | https://buy.stripe.com/4gM5kEbf20Ch1med5Qd7q00 | https://buy.stripe.com/9B63cw2Iw3Otgh83vgd7q01 |
| Ultra (149 € / 1 490 € HT) | https://buy.stripe.com/dRm00kaaY84Jc0S3vgd7q02 | https://buy.stripe.com/14A8wQgzmacRd4W7Lwd7q03 |
| Ultra Max, offre MVP (89 € / 890 € HT) | https://buy.stripe.com/5kQeVe5UI0Ch4yq5Dod7q04 | https://buy.stripe.com/aFaaEYere2Kpe90gi2d7q05 |

Après paiement, chaque lien doit rediriger vers `app.html?paiement=ok&offre=…&facturation=…`. Les routes `api/checkout` et `api/portal` restent disponibles pour un passage ultérieur à Stripe Checkout.

## Reste à faire avant le lancement

1. Base Supabase : comptes, table `patrimoine` et table `abonnements`, puis brancher `connexion.html` et `app.html`.
2. Stripe : créer les six tarifs (Pro 39 €/390 €, Ultra 149 €/1 490 €, MVP 89 €/890 €, HT), poser les variables, déclarer le webhook. Limiter l'offre MVP aux 50 premiers clients.
3. Compléter l'adresse e-mail de contact dans `mentions-legales.html` et `confidentialite.html`.
