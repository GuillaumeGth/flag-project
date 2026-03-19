# Documentation Fläag — Index

## Specs techniques (système)

| # | Fichier | Contenu |
|---|---------|---------|
| 01 | [spec/01-architecture.md](./01-architecture.md) | Stack, structure dossiers, navigation, commandes |
| 02 | [spec/02-database-schema.md](./02-database-schema.md) | Tables, RLS, triggers, PostGIS |
| 03 | [spec/03-authentication.md](./03-authentication.md) | OTP, Google OAuth, AuthContext, SecureStore |
| 04 | [spec/04-messaging.md](./04-messaging.md) | CRUD messages, upload médias, conversations |
| 05 | [spec/05-location.md](./05-location.md) | Foreground/background tracking, règles proximité |
| 06 | [spec/06-cache.md](./06-cache.md) | Stratégie cache, sync incrémentale, invalidation |
| 07 | [spec/07-notifications.md](./07-notifications.md) | Push distantes (Expo), locales (background task) |
| 08 | [spec/08-subscriptions.md](./08-subscriptions.md) | Follow/unfollow, préférences notification |
| 09 | [spec/09-design-system.md](./09-design-system.md) | Theme, GlassCard, PremiumButton, PremiumAvatar, Toast |
| 10 | [spec/10-screens.md](./10-screens.md) | Flux utilisateur par écran (vue d'ensemble) |
| 11 | [spec/11-types.md](./11-types.md) | Interfaces TypeScript |
| 12 | [spec/12-error-reporting.md](./12-error-reporting.md) | Logs production, throttling |

## Specs de features

| Fichier | Feature |
|---------|---------|
| [spec/comments.md](./comments.md) | Commentaires sur les fläags publics |
| [spec/clustering.md](./clustering.md) | Clustering dynamique des marqueurs carte |
| [spec/mes-flaags.md](./mes-flaags.md) | Mode "Mes Flaags" sur la carte |
| [spec/admin-flag-placement.md](./admin-flag-placement.md) | Placement de flags admin n'importe où |

## Specs d'écrans

| Fichier | Écran |
|---------|-------|
| [screens/auth.md](../screens/auth.md) | AuthScreen + PermissionsScreen |
| [screens/map.md](../screens/map.md) | MapScreen (explore, mine, admin placement, clustering, routing) |
| [screens/inbox.md](../screens/inbox.md) | InboxScreen (liste conversations, realtime, cache) |
| [screens/conversation.md](../screens/conversation.md) | ConversationScreen (réactions, reply, delete, audio) |
| [screens/create-message.md](../screens/create-message.md) | CreateMessageScreen + SelectRecipientScreen |
| [screens/read-message.md](../screens/read-message.md) | ReadMessageScreen (markAsRead + markDiscovered) |
| [screens/search.md](../screens/search.md) | SearchUsersScreen (debounce, top users, filtre) |
| [screens/settings.md](../screens/settings.md) | SettingsScreen + PrivacyScreen + FollowRequestsScreen |
| [screens/profile.md](../screens/profile.md) | ProfileScreen + UserProfileScreen + MessageFeedScreen |

## Règles globales

- **`supabase/schema.sql`** est la source de vérité du schéma — tout changement DB doit y être répercuté
- **RLS** : la logique d'accès est dans Supabase, pas uniquement côté client
- **Rayons** : 100m pour lire, 300m pour notifier
- **Cache** : retour immédiat + fraîcheur en background
- **Tokens** : `expo-secure-store` uniquement (jamais AsyncStorage pour les secrets)
- **Layers** : UI → services → DB — ne jamais cross-layer
- **Types** : tout typer fort, zéro `any`
