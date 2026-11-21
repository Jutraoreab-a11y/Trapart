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
| Ultra (149 € / 1 490 € HT) | https://buy.stripe.com/dRm00kaaY84Jc0S3vgd7q02 | https://buy.stripe.com/6oU28sdnackZ9SK1n8d7q06 |
| FALT MVP (89 € / 890 € HT, Ultra pour les 50 premiers clients) | https://buy.stripe.com/5kQeVe5UI0Ch4yq5Dod7q04 | https://buy.stripe.com/aFaaEYere2Kpe90gi2d7q05 |

Après paiement, chaque lien doit rediriger vers `app.html?paiement=ok&offre=…&facturation=…`. Les routes `api/checkout` et `api/portal` restent disponibles pour un passage ultérieur à Stripe Checkout.

## Images

Les captures de la landing sont dans `public/img/` (servies telles quelles à `/img/...`). Pour les refaire : ouvrir `app.html#demo` en thème sombre, capturer en 1440×900, convertir en WebP.

## Connecteur Claude (MCP)

L'app propose dans Paramètres → Claude l'adresse du connecteur et la génération de clés d'API.

| Route | Rôle |
|---|---|
| `POST /api/mcp` | Serveur MCP en lecture seule (outils `patrimoine_resume`, `lister_actifs`, `historique_patrimoine`, `simuler_fiscool`). Clé dans `Authorization: Bearer falt_sk_…` ou `x-api-key`, jamais dans l'URL. |
| `GET /api/mcp?statut` | Indique à l'app si le connecteur est actif. |
| `GET/POST/DELETE /api/cles` | Liste, enregistre et révoque les clés du compte connecté. |

Une clé (`falt_sk_` + 32 caractères) est générée dans le navigateur et montrée une seule fois. Seuls son préfixe et son empreinte SHA-256 sont envoyés et stockés. Equity et Fiscool restent réservés à l'offre Ultra côté serveur.

Claude lit le résumé du patrimoine que l'app calcule (`claudeSnapshot()`), à enregistrer dans `patrimoine.snapshot` à chaque sauvegarde une fois Supabase branché.

Tables Supabase à créer :

```sql
create table public.patrimoine (
  user_id uuid primary key references auth.users(id) on delete cascade,
  etat jsonb not null default '{}'::jsonb,
  snapshot jsonb,
  maj_le timestamptz not null default now()
);
create table public.api_cles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nom text not null,
  prefixe text not null,
  hash text not null unique,
  cree_le timestamptz not null default now(),
  dernier_usage timestamptz,
  revoquee_le timestamptz
);
alter table public.patrimoine enable row level security;
alter table public.api_cles enable row level security;
create policy "patrimoine du titulaire" on public.patrimoine for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- api_cles : aucun accès client, lecture et écriture par les fonctions serveur (service role) uniquement.
```

Pour l'app Claude (web, bureau, mobile), le connecteur personnalisé demande une connexion OAuth : à brancher sur le serveur OAuth de Supabase Auth au moment de l'activation des comptes. Les clés d'API servent à Claude Code et à l'API Claude.

## Reste à faire avant le lancement

1. Base Supabase : comptes, table `patrimoine` et table `abonnements`, puis brancher `connexion.html` et `app.html` (vérification du paiement, mot de passe oublié), puis enregistrer `claudeSnapshot()` et activer la connexion OAuth du connecteur Claude.
2. Stripe : ajouter le numéro de TVA FR81106031305 dans les réglages de facturation, faire un paiement réel de bout en bout avec FALT100 puis supprimer ce code. Limiter l'offre MVP aux 50 premiers clients.
