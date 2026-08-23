# Votika Backend

Backend Node.js/Express/TypeScript pour **Votika** — plateforme de vote Mobile Money pour influenceurs TikTok.

## Stack technique

| Couche | Technologie |
|---|---|
| Runtime | Node.js 18+ |
| Langage | TypeScript (strict) |
| Framework | Express.js |
| Base de données | Firebase Firestore |
| Authentification | Clerk |
| Paiement | MoneyFusion (Mobile Money) |
| Validation | Zod |
| HTTP client | axios |

---

## Installation

```bash
# 1. Cloner le repo
git clone <repo-url>
cd votika-backend

# 2. Installer les dépendances
npm install

# 3. Copier et configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos credentials réels
```

---

## Configuration

### Variables d'environnement (`.env`)

```env
PORT=5000
NODE_ENV=development

# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"

# Clerk
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...

# MoneyFusion
MONEYFUSION_API_KEY=your-api-key
MONEYFUSION_MERCHANT_ID=your-merchant-id
MONEYFUSION_WEBHOOK_SECRET=your-webhook-secret
MONEYFUSION_BASE_URL=https://api.moneyfusion.net/v1

# Default vote price (FCFA)
DEFAULT_VOTE_UNIT_PRICE=200
```

> ⚠️ Le serveur s'arrête immédiatement au démarrage si une variable requise est manquante ou invalide (fail-fast via Zod).

---

### Configuration Firebase

1. Aller sur [Firebase Console](https://console.firebase.google.com)
2. Créer un projet → Activer **Firestore** en mode production
3. Aller dans **Paramètres du projet → Comptes de service → Générer une nouvelle clé privée**
4. Copier `project_id`, `client_email`, et `private_key` dans `.env`

#### Index Firestore requis

Créer les index composites suivants dans Firestore (ou via `firebase.indexes.json`) :

```
Collection: creators
  - status ASC, totalVotes DESC

Collection: votes
  - creatorId ASC, status ASC, createdAt DESC
  - creatorId IN, status ASC, createdAt ASC  (pour les tendances 24h)

Collection: transactions
  - status ASC, createdAt DESC
  - moneyFusionRef ASC (for webhook lookup)
```

---

### Configuration Clerk

1. Créer un compte sur [Clerk Dashboard](https://dashboard.clerk.com)
2. Créer une application et récupérer `CLERK_SECRET_KEY` et `CLERK_PUBLISHABLE_KEY`
3. **Assigner les rôles via `publicMetadata`** sur chaque utilisateur :
   ```json
   { "role": "creator" }   // pour les créateurs
   { "role": "admin" }     // pour les administrateurs
   ```
   Cela se fait depuis le dashboard Clerk → Users → modifier l'utilisateur → Public Metadata.

---

### Configuration MoneyFusion

1. Créer un compte sur [MoneyFusion](https://moneyfusion.net)
2. Récupérer votre `API_KEY`, `MERCHANT_ID`, et configurer le `WEBHOOK_SECRET`
3. Configurer l'URL de webhook dans le dashboard MoneyFusion :
   ```
   https://votre-domaine.com/api/webhooks/moneyfusion
   ```

---

## Scripts

```bash
npm run dev       # Démarrer en mode développement (tsx watch)
npm run build     # Compiler TypeScript → dist/
npm start         # Démarrer le serveur compilé
npm run lint      # ESLint
npm run lint:fix  # ESLint avec auto-fix
```

---

## Endpoints API

### Public (aucune authentification)

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Vérification de santé |
| `GET` | `/api/creators` | Liste des créateurs actifs |
| `GET` | `/api/creators/:id` | Profil d'un créateur |
| `GET` | `/api/leaderboard` | Classement par votes |
| `POST` | `/api/votes` | Initier un vote (paiement Mobile Money) |
| `POST` | `/api/webhooks/moneyfusion` | Callback MoneyFusion (sécurisé par HMAC) |

#### `POST /api/votes` — Body

```json
{
  "creatorId": "abc123",
  "voteCount": 10,
  "voterPhone": "+2250700000000",
  "voterName": "Jean Dupont",
  "paymentMethod": "orange"
}
```

**paymentMethod** : `orange` | `wave` | `mtn` | `flooz` | `mix_by_yas`

#### `GET /api/creators` — Query params

| Param | Type | Description |
|---|---|---|
| `category` | string | Filtrer par catégorie |
| `country` | string | Filtrer par pays |
| `search` | string | Recherche par nom/pseudo |
| `page` | number | Page (défaut: 1) |
| `limit` | number | Résultats par page (défaut: 20) |

---

### Créateur (Auth Clerk, rôle `creator`)

| Méthode | Endpoint | Description |
|---|---|---|
| `POST` | `/api/creators/me` | Créer son profil |
| `GET` | `/api/creators/me` | Récupérer son profil |
| `PATCH` | `/api/creators/me` | Modifier son profil |
| `GET` | `/api/creators/me/stats` | Statistiques personnelles |

---

### Admin (Auth Clerk, rôle `admin`)

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/dashboard` | Stats globales |
| `GET` | `/api/admin/creators` | Tous les créateurs |
| `PATCH` | `/api/admin/creators/:id` | Modifier un créateur |
| `DELETE` | `/api/admin/creators/:id` | Supprimer un créateur |
| `GET` | `/api/admin/transactions` | Liste des transactions |
| `GET` | `/api/admin/settings` | Lire les paramètres |
| `PATCH` | `/api/admin/settings` | Modifier les paramètres |

---

## Architecture

```
src/
├── config/          # env.ts (Zod validation), firebase.ts (Admin SDK init)
├── schemas/         # Zod schemas — 1 fichier par ressource
├── models/          # Accès Firestore bas niveau — types + CRUD
├── providers/
│   └── payment/    # Interface PaymentProvider + MoneyFusionProvider
├── services/        # Logique métier (orchestration)
├── controllers/     # Handlers Express (thin layer)
├── routes/          # Montage des routes + validation middleware
├── middlewares/     # clerkAuth, requireRole, validate, errorHandler
└── utils/           # ApiError, logger
```

### Patterns importants

- **Controller → Service → Model** : les controllers ne touchent jamais Firestore directement.
- **Idempotence du webhook** : avant toute modification, le statut courant de la transaction est vérifié. Un webhook reçu deux fois n'incrémente pas les votes deux fois.
- **Atomicité Firestore** : l'incrément de `totalVotes` + la mise à jour du vote + la mise à jour de la transaction s'effectuent dans une seule transaction Firestore (`db.runTransaction`).
- **Interface PaymentProvider** : permet de swapper MoneyFusion pour un autre provider (Stripe, Paystack) sans modifier les services.

---

## Format de réponse

Toutes les réponses suivent ce format :

```json
// Succès
{ "data": { ... } }
{ "data": [...], "count": 42 }

// Erreur
{ "error": "Message d'erreur" }

// Erreur de validation (400)
{
  "error": "Données invalides",
  "details": [{ "code": "...", "path": ["field"], "message": "..." }]
}
```

---

## Déploiement

1. `npm run build` — compile TypeScript
2. Définir les variables d'environnement en production
3. `npm start` — démarrer le serveur compilé
4. Configurer Nginx/Caddy comme reverse proxy avec HTTPS
5. S'assurer que l'URL de webhook MoneyFusion pointe vers votre domaine public

---

## Développement local avec des variables factices

Pour démarrer `npm run dev` sans credentials réels, créer un `.env` avec des valeurs factices :

```env
PORT=5000
NODE_ENV=development
FIREBASE_PROJECT_ID=fake-project
FIREBASE_CLIENT_EMAIL=fake@fake.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEo...\n-----END RSA PRIVATE KEY-----\n"
CLERK_SECRET_KEY=sk_test_fake
CLERK_PUBLISHABLE_KEY=pk_test_fake
MONEYFUSION_API_KEY=fake-key
MONEYFUSION_MERCHANT_ID=fake-merchant
MONEYFUSION_WEBHOOK_SECRET=fake-secret
MONEYFUSION_BASE_URL=https://api.moneyfusion.net/v1
DEFAULT_VOTE_UNIT_PRICE=200
```

> Le serveur démarrera mais les appels Firebase/Clerk/MoneyFusion échoueront. Utiliser des émulateurs Firebase pour un développement local complet.
