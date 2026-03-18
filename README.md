# Fläag

Application mobile de messagerie géolocalisée — laissez des messages ancrés dans le monde réel, lisibles uniquement à proximité du point de dépôt.

## Fonctionnalités

- **Messages géolocalisés** : messages ancrés à une position GPS, invisibles à distance
- **Découverte** : carte interactive avec clustering de marqueurs
- **Proximité** : lecture possible dans un rayon de 100 m, notifications à 300 m
- **Multimédia** : texte, photos et audio
- **Réactions emoji** : ❤️ 😂 😮 😢 😡 👍 via appui long
- **Messagerie privée** : conversations avec abonnement mutuel requis
- **Suivi** : follow/unfollow des utilisateurs, profils publics
- **Notifications push** : alertes de proximité en foreground et background
- **Mode admin** : placement de messages à n'importe quelle position sur la carte

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
- **Builds** : EAS Build (Android : build local avec `--local`)

## Installation

```bash
# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Remplir les variables (voir section ci-dessous)

# Lancer le serveur de développement
npm start
```

## Variables d'environnement

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
```

## Commandes utiles

```bash
npm start          # Serveur de développement Expo
npm run ios        # Build iOS
npm run android    # Build Android
npm run lint       # ESLint
```

## Structure du projet

```
src/
├── screens/             # Écrans principaux
├── components/
│   ├── redesign/        # GlassCard, PremiumButton, PremiumAvatar
│   ├── map/             # SelectedMessageCard, MessageMarker
│   ├── conversation/    # MessageBubble, MessageInput
│   ├── profile/         # GridCell
│   ├── EmptyState.tsx
│   ├── AudioPlayerButton.tsx
│   └── ScreenLoader.tsx
├── contexts/            # AuthContext, LocationContext
├── hooks/               # useListData, useAudioRecorder, useImagePicker,
│                        # useMapMessages, useMapMarkers, useMessageLoader,
│                        # useClusteredMarkers
├── services/            # Logique métier
│   ├── messages.ts      # CRUD messages, upload médias, cache
│   ├── reactions.ts     # Réactions emoji
│   ├── location.ts      # Distance Haversine, permissions, watch
│   ├── notifications.ts # Tokens push, notifications locales
│   ├── subscriptions.ts # Follow/unfollow
│   ├── cache.ts         # Cache AsyncStorage avec sync incrémental
│   ├── supabase.ts      # Client Supabase, SecureStore
│   └── errorReporting.ts# Logs d'erreurs en production (vers Supabase)
├── tasks/               # backgroundLocation.ts (Expo Task Manager)
├── types/               # index.ts, navigation.ts
├── utils/               # debug.ts (log/warn dev-only), date.ts
└── theme-redesign.ts    # Design system (couleurs, spacing)

supabase/
└── schema.sql           # Schéma complet (source de vérité)
```

## Écrans principaux

| Écran | Rôle |
|-------|------|
| `MapScreen` | Carte interactive, marqueurs de messages, mode placement admin |
| `InboxScreen` | Liste des conversations avec badges non-lus |
| `ConversationScreen` | Thread de messages (texte, photo, audio) + réactions |
| `CreateMessageScreen` | Composition d'un message avec géolocalisation |
| `ReadMessageScreen` | Lecture d'un message |
| `ProfileScreen` | Profil utilisateur et grille de messages publics |
| `UserProfileScreen` | Profil d'un autre utilisateur + bouton follow |
| `SearchUsersScreen` | Recherche et abonnement à des utilisateurs |
| `AuthScreen` | Login (OTP téléphone, Google OAuth) |
| `PermissionsScreen` | Onboarding permissions (localisation, notifications) |

## Configuration Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Exécuter le script `supabase/schema.sql` dans l'éditeur SQL
3. Activer l'authentification par téléphone et Google dans Authentication > Providers
4. Copier l'URL et la clé anon dans `.env`

## Configuration Google Maps (Android)

1. Créer un projet sur [Google Cloud Console](https://console.cloud.google.com)
2. Activer l'API "Maps SDK for Android"
3. Créer une clé API et l'ajouter dans `app.json` :
   ```json
   "android": {
     "config": {
       "googleMaps": {
         "apiKey": "VOTRE_CLE_API"
       }
     }
   }
   ```

## Configuration Google OAuth

### Google Cloud Console

1. APIs & Services > Identifiants > Créer des identifiants > ID client OAuth
2. Créer deux clients OAuth :
   - **Web** : pour Supabase (noter le Client ID et Client Secret)
   - **Android** :
     - Nom du package : `com.flagapp.app`
     - Empreinte SHA-1 : `keytool -keystore android/app/debug.keystore -list -v` (mot de passe : `android`)

### Supabase

1. Authentication > Providers > Google
2. Renseigner Client ID et Client Secret (Web)

### Application

Ajouter dans `.env` :
```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=votre_web_client_id
```

## Base de données

Tables principales : `users`, `messages`, `message_reactions`, `subscriptions`, `discovered_public_messages`, `user_push_tokens`, `error_logs`, `app_config`

Points importants :
- **PostGIS** pour les requêtes géographiques
- **RLS** activé sur toutes les tables
- **Triggers** automatiques : création de profil, message de bienvenue, notifications push, emails d'alerte erreur
- Tout changement du modèle de données doit être répercuté dans `supabase/schema.sql`

## Règles de proximité

- **100 m** : rayon de lecture d'un message
- **300 m** : seuil de notification background (notifie avant que l'utilisateur soit à portée de lecture)

## Identifiants

- iOS bundle ID : `com.flagapp.app`
- Android package : `com.flagapp.app`
- EAS project : configuré dans `app.json`
