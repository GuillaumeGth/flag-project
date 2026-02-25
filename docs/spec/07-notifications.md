# 07 — Notifications

## Vue d'ensemble

Deux types de notifications coexistent :
- **Push distantes** : envoyées depuis les triggers Supabase via l'API Expo Push
- **Locales** : générées sur l'appareil par la tâche background de localisation

Service : `src/services/notifications.ts`
Tâche background : `src/tasks/backgroundLocation.ts`

## Push distantes (Supabase → Expo Push)

### Enregistrement du token

```typescript
getPushToken(): Promise<string | null>
// Obtient le token Expo Push de l'appareil (expo-notifications)

registerPushToken(userId: string): Promise<boolean>
// Upsert dans public.user_push_tokens
// Clé unique : (user_id, expo_push_token)
// Multi-appareils supporté nativement

unregisterPushToken(userId: string): Promise<void>
// DELETE tous les tokens du user → appelé au logout
```

### Envoi (côté Supabase)

Les triggers Supabase envoient directement les notifications via HTTP :

**Trigger `send_push_on_new_message`** (nouveau message reçu) :
```
POST https://exp.host/--/api/v2/push/send
{
  to: <expo_push_token>,
  title: "Nouveau flag de <sender_name>",
  body: "Tu as reçu un nouveau flag" | "Un flag t'attend à proximité",
  data: { messageId: <id> }
}
```

**Trigger `send_push_on_message_discovered`** (message découvert) :
```
POST https://exp.host/--/api/v2/push/send
{
  to: <expo_push_token>,
  title: "Ton flag a été découvert !",
  body: "<recipient_name> a lu ton message"
}
```

### Gestion des préférences

Via table `public.subscriptions` :
- `notify_private_flags` : notifier pour les messages privés
- `notify_public_flags` : notifier pour les messages publics

Le trigger vérifie `notify_private_flags` avant d'envoyer.

## Notifications locales (background proximity)

```typescript
notifyNearbyMessage(messageId: string, senderName: string): Promise<void>
// Déclenche une notification locale immédiate
// Titre: "Message à proximité"
// Corps: "<senderName> a laissé un message près de vous"
// Data: { messageId }
```

Déclenchée par `checkNearbyMessages()` dans la tâche background lorsque la distance ≤ 300m.

## Listener de tap sur notification

```typescript
addNotificationResponseListener(callback: (messageId: string) => void): Subscription
// Écoute les taps sur notifications
// Extrait messageId depuis notification.request.content.data
// Callback permet de naviguer vers ReadMessageScreen
```

Utilisé dans le navigator racine pour ouvrir directement le message concerné.

## Permissions

```typescript
requestNotificationPermission(): Promise<boolean>
// Demande la permission iOS/Android
// Crée le canal Android "messages" (HIGH importance, vibration, son)
```

## Configuration du handler

Au démarrage, le handler est configuré pour afficher les notifications même en foreground :
```typescript
setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
```

## Flux complet

### Notification de nouveau message privé

```
1. Utilisateur A envoie message à Utilisateur B
2. INSERT dans messages → trigger send_push_on_new_message
3. Trigger récupère les tokens de B depuis user_push_tokens
4. Trigger vérifie notify_private_flags dans subscriptions
5. HTTP POST vers Expo Push API pour chaque token
6. Appareil de B reçoit la notification push
7. Tap → addNotificationResponseListener → navigate ReadMessageScreen
```

### Notification de proximité

```
1. Tâche background reçoit une mise à jour de position
2. checkNearbyMessages() fetche les messages non lus de l'utilisateur
3. Pour chaque message à ≤ 300m → notifyNearbyMessage()
4. Notification locale affichée immédiatement
5. Tap → navigate vers la carte ou ReadMessageScreen
```
