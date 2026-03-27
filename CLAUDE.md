# Fläag App — CLAUDE.md

## Vue d'ensemble

**Fläag** est une application mobile de messagerie géolocalisée. Les utilisateurs laissent des messages ancrés à des coordonnées GPS, et ces messages ne peuvent être lus qu'à proximité du point de dépôt. L'app combine découverte sur carte, notifications de proximité, et messagerie privée/publique.

## Stack technique

- **Framework** : Expo 54 + React Native 0.81 + React 19 + TypeScript
- **Backend** : Supabase (PostgreSQL + PostGIS, Auth, Storage, RLS)
- **Navigation** : React Navigation 6 (native stack + bottom tabs)
- **Cartes** : React Native Maps + Google Maps (Android)
- **UI** : Expo Linear Gradient, Expo Blur (glassmorphism), React Native Reanimated
- **Localisation** : Expo Location (foreground + background), Expo Task Manager
- **Notifications** : Expo Notifications (push via Expo + local)
- **Médias** : Expo Camera, Expo AV, Expo Image Picker
- **Auth** : Phone OTP + Google OAuth via Supabase

## Structure du projet

```
src/
├── screens/         # Écrans principaux
├── services/        # Logique métier (Supabase, cache, location, notifs)
├── contexts/        # AuthContext, LocationContext
├── components/      # GlassCard, PremiumButton, PremiumAvatar, Toast
├── tasks/           # Background location task
├── types/           # Interfaces TypeScript
└── theme-redesign.ts # Design system (couleurs, spacing)

supabase/
└── schema.sql       # Schéma complet avec PostGIS, triggers, RLS

docs/
├── spec/            # Specs techniques numérotées + features produit
│   └── 00-index.md  # Index de toute la documentation
└── screens/         # Specs détaillées par écran (un écran = un fichier)

ROADMAP_IDEAS.md     # Idées d'évolution produit (racine, document stratégique)
```

## Organisation de la documentation

> **Règle** : toute documentation doit aller dans `docs/`. Jamais de fichiers `.md` de spec à la racine ni dans des dossiers ad hoc.

| Dossier | Quand l'utiliser |
|---------|-----------------|
| `docs/spec/` | Specs techniques (couches système) et features produit. Fichiers techniques numérotés `NN-nom.md`, features en `kebab-case.md`. |
| `docs/screens/` | Spécification détaillée d'un écran ou groupe d'écrans liés (flux, règles métier, composants). Un fichier par écran/groupe, nommé `kebab-case.md`. |
| `ROADMAP_IDEAS.md` | Idées d'évolution produit long terme — reste à la racine car c'est un document stratégique, pas une spec. |

Mettre à jour `docs/spec/00-index.md` quand un nouveau fichier de doc est créé.

## Écrans principaux

| Écran | Rôle |
|-------|------|
| `MapScreen` | Carte interactive, marqueurs de messages à découvrir, navigation vers les flags |
| `InboxScreen` | Liste des conversations avec badges non-lus |
| `ConversationScreen` | Thread de messages (texte, photo, audio) |
| `CreateMessageScreen` | Composition d'un message avec géolocalisation |
| `ReadMessageScreen` | Lecture d'un message (texte, photo, lecture audio) |
| `ProfileScreen` | Profil utilisateur et grille de messages publics |
| `UserProfileScreen` | Profil d'un autre utilisateur + bouton follow |
| `SearchUsersScreen` | Recherche et abonnement à des utilisateurs |
| `AuthScreen` | Login (OTP téléphone, Google OAuth) |
| `PermissionsScreen` | Onboarding permissions (localisation, notifications) |

## Services clés

- **`messages.ts`** — CRUD messages, requêtes carte, upload médias, cache incrémental
- **`reactions.ts`** — Réactions emoji sur les messages (`toggleReaction`, `fetchReactionsForMessages`)
- **`location.ts`** — Distance Haversine, permissions, watch foreground/background
- **`notifications.ts`** — Tokens push, notifications locales de proximité
- **`subscriptions.ts`** — Follow/unfollow, vérification abonnement
- **`cache.ts`** — Cache AsyncStorage avec sync incrémental par timestamp
- **`supabase.ts`** — Client Supabase, SecureStore adapter, gestion session
- **`errorReporting.ts`** — Logs d'erreurs en production (throttled, vers Supabase)

## Base de données

Tables principales : `users`, `messages`, `message_reactions`, `subscriptions`, `discovered_public_messages`, `user_push_tokens`, `error_logs`, `app_config`

Points importants :
- **PostGIS** pour les requêtes géographiques (type `GEOGRAPHY POINT`)
- **RLS** activé sur toutes les tables — ne jamais contourner
- **Triggers** automatiques : création de profil, message de bienvenue, notifications push, emails d'alerte erreur
- Les marqueurs carte (`fetchUndiscoveredMessagesForMap`) ne contiennent **pas** le contenu des messages (privacy)

> **Règle importante** : tout changement du modèle de données (ajout/suppression de colonne, nouvelle table, modification de trigger ou de politique RLS) doit être répercuté dans `supabase/schema.sql`. Ce fichier est la source de vérité du schéma.

## Règles de proximité

- **100m** : rayon de lecture d'un message — utilisé dans `MapScreen` (`canReadMessage`) et valeur par défaut de `isWithinRadius` dans `location.ts`
- **300m** : seuil de notification background (`PROXIMITY_RADIUS` dans `backgroundLocation.ts`) — notifie l'utilisateur bien avant qu'il soit à portée de lecture

## Patterns importants

### Réactions emoji
- Appui long sur un message → `ReactionPicker` (modal centré, glassmorphism, 6 emoji : ❤️ 😂 😮 😢 😡 👍)
- Les réactions sont affichées comme badges flottants (`ReactionBadge`) en bas à droite de la bulle
- Mise à jour optimiste côté client puis sync Supabase via `toggleReaction`
- Pattern `generationRef` dans `ConversationScreen` : `reactionsMapRef` garde la dernière valeur de `reactionsMap` accessible dans les callbacks stables (`useCallback` avec deps `[user]` seulement)
- Table `message_reactions` avec contrainte UNIQUE `(message_id, user_id, emoji)` — RLS basée sur la visibilité du message parent

### Découverte de messages publics (mosaïque & feed)
→ Voir `docs/screens/profile.md` — règles de floutage, services, composants impliqués.

### Cache
- Toutes les fetches supportent le sync incrémental via timestamp
- Le cache retourne immédiatement, les données fraîches arrivent en background
- Cache vidé entièrement au logout

### Sécurité
- RLS sur toutes les tables — la logique d'accès est dans Supabase, pas seulement côté client
- Messages privés nécessitent un abonnement mutuel (vérifié par RLS)
- Tokens stockés dans `expo-secure-store`

### Internationalisation (i18n)
- **Zéro texte statique** — toute string visible par l'utilisateur passe obligatoirement par `t()` de `react-i18next`
- Source de vérité : `src/i18n/locales/fr.ts` — toujours ajouter la clé en `fr` en premier, puis dans `en`, `es`, `pt`, `de`
- Les constantes avec des `label:` traduits doivent être déclarées **dans le composant**, pas au niveau du module
- Langues supportées : `fr`, `en`, `es`, `pt`, `de` — fallback `en`
- Détection automatique de la langue du device via `expo-localization`, persistance dans `AsyncStorage`
- Sélecteur de langue dans `SettingsScreen`
- Doc complète : `docs/spec/13-i18n.md`

### Design
- Glassmorphism avec `GlassCard` + `BlurView`
- Boutons gradient avec `PremiumButton`
- Avatars avec anneau gradient via `PremiumAvatar`
- Design system dans `src/theme-redesign.ts`

## Variables d'environnement requises

```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
```

## Commandes utiles

```bash
npm start          # Dev server Expo
npm run ios        # Build iOS
npm run android    # Build Android
npm run lint       # ESLint
```

## Identifiants

- iOS bundle ID : `com.flagapp.app`
- Android package : `com.flagapp.app`
- EAS project : configuré dans `app.json`
