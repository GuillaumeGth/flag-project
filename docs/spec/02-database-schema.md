# 02 — Schéma de base de données

> **Source de vérité** : `supabase/schema.sql`
> Tout changement de schéma (table, colonne, trigger, RLS, index) doit être répercuté dans ce fichier.

## Tables

### `public.users`

Profil utilisateur public, synchronisé depuis `auth.users` via trigger.

| Colonne | Type | Contrainte | Description |
|---------|------|------------|-------------|
| `id` | UUID | PK, FK → auth.users | Identifiant utilisateur |
| `display_name` | TEXT | — | Nom affiché |
| `avatar_url` | TEXT | — | URL image de profil (Supabase Storage) |
| `phone` | TEXT | — | Numéro de téléphone |
| `email` | TEXT | — | Adresse email |
| `created_at` | TIMESTAMPTZ | NOT NULL | Date de création |
| `updated_at` | TIMESTAMPTZ | — | Date de modification |

**RLS :**
- SELECT : tous les utilisateurs authentifiés
- INSERT : uniquement soi-même (`id = auth.uid()`)
- UPDATE : uniquement soi-même

---

### `public.messages`

Messages géolocalisés (privés ou publics, avec ou sans contenu média).

| Colonne | Type | Contrainte | Description |
|---------|------|------------|-------------|
| `id` | UUID | PK | Identifiant message |
| `sender_id` | UUID | FK → users | Expéditeur |
| `recipient_id` | UUID | FK → users, nullable | Destinataire (null = broadcast public) |
| `content_type` | TEXT | CHECK ('text','photo','audio') | Type de contenu |
| `text_content` | TEXT | — | Contenu texte |
| `media_url` | TEXT | — | URL Supabase Storage (photo/audio) |
| `location` | GEOGRAPHY(POINT,4326) | — | Coordonnées GPS (PostGIS) |
| `is_read` | BOOLEAN | DEFAULT false | Lu par le destinataire |
| `is_public` | BOOLEAN | DEFAULT false | Visible par tous (carte publique) |
| `read_at` | TIMESTAMPTZ | — | Date de lecture |
| `created_at` | TIMESTAMPTZ | NOT NULL | Date d'envoi |

**Index :**
- `recipient_id` (B-tree) — requêtes inbox
- `sender_id` (B-tree) — requêtes profil
- `location` (GIST) — requêtes géographiques PostGIS
- `is_read = false` (partiel) — messages non lus

**RLS :**
- SELECT : `sender_id = auth.uid()` OU `recipient_id = auth.uid()` OU `is_public = true`
- INSERT : `sender_id = auth.uid()` ET (`is_public = true` OU `recipient_id IS NULL` OU abonnement mutuel vérifié)
- UPDATE : `recipient_id = auth.uid()` (pour marquer lu)

> **Règle de privacy** : `fetchUndiscoveredMessagesForMap` retourne uniquement les métadonnées (id, location, created_at, sender partiel) — jamais le contenu du message.

---

### `public.subscriptions`

Abonnements entre utilisateurs (follow/unfollow).

| Colonne | Type | Contrainte | Description |
|---------|------|------------|-------------|
| `id` | UUID | PK | — |
| `follower_id` | UUID | FK → users | Qui suit |
| `following_id` | UUID | FK → users | Qui est suivi |
| `notify_private_flags` | BOOLEAN | DEFAULT true | Notifier pour messages privés |
| `notify_public_flags` | BOOLEAN | DEFAULT true | Notifier pour messages publics |
| `created_at` | TIMESTAMPTZ | NOT NULL | — |

**RLS :** Utilisateur peut lire/modifier ses propres abonnements.

---

### `public.discovered_public_messages`

Trace quels messages publics un utilisateur a découverts.

| Colonne | Type | Contrainte | Description |
|---------|------|------------|-------------|
| `user_id` | UUID | FK → users | Qui a découvert |
| `message_id` | UUID | FK → messages | Quel message |
| `discovered_at` | TIMESTAMPTZ | — | Quand |

**Contrainte unique** : `(user_id, message_id)`

---

### `public.user_push_tokens`

Tokens Expo Push par appareil.

| Colonne | Type | Contrainte | Description |
|---------|------|------------|-------------|
| `id` | UUID | PK | — |
| `user_id` | UUID | FK → users | Propriétaire |
| `expo_push_token` | TEXT | NOT NULL | Token Expo |
| `device_name` | TEXT | — | Nom de l'appareil |
| `created_at` | TIMESTAMPTZ | — | — |

**Contrainte unique** : `(user_id, expo_push_token)`
**RLS :** Utilisateur peut lire/modifier ses propres tokens.

---

### `public.error_logs`

Logs d'erreurs production (throttled, depuis errorReporting.ts).

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | — |
| `user_id` | UUID | Utilisateur concerné (nullable) |
| `error_message` | TEXT | Message d'erreur |
| `error_context` | TEXT | Contexte fonctionnel |
| `error_stack` | TEXT | Stack trace |
| `metadata` | JSONB | Données additionnelles |
| `created_at` | TIMESTAMPTZ | — |

---

### `public.app_config`

Configuration applicative distante (feature flags, paramètres).

---

## Triggers & Fonctions

### `handle_new_user()`
**Déclenché** : AFTER INSERT sur `auth.users`
**Action** : Crée automatiquement un enregistrement dans `public.users` avec les données de profil (email, phone, display_name depuis metadata, avatar_url).

### `send_welcome_message()`
**Déclenché** : AFTER INSERT sur `public.users`
**Action** : Envoie un message de bienvenue depuis Flag Bot (`00000000-0000-0000-0000-000000000001`) au nouvel utilisateur.

### `send_push_on_new_message()`
**Déclenché** : AFTER INSERT sur `public.messages`
**Action** :
1. Récupère les push tokens du destinataire
2. Vérifie la préférence `notify_private_flags` de l'abonnement
3. Envoie un HTTP POST à l'API Expo Push (`https://exp.host/--/api/v2/push/send`)
4. Adapte le texte selon si le message a une localisation ou non

### `send_push_on_message_discovered()`
**Déclenché** : AFTER UPDATE sur `public.messages` (is_read: false → true)
**Action** : Notifie l'expéditeur que son message a été découvert.

## PostGIS

- Extension PostgreSQL pour les données géographiques
- Type `GEOGRAPHY(POINT, 4326)` pour les localisations (WGS84)
- Insertion : `ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)`
- Requête de proximité : `ST_DWithin(location, ST_SetSRID(ST_MakePoint($lon, $lat), 4326), $radius)`
- Lecture du format retourné : `"POINT(lon lat)"` → parser dans `parseLocation()`

## Acteur spécial : Flag Bot

- **ID** : `00000000-0000-0000-0000-000000000001`
- **Rôle** : Envoie le message de bienvenue aux nouveaux utilisateurs
- **Constante** : `FLAG_BOT_ID` dans `src/services/messages.ts`
