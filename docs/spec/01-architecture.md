# 01 — Architecture générale

## Vue d'ensemble

Fläag est une application mobile de messagerie géolocalisée. Les messages sont ancrés à des coordonnées GPS et ne peuvent être lus qu'à moins de 100m du point de dépôt.

## Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Framework mobile | Expo + React Native | 54 / 0.81.5 |
| Langage | TypeScript (strict) | — |
| UI | React 19 | 19.1.0 |
| Navigation | React Navigation | 6 |
| Backend | Supabase (PostgreSQL + PostGIS) | ^2.39.0 |
| Auth | Supabase Auth (OTP + Google OAuth) | — |
| Storage | Supabase Storage | — |
| Cartes | React Native Maps + Google Maps | 1.20.1 |
| Localisation | Expo Location + Task Manager | ~19.0.8 |
| Notifications | Expo Notifications | ~0.32.16 |
| Médias | Expo Camera, Expo AV, Expo Image Picker | — |
| Animations | React Native Reanimated | ~4.1.1 |
| Graphisme | Expo Linear Gradient, Expo Blur | — |
| Cache local | AsyncStorage | 2.2.0 |
| Tokens sécurisés | Expo SecureStore | ~15.0.8 |
| Distribution | Firebase App Distribution | ^23.8.6 |

## Structure des dossiers

```
flag-project/
├── src/
│   ├── screens/         # Écrans principaux (React Navigation)
│   ├── services/        # Logique métier + appels Supabase
│   ├── contexts/        # AuthContext, LocationContext
│   ├── components/      # Composants UI réutilisables
│   │   └── redesign/    # GlassCard, PremiumButton, PremiumAvatar
│   ├── tasks/           # Tâches Expo Task Manager (background location)
│   ├── types/           # Interfaces TypeScript globales
│   └── theme-redesign.ts # Design system
├── supabase/
│   └── schema.sql       # Source de vérité du schéma DB
├── __tests__/
│   └── services/        # Tests unitaires des services
├── docs/
│   └── spec/            # Documentation fonctionnelle (ce dossier)
└── .claude/
    └── skills/          # Skills Claude pour le projet
```

## Séparation des couches

| Couche | Emplacement | Règle stricte |
|--------|-------------|---------------|
| UI / Affichage | `src/screens/`, `src/components/` | Zéro logique métier, zéro appel Supabase direct |
| Logique métier | `src/services/*.ts` | Toutes les opérations DB et API ici |
| État global | `src/contexts/` | Uniquement auth et location |
| Types | `src/types/index.ts` | Interfaces partagées, exportées |
| Tâches BG | `src/tasks/` | Expo Task Manager uniquement |
| Design | `src/theme-redesign.ts` | Toutes les valeurs visuelles ici — pas de valeurs hardcodées dans les composants |

## Navigation

Structure de navigation React Navigation 6 :

```
RootNavigator (NativeStack)
├── AuthScreen                  # Visible si non connecté
├── PermissionsScreen           # Onboarding permissions
└── MainTabNavigator (BottomTabs)
    ├── Tab: Map    → MapScreen
    ├── Tab: Inbox  → InboxStack
    │   ├── InboxScreen
    │   ├── ConversationScreen
    │   └── ReadMessageScreen
    ├── Tab: Search → SearchUsersScreen
    └── Tab: Profile → ProfileStack
        ├── ProfileScreen
        ├── UserProfileScreen
        └── SettingsScreen
```

Écrans hors tabs (stack global) :
- `CreateMessageScreen` — accédé depuis MapScreen et ConversationScreen
- `SelectRecipientScreen` — accédé depuis CreateMessageScreen

## Variables d'environnement

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
```

## Identifiants build

- iOS Bundle ID : `com.flagapp.app`
- Android Package : `com.flagapp.app`
- EAS Project : configuré dans `app.json`

## Commandes

```bash
npm start              # Dev server Expo
npm run ios            # Build iOS
npm run android        # Build Android
npm run lint           # ESLint
npm test               # Jest (tests unitaires)
npm run test:coverage  # Coverage
```
