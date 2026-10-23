# Trapart

Cockpit patrimonial pour dirigeants, fondateurs et business angels : cinq applications interconnectées.

| Application | Rôle |
|---|---|
| **Trapart** | Application centrale : patrimoine consolidé (Orbis) et optimisation fiscale (Fiscool) |
| **Domum** | Immobilier et SCI : crédits (in fine, amortissement constant, annuité constante), tableau d'amortissement, régimes fiscaux, IFI |
| **Falco Core** | Participations, trésorerie pro et CCA, synchronisation avec Falco |
| **Tivra** | Titres financiers : 12 classes d'actifs, Grecques, YTM, vesting, cours en temps réel par clé API |
| **Envelo** | PEA, assurance-vie, PER, livrets : allocations, projections face à l'inflation |

## Lancer en local

Le prototype tient dans un seul fichier, sans dépendance ni compilation :

```bash
open index.html          # macOS
# ou
npx serve .              # puis http://localhost:3000
```

Les données sont enregistrées dans le navigateur (localStorage). Publiée comme artifact Claude, la page les enregistre aussi dans l'espace privé de l'utilisateur.

## Ce qui demande un serveur (étape suivante)

- Connexion OAuth2 et webhooks signés avec Falco
- Agrégation bancaire (Powens, Flanks, Plaid)
- Relais des appels de données de marché (Alpha Vantage, Finnhub, FMP) si le navigateur les bloque
- Connexion universelle par lien magique, facturation des abonnements

## Avertissement

Les calculs fiscaux sont indicatifs (taux réglables dans les paramètres) et ne remplacent pas l'avis d'un expert-comptable ou d'un avocat fiscaliste.
# Trapart
