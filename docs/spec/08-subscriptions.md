# 08 — Abonnements (Follow)

## Vue d'ensemble

Le système de follow permet aux utilisateurs de s'abonner mutuellement. L'abonnement mutuel est requis pour s'envoyer des messages privés (vérifié par RLS).

Service : `src/services/subscriptions.ts`

## Modèle de données

Table `public.subscriptions` :

| Champ | Description |
|-------|-------------|
| `follower_id` | Qui suit |
| `following_id` | Qui est suivi |
| `notify_private_flags` | Recevoir notifs pour messages privés (défaut: true) |
| `notify_public_flags` | Recevoir notifs pour messages publics (défaut: true) |

## API du service

```typescript
follow(userId: string): Promise<boolean>
// INSERT INTO subscriptions (follower_id, following_id)
// follower_id = auth.uid()

unfollow(userId: string): Promise<boolean>
// DELETE FROM subscriptions WHERE follower_id = auth.uid() AND following_id = userId

isFollowing(userId: string): Promise<boolean>
// SELECT count FROM subscriptions WHERE follower_id = auth.uid() AND following_id = userId

isEitherFollowing(userId: string): Promise<boolean>
// Vérifie si auth.uid() suit userId OU si userId suit auth.uid()

fetchFollowingIds(): Promise<string[]>
// Tous les IDs suivis par auth.uid()

fetchFollowerCount(userId: string): Promise<number>
// Nombre de followers d'un utilisateur donné
```

## Préférences de notification

```typescript
fetchNotificationPrefs(followingId: string): Promise<NotificationPrefs>
// Lit notify_private_flags et notify_public_flags
// Pour la relation : auth.uid() → followingId

updateNotificationPrefs(followingId: string, prefs: Partial<NotificationPrefs>): Promise<boolean>
// UPDATE subscriptions SET ... WHERE follower_id = auth.uid() AND following_id = followingId

interface NotificationPrefs {
  notifyPrivateFlags: boolean;
  notifyPublicFlags: boolean;
}
```

## Règles métier

### Envoi de message privé
- Requiert abonnement mutuel : A suit B **ET** B suit A
- Vérifié par RLS (`public.messages` INSERT policy) — pas uniquement côté client
- La RLS retourne une erreur si l'abonnement mutuel n'est pas satisfait

### Messages publics
- Pas d'abonnement requis pour lire/découvrir un message public
- L'abonnement influence uniquement les notifications push (`notify_public_flags`)

## Intégration UI

### `UserProfileScreen`
- Affiche bouton Follow / Unfollow selon `isFollowing(userId)`
- Modal de préférences de notification (engrenage icon)
- Affiche `fetchFollowerCount(userId)`

### `SelectRecipientScreen`
- Liste les utilisateurs suivis via `fetchFollowedUsers()` (depuis `messages.ts`)
- Permet de choisir le destinataire du message

### `MapScreen`
- `fetchFollowingPublicMessages()` charge les messages publics des utilisateurs suivis

## Sécurité

- `follower_id` = `auth.uid()` forcé par RLS — impossible de follow au nom d'un autre
- La vérification d'abonnement mutuel pour les messages privés est dans les policies RLS, pas seulement côté client
