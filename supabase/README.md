# Configuration Supabase pour Flag

## Prérequis

1. Créer un projet sur [Supabase](https://supabase.com)
2. Récupérer l'URL et la clé anonyme du projet

## Installation

### Étape 1 : Exécuter le schéma

Dans le Dashboard Supabase → **SQL Editor** → **New query** :

1. Copier le contenu de `schema.sql`
2. Exécuter le script

Cela crée :
- Tables `users` et `messages`
- Policies RLS (Row Level Security)
- Triggers pour création automatique de profil
- Buckets Storage `media` et `avatars`

### Étape 2 : Créer le Flag Bot (optionnel)

Le Flag Bot envoie un message de bienvenue aux nouveaux utilisateurs.

1. Copier le contenu de `seed.sql`
2. Exécuter le script

### Étape 3 : Configurer l'application

Créer les variables d'environnement :

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

Ou configurer dans `app.json` → `extra` :

```json
{
  "expo": {
    "extra": {
      "supabaseUrl": "https://YOUR_PROJECT_REF.supabase.co",
      "supabaseAnonKey": "your_anon_key_here"
    }
  }
}
```

## Structure des fichiers

| Fichier | Description |
|---------|-------------|
| `schema.sql` | Structure BDD (tables, policies, triggers, storage) |
| `seed.sql` | Données initiales (Flag Bot, messages de test) |

## Structure de la base de données

### Tables

| Table | Description |
|-------|-------------|
| `public.users` | Profils utilisateurs (synchronisé avec auth.users) |
| `public.messages` | Messages avec géolocalisation |

### Storage Buckets

| Bucket | Description |
|--------|-------------|
| `media` | Photos et fichiers audio des messages |
| `avatars` | Avatars des utilisateurs |

### Constante importante

```typescript
const FLAG_BOT_ID = '00000000-0000-0000-0000-000000000001';
```

## Dépannage

### Le Flag Bot n'existe pas

```sql
SELECT * FROM public.users WHERE id = '00000000-0000-0000-0000-000000000001';
```

### Erreur d'upload

Vérifier que les buckets existent :
```sql
SELECT * FROM storage.buckets;
```

### Erreur PostGIS

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```
