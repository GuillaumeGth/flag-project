# Documentation Fläag — Index

| # | Fichier | Contenu |
|---|---------|---------|
| 01 | [architecture.md](./01-architecture.md) | Stack, structure dossiers, navigation, commandes |
| 02 | [database-schema.md](./02-database-schema.md) | Tables, RLS, triggers, PostGIS |
| 03 | [authentication.md](./03-authentication.md) | OTP, Google OAuth, AuthContext, SecureStore |
| 04 | [messaging.md](./04-messaging.md) | CRUD messages, upload médias, conversations |
| 05 | [location.md](./05-location.md) | Foreground/background tracking, règles proximité |
| 06 | [cache.md](./06-cache.md) | Stratégie cache, sync incrémentale, invalidation |
| 07 | [notifications.md](./07-notifications.md) | Push distantes (Expo), locales (background task) |
| 08 | [subscriptions.md](./08-subscriptions.md) | Follow/unfollow, préférences notification |
| 09 | [design-system.md](./09-design-system.md) | Theme, GlassCard, PremiumButton, PremiumAvatar, Toast |
| 10 | [screens.md](./10-screens.md) | Flux utilisateur par écran |
| 11 | [types.md](./11-types.md) | Interfaces TypeScript |
| 12 | [error-reporting.md](./12-error-reporting.md) | Logs production, throttling |

## Règles globales à garder en tête

- **`supabase/schema.sql`** est la source de vérité du schéma — tout changement DB doit y être répercuté
- **RLS** : la logique d'accès est dans Supabase, pas uniquement côté client
- **Rayons** : 100m pour lire, 300m pour notifier
- **Cache** : retour immédiat + fraîcheur en background
- **Tokens** : `expo-secure-store` uniquement (jamais AsyncStorage pour les secrets)
- **Layers** : UI → services → DB — ne jamais cross-layer
- **Types** : tout typer fort, zéro `any`
